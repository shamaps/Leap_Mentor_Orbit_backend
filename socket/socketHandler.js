// backend/socket/socketHandler.js
const Message = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");

// ✅ Track online users per room: { connectRequestId: Set<userId> }
const onlineUsers = new Map();

// ✅ Track connected sockets per user: { userId: Set<socketId> }
// Set instead of single socketId — supports multiple simultaneous connections per user
// (e.g. useGoals and window.__leapSocket both connecting independently)
const userSockets = new Map();

// ── Helper: check user is part of this connectRequest ────────
const validateRoomAccess = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee status")
    .lean();

  if (!request) return false;
  if (request.status !== "ongoing") return false;

  const mentorId = request.mentor.toString();
  const menteeId = request.mentee.toString();
  const uid = userId.toString();

  return uid === mentorId || uid === menteeId;
};

// ── Helper: get the other participant's userId ────────────────
const getOtherUserId = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee")
    .lean();
  if (!request) return null;
  return request.mentor.toString() === userId.toString()
    ? request.mentee.toString()
    : request.mentor.toString();
};

// ── Helper: emit to a specific user by userId ─────────────────
// ✅ Emits to ALL active sockets for this user (handles multiple connections)
const emitToUser = (io, userId, event, data) => {
  const socketIds = userSockets.get(userId.toString());
  if (socketIds?.size) {
    socketIds.forEach((socketId) => io.to(socketId).emit(event, data));
    return true;
  }
  return false; // user is offline
};

// ── Export emitToUser so controllers can use it ───────────────
module.exports.emitToUser = null; // will be set after io is initialized

// ✅ NEW — expose io so goal controller can emit to rooms directly
module.exports.io = null;

// ── Main handler ──────────────────────────────────────────────
const socketHandler = (io) => {

  // ✅ Expose emitToUser globally so backend controllers can call it
  module.exports.emitToUser = (userId, event, data) =>
    emitToUser(io, userId, event, data);

  // ✅ NEW — expose io instance for goal controller room emits
  module.exports.io = io;

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.email} (${socket.id})`);

    // ✅ Register this socket under the user — supports multiple sockets per user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // ── join_room ───────────────────────────────────────────
    socket.on("join_room", async ({ connectRequestId }) => {
      try {
        const allowed = await validateRoomAccess(connectRequestId, userId);
        if (!allowed) {
          socket.emit("error", { message: "Not authorized to join this room" });
          return;
        }

        socket.join(connectRequestId);
        socket.currentRoom = connectRequestId;

        if (!onlineUsers.has(connectRequestId)) {
          onlineUsers.set(connectRequestId, new Set());
        }
        onlineUsers.get(connectRequestId).add(userId);

        socket.to(connectRequestId).emit("user_online", { userId });

        await Message.updateMany(
          {
            connectRequest: connectRequestId,
            sender: { $ne: userId },
            readAt: null,
          },
          { $set: { readAt: new Date() } }
        );

        socket.to(connectRequestId).emit("messages_read", {
          connectRequestId,
          readBy: userId,
          readAt: new Date(),
        });

        console.log(`🏠 ${socket.user.email} joined room: ${connectRequestId}`);
      } catch (err) {
        console.error("❌ join_room error:", err.message);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── send_message ────────────────────────────────────────
    socket.on("send_message", async ({ connectRequestId, content }) => {
      try {
        if (!content?.trim()) return;

        const allowed = await validateRoomAccess(connectRequestId, userId);
        if (!allowed) {
          socket.emit("error", { message: "Not authorized to send messages here" });
          return;
        }

        const message = await Message.create({
          connectRequest: connectRequestId,
          sender: userId,
          content: content.trim(),
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "name email")
          .lean();

        const roomOnline = onlineUsers.get(connectRequestId) || new Set();
        const otherId = await getOtherUserId(connectRequestId, userId);
        const otherOnline = otherId && roomOnline.has(otherId);

        if (otherOnline) {
          await Message.findByIdAndUpdate(message._id, { readAt: new Date() });
          populated.readAt = new Date();
        }

        io.to(connectRequestId).emit("new_message", populated);

        console.log(`💬 Message in ${connectRequestId} from ${socket.user.email}`);
      } catch (err) {
        console.error("❌ send_message error:", err.message);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ── typing_start ────────────────────────────────────────
    socket.on("typing_start", ({ connectRequestId }) => {
      socket.to(connectRequestId).emit("typing_start", { userId });
    });

    // ── typing_stop ─────────────────────────────────────────
    socket.on("typing_stop", ({ connectRequestId }) => {
      socket.to(connectRequestId).emit("typing_stop", { userId });
    });

    // ── mark_read ───────────────────────────────────────────
    socket.on("mark_read", async ({ connectRequestId }) => {
      try {
        await Message.updateMany(
          {
            connectRequest: connectRequestId,
            sender: { $ne: userId },
            readAt: null,
          },
          { $set: { readAt: new Date() } }
        );

        socket.to(connectRequestId).emit("messages_read", {
          connectRequestId,
          readBy: userId,
          readAt: new Date(),
        });
      } catch (err) {
        console.error("❌ mark_read error:", err.message);
      }
    });

    // ── disconnect ──────────────────────────────────────────
    socket.on("disconnect", () => {
      // ✅ Remove only this socket from the user's Set; clean up map if empty
      const ids = userSockets.get(userId);
      if (ids) {
        ids.delete(socket.id);
        if (ids.size === 0) userSockets.delete(userId);
      }

      const room = socket.currentRoom;
      if (room && onlineUsers.has(room)) {
        onlineUsers.get(room).delete(userId);
        if (onlineUsers.get(room).size === 0) {
          onlineUsers.delete(room);
        }
        socket.to(room).emit("user_offline", { userId });
      }
      console.log(`🔌 Socket disconnected: ${socket.user?.email} (${socket.id})`);
    });
  });
};

module.exports = socketHandler;
// backend/socket/socketHandler.js
const Message       = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");

//  Track online users per room: { connectRequestId: Set<userId> }
const onlineUsers = new Map();

// ── Helper: check user is part of this connectRequest ────────
const validateRoomAccess = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee status")
    .lean();

  if (!request) return false;
  if (request.status !== "ongoing") return false;

  const mentorId = request.mentor.toString();
  const menteeId = request.mentee.toString();
  const uid      = userId.toString();

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

// ── Main handler ──────────────────────────────────────────────
const socketHandler = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.email} (${socket.id})`);

    // ── join_room ───────────────────────────────────────────
    // Client joins a room scoped to their connectRequestId
    socket.on("join_room", async ({ connectRequestId }) => {
      try {
        const allowed = await validateRoomAccess(connectRequestId, userId);
        if (!allowed) {
          socket.emit("error", { message: "Not authorized to join this room" });
          return;
        }

        socket.join(connectRequestId);
        socket.currentRoom = connectRequestId;

        // Track online users in this room
        if (!onlineUsers.has(connectRequestId)) {
          onlineUsers.set(connectRequestId, new Set());
        }
        onlineUsers.get(connectRequestId).add(userId);

        //  Notify the room that this user is online
        socket.to(connectRequestId).emit("user_online", { userId });

        // Mark unread messages as read (messages NOT sent by this user)
        await Message.updateMany(
          {
            connectRequest: connectRequestId,
            sender: { $ne: userId },
            readAt: null,
          },
          { $set: { readAt: new Date() } }
        );

        // ✅ Tell the sender their messages were read
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

        // ✅ Persist to DB first — socket is just delivery
        const message = await Message.create({
          connectRequest: connectRequestId,
          sender:         userId,
          content:        content.trim(),
        });

        const populated = await Message.findById(message._id)
          .populate("sender", "name email")
          .lean();

        // ✅ Check if recipient is online in the room — auto mark read
        const roomOnline  = onlineUsers.get(connectRequestId) || new Set();
        const otherId     = await getOtherUserId(connectRequestId, userId);
        const otherOnline = otherId && roomOnline.has(otherId);

        if (otherOnline) {
          await Message.findByIdAndUpdate(message._id, { readAt: new Date() });
          populated.readAt = new Date();
        }

        // ✅ Emit to entire room (including sender for confirmation)
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
      const room = socket.currentRoom;
      if (room && onlineUsers.has(room)) {
        onlineUsers.get(room).delete(userId);
        if (onlineUsers.get(room).size === 0) {
          onlineUsers.delete(room);
        }
        // ✅ Notify room that user went offline
        socket.to(room).emit("user_offline", { userId });
      }
      console.log(`🔌 Socket disconnected: ${socket.user?.email} (${socket.id})`);
    });
  });
};

module.exports = socketHandler;
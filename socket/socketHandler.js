// backend/socket/socketHandler.js
const Message = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");
const { logger } = require("@sentry/node");

// IN-MEMORY ENGINE STATE TRACKING
// These collections manage live system variables inside the server's RAM for rapid lookups.


// Track online users per room: { connectRequestId -> Set<userId> }
// Links an active chat room ID to a collection of unique user IDs sitting inside it.
const onlineUsers = new Map();

// Track connected sockets per user: { userId -> Set<socketId> }
// Links a user's database ID to a unique collection of active socket connection IDs.
// A Set supports multiple simultaneous connections per user (e.g. multi-tab or multi-device browsing).
const userSockets = new Map();


// SECURE DATABASE HELPERS & PIPELINES

/**
 * Helper: Validates if a specific user is authorized to access a given connection room.
 * @param {string} connectRequestId - The ID of the targeted chat channel.
 * @param {string} userId - The ID of the verifying user.
 * @returns {Promise<boolean>} True if authorized and ongoing, false otherwise.
 */
const validateRoomAccess = async (connectRequestId, userId) => {
  // Query MongoDB for the request, stripping away everything except core metadata fields
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee status")
    .lean(); // Converts documents to lightweight plain JSON objects for faster processing

  if (!request) return false;
  if (request.status !== "ongoing") return false; // Lock access if the connection is terminated

  const mentorId = request.mentor.toString();
  const menteeId = request.mentee.toString();
  const uid = userId.toString();

  // Access passes only if the active user is the assigned mentor or mentee
  return uid === mentorId || uid === menteeId;
};

/**
 * Helper: Extracts the user ID of the opposite participant inside the room configuration.
 * @param {string} connectRequestId - The ID of the chat channel.
 * @param {string} userId - The current user's ID.
 * @returns {Promise<string|null>} The counterparty's user ID, or null.
 */
const getOtherUserId = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee")
    .lean();
  if (!request) return null;

  // Evaluates placement: if current user is the mentor, return mentee, and vice versa
  return request.mentor.toString() === userId.toString()
    ? request.mentee.toString()
    : request.mentor.toString();
};

/**
 * Helper: Targets a specific user by database ID and fires events across all their open active devices.
 * @param {object} io - Core Socket.io server instance.
 * @param {string} userId - Target recipient user ID.
 * @param {string} event - Network event identifier name string.
 * @param {any} data - Transmitted network data package payload.
 * @returns {boolean} True if successfully routed to at least one socket, false if user is offline.
 */
const emitToUser = (io, userId, event, data) => {
  const socketIds = userSockets.get(userId.toString()); // Extract the user's connection Set
  if (socketIds?.size) {
    // Distribute the event to every active tab/window instance the user currently has open
    socketIds.forEach((socketId) => io.to(socketId).emit(event, data));
    return true;
  }
  return false; // User is entirely offline
};


/**
 * CONTROLLER BRIDGE EXPORTS
 * Clean API interfaces allowing HTTP router controllers to trigger real-time actions.
 */

// Export emitToUser so HTTP REST API controllers can dispatch real-time events down user pipes
module.exports.emitToUser = null; // Stamped during runtime setup initialization loops

// Expose the core io socket instance so external controllers can run direct room broadcasts
module.exports.io = null;


// CORE WEBSOCKET ROUTING LOOP
const socketHandler = (io) => {

  // Map local references up to global export targets for access by external routers
  module.exports.emitToUser = (userId, event, data) =>
    emitToUser(io, userId, event, data);

  module.exports.io = io;

  // Listens for a new device connection establishing a secure handshake
  io.on("connection", (socket) => {
    // Extract the primary user identifier from the authenticated middleware passport profile
    const userId = socket.user._id.toString();
    logger.info("Socket connected", { email: socket.user.email, socketId: socket.id });

    // Multi-device registration: Add this socket instance identifier to the user state collection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set()); // Instantiates a fresh Set if this is their first active device
    }
    userSockets.get(userId).add(socket.id); // Add this window's network socket.id to their tracking profile

    // ── TRIGGER EVENT: join_room ───────────────────────────────────
    // Fired when a user selects a target workspace chat box pane
    socket.on("join_room", async ({ connectRequestId }) => {
      try {
        // 1. Authorization Gate: Confirm user belongs in this workspace chat
        const allowed = await validateRoomAccess(connectRequestId, userId);
        if (!allowed) {
          socket.emit("error", { message: "Not authorized to join this room" });
          return;
        }

        // 2. Channel Assignment: Hook socket engine instance into the dedicated Socket.io room channel
        socket.join(connectRequestId);
        socket.currentRoom = connectRequestId; // Stash room marker on socket profile for disconnect cleanup

        // 3. Registry Logging: Add user to room's active in-memory tracker list
        if (!onlineUsers.has(connectRequestId)) {
          onlineUsers.set(connectRequestId, new Set()); // Initialize room Set if empty
        }
        onlineUsers.get(connectRequestId).add(userId);

        // 4. Alert Peer: Tell the room that this user came online
        socket.to(connectRequestId).emit("user_online", { userId });

        // 5. Context Resolution: Sync partner's presence badge status right away
        const otherId = await getOtherUserId(connectRequestId, userId);
        if (otherId && onlineUsers.get(connectRequestId)?.has(otherId)) {
          // Tell this newly connected user that their partner is already active in the workspace
          socket.emit("user_online", { userId: otherId });
        }

        // 6. DB Read Sync: Instantly sweep and update older unread messages from the other user
        await Message.updateMany(
          {
            connectRequest: connectRequestId,
            sender: { $ne: userId }, // Sender is NOT the current viewing user
            readAt: null,            // Field is unread
          },
          { $set: { readAt: new Date() } } // Catch up with current timestamp profile
        );

        // 7. Push Receipts: Tell the sender that their messages have been opened and read
        socket.to(connectRequestId).emit("messages_read", {
          connectRequestId,
          readBy: userId,
          readAt: new Date(),
        });

        logger.info("Socket: user joined room", { email: socket.user.email, connectRequestId });
      } catch (err) {
        logger.error("join_room error", { error: err.message, stack: err.stack, userId, connectRequestId });
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── TRIGGER EVENT: send_message ────────────────────────────────
    // Fired when a user completes drafting an active text string payload
    socket.on("send_message", async ({ connectRequestId, content }) => {
      try {
        if (!content?.trim()) return; // Protection layer: abort empty message inputs

        // Re-authenticate ownership privileges before writing document data records
        const allowed = await validateRoomAccess(connectRequestId, userId);
        if (!allowed) {
          socket.emit("error", { message: "Not authorized to send messages here" });
          return;
        }

        // Write the newly dispatched message entry directly into the database engine
        const message = await Message.create({
          connectRequest: connectRequestId,
          sender: userId,
          content: content.trim(),
        });

        // Pull full relational document objects (names, emails) to serve layout requirements
        const populated = await Message.findById(message._id)
          .populate("sender", "name email")
          .lean();

        // Optimized Inline Read Stamping: Is the target counterparty in the room right now?
        const roomOnline = onlineUsers.get(connectRequestId) || new Set();
        const otherId = await getOtherUserId(connectRequestId, userId);
        const otherOnline = otherId && roomOnline.has(otherId);

        if (otherOnline) {
          // If the counterparty is active in the room right now, mark the message as read immediately
          await Message.findByIdAndUpdate(message._id, { readAt: new Date() });
          populated.readAt = new Date();
        }

        // Broadcast: Propagate the fresh chat bundle out to all room connections
        io.to(connectRequestId).emit("new_message", populated);

        logger.info("Socket message sent", { email: socket.user.email, connectRequestId });
      } catch (err) {
        logger.error("send_message error", { error: err.message, stack: err.stack, userId, connectRequestId });
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ── TRIGGER EVENT: typing_start ────────────────────────────────
    // Routes real-time animations down pipeline lines without executing database modifications
    socket.on("typing_start", ({ connectRequestId }) => {
      socket.to(connectRequestId).emit("typing_start", { userId });
    });

    // ── TRIGGER EVENT: typing_stop ─────────────────────────────────
    // Deactivates active writing animations over target destination components


    // ── typing_stop ─────────────────────────────────────────
    socket.on("typing_stop", ({ connectRequestId }) => {
      socket.to(connectRequestId).emit("typing_stop", { userId });
    });
    // ── TRIGGER EVENT: mark_read ───────────────────────────────────
    // Explicit client-side override action forced when a user focus event snaps onto open channels
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
        logger.error("Socket mark_read error", { error: err.message, stack: err.stack });
      }
    });

    // ── TRIGGER EVENT: disconnect ──────────────────────────────────
    // Absolute lifecycle teardown routine strictly engineered to neutralize resource memory leaks
    socket.on("disconnect", () => {
      // Remove only this socket from the user's Set; clean up map if empty
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
      logger.info("Socket disconnected", { email: socket.user?.email, socketId: socket.id });
    });
  });
};

module.exports = socketHandler;
// backend/controllers/message.controller.js
const Message        = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");

// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId
// Returns paginated message history for a session
// Query params: page (default 1), limit (default 30)
// ─────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId  = req.user._id.toString();
    const page    = Math.max(1, Number.parseInt(req.query.page)  || 1);
    const limit   = Math.min(50, Number.parseInt(req.query.limit) || 30);
    const skip    = (page - 1) * limit;

    // ✅ Validate user is part of this session
    const request = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee status")
      .lean();

    if (!request) {
      return res.status(404).json({ message: "Session not found" });
    }

    const isMentor = request.mentor.toString() === userId;
    const isMentee = request.mentee.toString() === userId;

    if (!isMentor && !isMentee) {
      return res.status(403).json({ message: "Not authorized to view these messages" });
    }

    // ✅ Fetch messages sorted oldest first for chat display
    const [messages, totalCount] = await Promise.all([
      Message.find({ connectRequest: connectRequestId })
        .populate("sender", "name email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Message.countDocuments({ connectRequest: connectRequestId }),
    ]);

    // ✅ Mark fetched messages as read if receiver is fetching
    await Message.updateMany(
      {
        connectRequest: connectRequestId,
        sender:         { $ne: userId },
        readAt:         null,
      },
      { $set: { readAt: new Date() } }
    );

    return res.json({
      success:    true,
      messages,
      totalCount,
      page,
      limit,
      hasMore:    skip + messages.length < totalCount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId/unread-count
// Returns count of unread messages for the current user
// ─────────────────────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id.toString();

    const count = await Message.countDocuments({
      connectRequest: connectRequestId,
      sender:         { $ne: userId },
      readAt:         null,
    });

    return res.json({ success: true, unreadCount: count });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getMessages, getUnreadCount };
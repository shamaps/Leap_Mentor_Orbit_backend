const LeapRequest = require("../models/LeapRequest.model");
const Wallet      = require("../models/Wallet"); // adjust to your actual wallet model/path

// ── MENTEE: Check my latest request ──────────────────────────
const getMyRequest = async (req, res) => {
  try {
    const request = await LeapRequest.findOne({
      mentee: req.user._id,
      status: "pending",
    }).sort({ createdAt: -1 });

    if (!request) return res.status(404).json({ message: "No pending request" });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── MENTEE: Create a new request ──────────────────────────────
const createRequest = async (req, res) => {
  try {
    // Block duplicate pending requests
    const existing = await LeapRequest.findOne({
      mentee: req.user._id,
      status: "pending",
    });
    if (existing) {
      return res.status(400).json({ message: "A pending request already exists." });
    }

    // Fetch current wallet balance to snapshot it
    const wallet = await Wallet.findOne({ user: req.user._id });
    const currentBalance = wallet?.balance ?? 0;

    // Only allow if balance is 0
    if (currentBalance >= 500) {
      return res.status(400).json({ message: "You still have Leap Points remaining." });
    }

    const request = await LeapRequest.create({
      mentee: req.user._id,
      currentBalance,
    });

    res.status(201).json({ message: "Request submitted successfully.", request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADMIN: Get all requests ───────────────────────────────────
const getAllRequests = async (req, res) => {
  try {
    const requests = await LeapRequest.find()
      .populate("mentee", "name email profilePicture")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADMIN: Get pending count (for sidebar badge) ──────────────
const getPendingCount = async (req, res) => {
  try {
    const count = await LeapRequest.countDocuments({ status: "pending" });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADMIN: Approve — add 500 LP ───────────────────────────────
const approveRequest = async (req, res) => {
  try {
    const request = await LeapRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed." });
    }

    // Add 500 LP to the mentee's wallet
    const wallet = await Wallet.findOneAndUpdate(
      { user: request.mentee },
      { $inc: { balance: 500 } },
      { new: true, upsert: true }
    );

    // Mark request approved
    request.status     = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = req.admin?._id; // set if your adminAuth puts admin on req
    await request.save();

    res.json({
      message: "500 LP added successfully.",
      newBalance: wallet.balance,
      request,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── ADMIN: Reject ─────────────────────────────────────────────
const rejectRequest = async (req, res) => {
  try {
    const request = await LeapRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found." });
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed." });
    }

    request.status     = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = req.admin?._id;
    await request.save();

    res.json({ message: "Request rejected.", request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMyRequest,
  createRequest,
  getAllRequests,
  getPendingCount,
  approveRequest,
  rejectRequest,
};
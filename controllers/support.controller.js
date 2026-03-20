const SupportMessage = require("../models/SupportMessage");

exports.createMessage = async (req, res) => {
  try {
    const { email, subject, message, role } = req.body;
    if (!email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const msg = await SupportMessage.create({ email, subject, message, role: role || "user", status: "open" });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const msgs = await SupportMessage.find().sort({ createdAt: -1 });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.resolveMessage = async (req, res) => {
  try {
    const msg = await SupportMessage.findByIdAndUpdate(req.params.id, { status: "resolved" }, { new: true });
    if (!msg) return res.status(404).json({ error: "Not found" });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
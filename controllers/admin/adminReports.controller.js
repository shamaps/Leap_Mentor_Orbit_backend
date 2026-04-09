// backend/controllers/admin/adminReports.controller.js
const Report         = require("../../models/Report");
const User           = require("../../models/User");
const Wallet         = require("../../models/Wallet");
const Transaction    = require("../../models/Transaction");
const ConnectRequest = require("../../models/ConnectRequest");
const createNotification = require("../../utils/createNotification");
const {
  sendReportResolvedEmail,
} = require("../../utils/sendNotificationEmail");

const getReportStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalReports, pendingResolution, resolvedToday] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: { $in: ["open", "under_review"] } }),
      Report.countDocuments({ status: "resolved", resolvedAt: { $gte: today } }),
    ]);

    return res.json({ success: true, totalReports, pendingResolution, resolvedToday });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getReports = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(20, parseInt(req.query.limit) || 10);
    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim() || "";
    const skip   = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;

    if (search) {
      const matchingUsers = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id").lean();
      const userIds = matchingUsers.map((u) => u._id);
      filter.$or = [
        { reportedBy:   { $in: userIds } },
        { reportedUser: { $in: userIds } },
      ];
    }

    const [totalCount, reports] = await Promise.all([
      Report.countDocuments(filter),
      Report.find(filter)
        .populate("reportedBy",    "name email")
        .populate("reportedUser",  "name email")
        .populate("connectRequest", "status paymentStatus totalAmount sessionRate sessionCount mentee mentor")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const rows = reports.map((r) => ({
      id:               r._id,
      mentee:           r.reporterRole === "mentee" ? r.reportedBy?.name  : r.reportedUser?.name,
      menteeEmail:      r.reporterRole === "mentee" ? r.reportedBy?.email : r.reportedUser?.email,
      mentor:           r.reporterRole === "mentor" ? r.reportedBy?.name  : r.reportedUser?.name,
      mentorEmail:      r.reporterRole === "mentor" ? r.reportedBy?.email : r.reportedUser?.email,
      reportedBy:       r.reportedBy?.name   || "—",
      reportedById:     r.reportedBy?._id    || null,
      reportedUser:     r.reportedUser?.name || "—",
      reporterRole:     r.reporterRole,
      category:         r.complaintType,
      description:      r.description,
      screenshotUrl:    r.screenshotUrl || "",
      adminNote:        r.adminNote     || "",
      status:           r.status,
      refundProcessed:  r.refundProcessed || false,
      connectRequestId: r.connectRequest?._id || null,
      sessionStatus:    r.connectRequest?.status || null,
      paymentStatus:    r.connectRequest?.paymentStatus || null,
      totalAmount:      r.connectRequest?.totalAmount || 0,
      date: r.createdAt
        ? new Date(r.createdAt).toISOString().split("T")[0]
        : "—",
    }));

    return res.json({
      success: true,
      reports: rows,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages:  Math.ceil(totalCount / limit),
        hasMore:     page < Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const handleReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "Status must be resolved or dismissed." });
    }

    const report = await Report.findById(req.params.id)
      .populate("reportedBy",  "name email")
      .populate("reportedUser", "name email");

    if (!report) return res.status(404).json({ message: "Report not found." });

    report.status     = status;
    report.adminNote  = adminNote?.trim() || report.adminNote;
    report.resolvedAt = new Date();
    report.resolvedBy = req.admin._id;
    await report.save();

    // ── Notify reporter (in-app) ──
    const recipientId = report.reportedBy?._id;
    if (recipientId) {
      const otherPerson = report.reportedUser?.name || "the other user";
      await createNotification({
        recipient: recipientId,
        type:      "new_review",
        title:     status === "resolved"
          ? "Your report has been resolved ✅"
          : "Your report has been reviewed",
        message: status === "resolved"
          ? `Your complaint against ${otherPerson} has been resolved by our admin team.${adminNote ? ` Note: ${adminNote}` : ""}`
          : `Your complaint against ${otherPerson} was reviewed and dismissed.${adminNote ? ` Note: ${adminNote}` : ""}`,
        metadata: { requestId: report.connectRequest },
      });
    }

    // ── Notify reporter (email, non-blocking) ──
    if (report.reportedBy?.email) {
      sendReportResolvedEmail({
        reporterName:  report.reportedBy.name,
        reporterEmail: report.reportedBy.email,
        complaintType: report.complaintType,
        status,
        adminNote:     adminNote?.trim() || "",
      }).catch((err) => console.error("❌ sendReportResolvedEmail failed:", err.message));
    }

    return res.json({
      success: true,
      message: `Report ${status}.`,
      report: {
        id:         report._id,
        status:     report.status,
        adminNote:  report.adminNote,
        resolvedAt: report.resolvedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const processRefund = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reportedBy",    "name email")
      .populate("reportedUser",  "name email")
      .populate("connectRequest");

    if (!report) return res.status(404).json({ message: "Report not found." });
    if (report.reporterRole !== "mentee") {
      return res.status(403).json({
        message: "Only mentees can request refunds. Mentors do not make payments.",
      });
    }

    if (report.complaintType !== "refund") {
      return res.status(400).json({ message: "This report is not a refund request." });
    }
    if (report.refundProcessed) {
      return res.status(400).json({ message: "Refund already processed." });
    }

    const connectRequest = report.connectRequest;
    if (!connectRequest) return res.status(404).json({ message: "Session not found." });
    if (connectRequest.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Session has not been paid — nothing to refund." });
    }

    const menteeId    = connectRequest.mentee;
    const totalAmount = connectRequest.totalAmount || 0;

    const menteeWallet = await Wallet.findOne({ user: menteeId });
    if (!menteeWallet) return res.status(404).json({ message: "Mentee wallet not found." });

    const refundAmount = Math.min(totalAmount, menteeWallet.escrow);
    menteeWallet.escrow  = Math.max(0, menteeWallet.escrow - refundAmount);
    menteeWallet.balance += refundAmount;
    await menteeWallet.save();

    await Transaction.create({
      user:           menteeId,
      type:           "escrow_refund",
      amount:         refundAmount,
      description:    "Admin refund — report resolved",
      balanceAfter:   menteeWallet.balance,
      connectRequest: connectRequest._id,
    });

    connectRequest.paymentStatus = "refunded";
    connectRequest.status        = "rejected";
    await connectRequest.save();

    const resolvedAdminNote = req.body.adminNote?.trim() || "Refund processed by admin.";

    report.refundProcessed = true;
    report.refundedAt      = new Date();
    report.status          = "resolved";
    report.resolvedAt      = new Date();
    report.resolvedBy      = req.admin._id;
    report.adminNote       = resolvedAdminNote;
    await report.save();

    await createNotification({
      recipient: menteeId,
      type:      "new_review",
      title:     "Refund processed ✅",
      message:   `Your refund of ${refundAmount} tokens has been returned to your wallet by the admin team.`,
      metadata:  { requestId: connectRequest._id, amount: refundAmount },
    });

    // ── Email reporter (mentee) about refund resolution (non-blocking) ──
    if (report.reportedBy?.email) {
      sendReportResolvedEmail({
        reporterName:  report.reportedBy.name,
        reporterEmail: report.reportedBy.email,
        complaintType: report.complaintType,
        status:        "resolved",
        adminNote:     resolvedAdminNote,
      }).catch((err) => console.error("❌ sendReportResolvedEmail (refund) failed:", err.message));
    }

    return res.json({
      success: true,
      message: `Refund of ${refundAmount} tokens processed successfully.`,
      refundAmount,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const deleteSession = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reportedBy",   "name email")
      .populate("reportedUser", "name email")
      .populate({
        path: "connectRequest",
        populate: [
          { path: "mentee", select: "name email" },
          { path: "mentor", select: "name email" },
        ],
      });

    if (!report) return res.status(404).json({ message: "Report not found." });

    const connectRequest = report.connectRequest;
    if (!connectRequest) return res.status(404).json({ message: "Session not found or already deleted." });

    const menteeId   = connectRequest.mentee?._id || connectRequest.mentee;
    const mentorId   = connectRequest.mentor?._id || connectRequest.mentor;
    const menteeName = connectRequest.mentee?.name || "Mentee";
    const mentorName = connectRequest.mentor?.name || "Mentor";

    await ConnectRequest.findByIdAndDelete(connectRequest._id);

    if (menteeId) {
      await createNotification({
        recipient: menteeId,
        type:      "new_review",
        title:     "Session removed by admin",
        message:   `Your session with ${mentorName} has been removed by the admin team following a report.`,
        metadata:  { requestId: connectRequest._id },
      });
    }

    if (mentorId) {
      await createNotification({
        recipient: mentorId,
        type:      "new_review",
        title:     "Session removed by admin",
        message:   `Your session with ${menteeName} has been removed by the admin team following a report.`,
        metadata:  { requestId: connectRequest._id },
      });
    }

    const resolvedAdminNote = req.body.adminNote?.trim() || "Session deleted by admin.";

    report.adminNote  = resolvedAdminNote;
    report.status     = "resolved";
    report.resolvedAt = new Date();
    report.resolvedBy = req.admin._id;
    await report.save();

    // ── Email reporter about session deletion resolution (non-blocking) ──
    if (report.reportedBy?.email) {
      sendReportResolvedEmail({
        reporterName:  report.reportedBy.name,
        reporterEmail: report.reportedBy.email,
        complaintType: report.complaintType,
        status:        "resolved",
        adminNote:     resolvedAdminNote,
      }).catch((err) => console.error("❌ sendReportResolvedEmail (deleteSession) failed:", err.message));
    }

    return res.json({
      success: true,
      message: "Session deleted and both parties notified.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getReportStats, getReports, handleReport, processRefund, deleteSession };
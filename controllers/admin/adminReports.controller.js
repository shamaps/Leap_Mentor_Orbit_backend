// backend/controllers/admin/adminReports.controller.js
const Report             = require("../../models/Report");
const User               = require("../../models/User");
const Notification       = require("../../models/Notification");
const createNotification = require("../../utils/createNotification");

// ─────────────────────────────────────────────────────────────
// GET /api/admin/reports/stats
// ─────────────────────────────────────────────────────────────
const getReportStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalReports, pendingResolution, resolvedToday] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: { $in: ["open", "under_review"] } }),
      Report.countDocuments({ status: "resolved", resolvedAt: { $gte: today } }),
    ]);

    // Avg response time in hours
    const resolved = await Report.find({ status: "resolved", resolvedAt: { $ne: null } })
      .select("createdAt resolvedAt").lean();

    let avgResponseHrs = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, r) =>
        sum + (new Date(r.resolvedAt) - new Date(r.createdAt)), 0);
      avgResponseHrs = (totalMs / resolved.length / 1000 / 3600).toFixed(1);
    }

    return res.json({
      success: true,
      totalReports,
      pendingResolution,
      resolvedToday,
      avgResponseHrs: Number(avgResponseHrs),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/reports
// ─────────────────────────────────────────────────────────────
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
        .populate("reportedBy",   "name email")
        .populate("reportedUser", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const rows = reports.map((r) => ({
      id:            r._id,
      mentee:        r.reporterRole === "mentee" ? r.reportedBy?.name  : r.reportedUser?.name,
      menteeEmail:   r.reporterRole === "mentee" ? r.reportedBy?.email : r.reportedUser?.email,
      mentor:        r.reporterRole === "mentor" ? r.reportedBy?.name  : r.reportedUser?.name,
      mentorEmail:   r.reporterRole === "mentor" ? r.reportedBy?.email : r.reportedUser?.email,
      reportedBy:    r.reportedBy?.name   || "—",
      reportedById:  r.reportedBy?._id    || null,
      reportedUser:  r.reportedUser?.name || "—",
      reporterRole:  r.reporterRole,
      category:      r.complaintType,
      description:   r.description,
      screenshotUrl: r.screenshotUrl || "",
      adminNote:     r.adminNote     || "",
      status:        r.status,
      date:          r.createdAt
        ? new Date(r.createdAt).toISOString().split("T")[0]
        : "—",
      resolvedAt: r.resolvedAt
        ? new Date(r.resolvedAt).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })
        : null,
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

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/reports/:id
// Handle report — only "resolved" or "dismissed"
// Sends notification to the person who filed the report
// ─────────────────────────────────────────────────────────────
const handleReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    // ✅ Only resolved or dismissed allowed
    if (!["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({
        message: "Status must be 'resolved' or 'dismissed'.",
      });
    }

    const report = await Report.findById(req.params.id)
      .populate("reportedBy",   "name email")
      .populate("reportedUser", "name email");

    if (!report) return res.status(404).json({ message: "Report not found." });

    report.status     = status;
    report.adminNote  = adminNote?.trim() || report.adminNote;
    report.resolvedAt = new Date();
    report.resolvedBy = req.admin._id;

    await report.save();

    // ── Send notification to the person who filed the report ──
    // reportedBy = the user who submitted the complaint
    const recipientId = report.reportedBy?._id;

    if (recipientId) {
      const isResolved  = status === "resolved";
      const otherPerson = report.reportedUser?.name || "the other user";

      await createNotification({
        recipient: recipientId,
        type:      "new_review", // closest existing type in your enum
        title:     isResolved
          ? "Your report has been resolved ✅"
          : "Your report has been reviewed",
        message: isResolved
          ? `Your complaint against ${otherPerson} has been reviewed and resolved by our admin team.${adminNote ? ` Note: ${adminNote}` : ""}`
          : `Your complaint against ${otherPerson} was reviewed and dismissed by our admin team.${adminNote ? ` Note: ${adminNote}` : ""}`,
        metadata: {
          requestId: report.connectRequest,
        },
      });
    }

    return res.json({
      success: true,
      message: `Report ${status} successfully. Reporter notified.`,
      report: {
        id:        report._id,
        status:    report.status,
        adminNote: report.adminNote,
        resolvedAt: report.resolvedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getReportStats, getReports, handleReport };
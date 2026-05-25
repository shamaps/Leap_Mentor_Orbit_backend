const Report          = require("../models/Report");
const ConnectRequest  = require("../models/ConnectRequest");
const { cloudinary }  = require("../config/cloudinary");
const {
  sendReportSubmittedEmail,
  sendReportResolvedEmail,
} = require("../utils/sendNotificationEmail");

const uploadToCloudinary = (buffer, mimetype) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:           "leapmentor/reports",
        resource_type:    "image",
        allowed_formats:  ["jpg", "jpeg", "png", "webp"],
        transformation:   [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return reject(new Error(error.message ?? JSON.stringify(error)));
        resolve(result);
      }
    );
    stream.end(buffer);
  });

const submitReport = async (req, res) => {
  try {
    const { connectRequestId, complaintType, description } = req.body;
    const reportedById = req.user._id;

    if (!connectRequestId || !complaintType || !description) {
      return res.status(400).json({
        message: "connectRequestId, complaintType, and description are required.",
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        message: "Description must be at least 10 characters.",
      });
    }

    const connect = await ConnectRequest.findById(connectRequestId);
    if (!connect) {
      return res.status(404).json({ message: "Connect request not found." });
    }

    const isMentee = connect.mentee.toString() === reportedById.toString();
    const isMentor = connect.mentor.toString() === reportedById.toString();

    if (!isMentee && !isMentor) {
      return res.status(403).json({
        message: "You are not part of this connect request.",
      });
    }

    const reporterRole   = isMentee ? "mentee" : "mentor";
    const reportedUserId = isMentee ? connect.mentor : connect.mentee;

    const existing = await Report.findOne({
      connectRequest: connectRequestId,
      reportedBy:     reportedById,
    });

    if (existing) {
      return res.status(409).json({
        message: "You have already submitted a report for this session.",
      });
    }

    let screenshotUrl      = "";
    let screenshotPublicId = "";

    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
      screenshotUrl      = uploaded.secure_url;
      screenshotPublicId = uploaded.public_id;
    }

    const report = await Report.create({
      connectRequest:    connectRequestId,
      reportedBy:        reportedById,
      reportedUser:      reportedUserId,
      reporterRole,
      complaintType,
      description:       description.trim(),
      screenshotUrl,
      screenshotPublicId,
    });

    // ── Send report submitted email (non-blocking) ──
    sendReportSubmittedEmail({
      reporterName:  req.user.name,
      reporterEmail: req.user.email,
      complaintType,
      description:   description.trim(),
      reporterRole,
    }).catch((err) => console.error("❌ sendReportSubmittedEmail failed:", err.message));

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully. Our team will review it shortly.",
      report,
    });
  } catch (err) {
    console.error("❌ submitReport error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

const getMyReport = async (req, res) => {
  try {
    const { connectRequestId } = req.params;

    const report = await Report.findOne({
      connectRequest: connectRequestId,
      reportedBy:     req.user._id,
    }).lean();

    return res.status(200).json({ report: report || null });
  } catch (err) {
    console.error("❌ getMyReport error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const getAllReports = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Report.countDocuments(filter);

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("reportedBy",      "name email")
      .populate("reportedUser",    "name email")
      .populate("connectRequest",  "status totalAmount")
      .lean();

    return res.status(200).json({
      reports,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("❌ getAllReports error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, adminNote } = req.body;

    const VALID_STATUSES = ["open", "under_review", "resolved", "dismissed"];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const update = { status };
    if (adminNote !== undefined) update.adminNote = adminNote.trim();
    if (status === "resolved" || status === "dismissed") {
      update.resolvedAt = new Date();
      update.resolvedBy = req.user._id;
    }

    const report = await Report.findByIdAndUpdate(reportId, update, {
      new:           true,
      runValidators: true,
    })
      .populate("reportedBy",   "name email")
      .populate("reportedUser", "name email");

    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    // ── Send resolved/dismissed email only on terminal statuses (non-blocking) ──
    if (status === "resolved" || status === "dismissed") {
      sendReportResolvedEmail({
        reporterName:  report.reportedBy.name,
        reporterEmail: report.reportedBy.email,
        complaintType: report.complaintType,
        status,
        adminNote:     adminNote?.trim() || "",
      }).catch((err) => console.error("❌ sendReportResolvedEmail failed:", err.message));
    }

    return res.status(200).json({ success: true, report });
  } catch (err) {
    console.error("❌ updateReportStatus error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

module.exports = {
  submitReport,
  getMyReport,
  getAllReports,
  updateReportStatus,
};
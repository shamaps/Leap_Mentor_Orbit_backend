// backend/controllers/note.controller.js
const streamifier         = require("streamifier");
const { cloudinary }      = require("../config/cloudinary");
const Note                = require("../models/Note");
const ConnectRequest      = require("../models/ConnectRequest");
const { getFileType }     = require("../middleware/upload.middleware");

// ── Helper: validate user belongs to this session ─────────────
const validateSessionAccess = async (connectRequestId, userId) => {
  const request = await ConnectRequest.findById(connectRequestId)
    .select("mentor mentee status")
    .lean();
  if (!request) {
    return { valid: false, reason: "Session not found", status: 404 };
  }
  if (!["ongoing", "completed"].includes(request.status)) {
    return { valid: false, reason: "Session is not active", status: 400 };
  }
  const uid      = userId.toString();
  const isMentor = request.mentor.toString() === uid;
  const isMentee = request.mentee.toString() === uid;
  if (!isMentor && !isMentee) {
    return { valid: false, reason: "Not authorized", status: 403 };
  }
  return {
    valid:         true,
    uploaderRole:  isMentor ? "mentor" : "mentee",
    sessionStatus: request.status,
  };
};

// ── Helper: stream buffer to Cloudinary ───────────────────────
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// POST /api/notes/upload
const uploadNote = async (req, res) => {
  try {
    const { connectRequestId, title } = req.body;
    const userId    = req.user._id;
    const isPrivate = req.body.isPrivate === "true" || req.body.isPrivate === true;

    if (!connectRequestId) {
      return res.status(400).json({ message: "connectRequestId is required" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
      return res.status(access.status).json({ message: access.reason });
    }

    if (access.sessionStatus === "completed") {
      return res.status(400).json({ message: "Cannot upload notes to a completed session." });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder:          `leapmentor/notes/${connectRequestId}`,
      resource_type:   "raw",
      use_filename:    true,
      unique_filename: true,
    });

    const note = await Note.create({
      connectRequest: connectRequestId,
      uploadedBy:     userId,
      uploaderRole:   access.uploaderRole,
      title:          title?.trim() || req.file.originalname,
      fileUrl:        result.secure_url,
      publicId:       result.public_id,
      fileType:       getFileType(req.file.mimetype),
      fileName:       req.file.originalname,
      fileSize:       req.file.size,
      isPrivate,
    });

    const populated = await Note.findById(note._id)
      .populate("uploadedBy", "name email")
      .lean();

    return res.status(201).json({ success: true, message: "Note uploaded successfully", note: populated });
  } catch (err) {
    console.error("❌ uploadNote error:", err.message);
    if (err.message?.includes("File type not allowed")) {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
    }
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/notes/:connectRequestId — shared notes only
const getNotes = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id;

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
      return res.status(access.status).json({ message: access.reason });
    }

    const notes = await Note.find({
      connectRequest: connectRequestId,
      isPrivate: { $ne: true },
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, notes });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/notes/:connectRequestId/private — own private notes only
const getPrivateNotes = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const userId = req.user._id;

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
      return res.status(access.status).json({ message: access.reason });
    }

    const notes = await Note.find({
      connectRequest: connectRequestId,
      uploadedBy:     userId,
      isPrivate:      true,
    })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, notes });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/notes/:id
const deleteNote = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const note   = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (note.uploadedBy.toString() !== userId) {
      return res.status(403).json({ message: "You can only delete your own notes" });
    }

    try {
      await cloudinary.uploader.destroy(note.publicId, { resource_type: "raw" });
      console.log(`Cloudinary file deleted: ${note.publicId}`);
    } catch (cloudErr) {
      console.warn("Cloudinary delete warning:", cloudErr.message);
    }

    await Note.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Note deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { uploadNote, getNotes, getPrivateNotes, deleteNote };
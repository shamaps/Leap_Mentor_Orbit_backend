// services/note.service.js
const streamifier = require("streamifier");
const { cloudinary } = require("../config/cloudinary");
const { getFileType } = require("../middleware/upload.middleware");
const noteRepo = require("../repositories/note.repository");

const { logger } = require("@sentry/node");
// ── Helper: validate user belongs to this session ─────────────
const validateSessionAccess = async (connectRequestId, userId) => {
    const request = await noteRepo.findSessionParticipants(connectRequestId);
    if (!request) {
        return { valid: false, reason: "Session not found", status: 404 };
    }
    if (!["ongoing", "completed"].includes(request.status)) {
        return { valid: false, reason: "Session is not active", status: 400 };
    }
    const uid = userId.toString();
    const isMentor = request.mentor.toString() === uid;
    const isMentee = request.mentee.toString() === uid;
    if (!isMentor && !isMentee) {
        return { valid: false, reason: "Not authorized", status: 403 };
    }
    return {
        valid: true,
        uploaderRole: isMentor ? "mentor" : "mentee",
        sessionStatus: request.status,
    };
};

// ── Helper: stream buffer to Cloudinary ───────────────────────
const uploadToCloudinary = (buffer, options) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error) return reject(new Error(error.message ?? JSON.stringify(error)));
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

// ─────────────────────────────────────────────────────────────
// POST /api/notes/upload
// ─────────────────────────────────────────────────────────────
const uploadNote = async (userId, body, file) => {
    const { connectRequestId, title } = body;
    const isPrivate = body.isPrivate === "true" || body.isPrivate === true;

    if (!connectRequestId) {
        const err = new Error("connectRequestId is required");
        err.statusCode = 400;
        throw err;
    }
    if (!file) {
        const err = new Error("No file uploaded");
        err.statusCode = 400;
        throw err;
    }

    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    if (access.sessionStatus === "completed") {
        const err = new Error("Cannot upload notes to a completed session.");
        err.statusCode = 400;
        throw err;
    }

    const result = await uploadToCloudinary(file.buffer, {
        folder: `leapmentor/notes/${connectRequestId}`,
        resource_type: "raw",
        use_filename: true,
        unique_filename: true,
    });

    const note = await noteRepo.createNote({
        connectRequest: connectRequestId,
        uploadedBy: userId,
        uploaderRole: access.uploaderRole,
        title: title?.trim() || file.originalname,
        fileUrl: result.secure_url,
        publicId: result.public_id,
        fileType: getFileType(file.mimetype),
        fileName: file.originalname,
        fileSize: file.size,
        isPrivate,
    });

    const populated = await noteRepo.findNoteByIdPopulated(note._id);

    return { message: "Note uploaded successfully", note: populated };
};

// ─────────────────────────────────────────────────────────────
// GET /api/notes/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    const notes = await noteRepo.findSharedNotes(connectRequestId);
    return { notes };
};

// ─────────────────────────────────────────────────────────────
// GET /api/notes/:connectRequestId/private
// ─────────────────────────────────────────────────────────────
const getPrivateNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    const notes = await noteRepo.findPrivateNotes(connectRequestId, userId);
    return { notes };
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/notes/:id
// ─────────────────────────────────────────────────────────────
const deleteNote = async (noteId, userId) => {
    const note = await noteRepo.findNoteById(noteId);

    if (!note) {
        const err = new Error("Note not found");
        err.statusCode = 404;
        throw err;
    }
    if (note.uploadedBy.toString() !== userId.toString()) {
        const err = new Error("You can only delete your own notes");
        err.statusCode = 403;
        throw err;
    }

    try {
        await cloudinary.uploader.destroy(note.publicId, { resource_type: "raw" });
        logger.info(`Cloudinary file deleted: ${note.publicId}`);
    } catch (cloudErr) {
        logger.warn("Cloudinary delete warning:", cloudErr.message);
    }

    await noteRepo.deleteNoteById(noteId);

    return { message: "Note deleted successfully" };
};

module.exports = { uploadNote, getNotes, getPrivateNotes, deleteNote };
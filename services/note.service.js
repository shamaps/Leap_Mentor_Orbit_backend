// services/note.service.js

const { getFileType } = require("../middleware/upload.middleware");
const noteRepo = require("../repositories/note.repository");
const { ACTIVE_SESSION_STATUSES } = require("../config/constants");

const logger = require("../utils/logger");
const { validateSessionAccess } = require("../utils/sessionAccess");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");

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

    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
    }

    if (access.sessionStatus === "completed") {
        const err = new Error("Cannot upload notes to a completed session");
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
    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
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
    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
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
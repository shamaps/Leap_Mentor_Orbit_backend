// services/note.service.js
const { getFileType } = require("../middleware/upload.middleware");
const { validateSessionAccess } = require("../utils/sessionAccess");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const { noteId } = require("../utils/cloudinaryPublicId");
const AppError = require("../utils/appError");
const { cloudinary } = require("../config/cloudinary");
const createNoteService = (noteRepo, { logger }) => {
  // POST /api/notes/upload
const uploadNote = async (userId, body, file) => {
    const { connectRequestId, title } = body;
    const isPrivate = body.isPrivate === "true" || body.isPrivate === true;

    if (!connectRequestId) {
        throw new AppError(400, "connectRequestId is required");
    }
    if (!file) {
        throw new AppError(400, "No file uploaded");
    }

    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        throw new AppError(access.status, access.reason);
    }

    if (access.sessionStatus === "completed") {
        throw new AppError("Cannot upload notes to a completed session");
    }
    const isImage = file.mimetype.startsWith("image/");

    const uploadOptions = {
        resource_type: isImage ? "image" : "raw",
        public_id: noteId(connectRequestId, userId, file.originalname),
        type: "authenticated",
        overwrite: false,
    };

    // Only generate thumbnail for image files
    if (isImage) {
        uploadOptions.eager = [
            { width: 300, height: 200, crop: "fill", quality: "auto", fetch_format: "auto" },
        ];
        uploadOptions.eager_async = false;
    }
    const result = await uploadToCloudinary(file.buffer, uploadOptions);
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
        thumbnailUrl: result.eager?.[0]?.secure_url || "",
    });

    const populated = await noteRepo.findNoteByIdPopulated(note._id);

    return { message: "Note uploaded successfully", note: populated };
};


// GET /api/notes/:connectRequestId

const getNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        throw new AppError(access.status, access.reason);
    }

    const notes = await noteRepo.findSharedNotes(connectRequestId);
    // Sign each file URL — valid for 15 minutes
    const signedNotes = notes.map((note) => ({
        ...note,
        fileUrl: signCloudinaryUrl(note.publicId, note.fileType === "image" ? "image" : "raw"),
        thumbnailUrl: note.thumbnailUrl
            ? signCloudinaryUrl(note.publicId, "image")
            : "",
    }));
    return { notes: signedNotes };
};


// GET /api/notes/:connectRequestId/private

const getPrivateNotes = async (connectRequestId, userId) => {
    const access = await validateSessionAccess(noteRepo.findSessionParticipants, connectRequestId, userId);
    if (!access.valid) {
        throw new AppError(access.status, access.reason);
    }

    const notes = await noteRepo.findPrivateNotes(connectRequestId, userId);
    const signedNotes = notes.map((note) => ({
        ...note,
        fileUrl: signCloudinaryUrl(note.publicId, note.fileType === "image" ? "image" : "raw"),
        thumbnailUrl: note.thumbnailUrl
            ? signCloudinaryUrl(note.publicId, "image")
            : "",
    }));
    return { notes: signedNotes };
};


// DELETE /api/notes/:id

const deleteNote = async (noteId, userId) => {
    const note = await noteRepo.findNoteById(noteId);

    if (!note) {
        throw new AppError(400, "Note not found");
    }
    if (note.uploadedBy.toString() !== userId.toString()) {
        throw new AppError(403, "You can only delete your own notes");
    }

    try {
        const resourceType = note.fileType === "image" ? "image" : "raw";
        await cloudinary.uploader.destroy(note.publicId, { resource_type: resourceType });
        logger.info(`Cloudinary file deleted: ${note.publicId}`);
    } catch (cloudErr) {
        logger.warn("Cloudinary delete failed", { error: cloudErr.message, publicId: note.publicId });
    }

    await noteRepo.deleteNoteById(noteId);

    return { message: "Note deleted successfully" };
};
    return { uploadNote, getNotes, getPrivateNotes, deleteNote };
};
module.exports = createNoteService;

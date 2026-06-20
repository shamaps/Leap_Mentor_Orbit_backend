// services/note.service.js
const { getFileType } = require("../middleware/upload.middleware");
const { validateSessionAccess } = require("../utils/sessionAccess");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const { noteId } = require("../utils/cloudinaryPublicId");
const { cloudinary } = require("../config/cloudinary");
const createNoteService = (noteRepo, { logger }) => {
  // POST /api/notes/upload
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
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
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
        const err = new Error(access.reason);
        err.statusCode = access.status;
        throw err;
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
        const resourceType = note.fileType === "image" ? "image" : "raw";
        await cloudinary.uploader.destroy(note.publicId, { resource_type: resourceType });
        logger.info(`Cloudinary file deleted: ${note.publicId}`);
    } catch (cloudErr) {
        logger.warn("Cloudinary delete warning:", cloudErr.message);
    }

    await noteRepo.deleteNoteById(noteId);

    return { message: "Note deleted successfully" };
};
    return { uploadNote, getNotes, getPrivateNotes, deleteNote };
};
module.exports = createNoteService;

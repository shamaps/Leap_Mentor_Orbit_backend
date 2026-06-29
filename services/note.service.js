// services/note.service.js
const { getFileType } = require("../middleware/upload.middleware");
const { validateSessionAccess } = require("../utils/sessionAccess");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const { noteId } = require("../utils/cloudinaryPublicId");
const AppError = require("../utils/appError");
const { cloudinary } = require("../config/cloudinary");

/**
 * @typedef {Object} NoteRepository
 * @property {(connectRequestId: string) => Promise<Object|null>} findSessionParticipants - Resolves matching participant structural configs.
 * @property {(data: Object) => Promise<Object>} createNote - Registers a fresh shared or private attachment document row.
 * @property {(noteId: any) => Promise<Object|null>} findNoteByIdPopulated - Pulls saved attachment structures populated with uploader parameters.
 * @property {(connectRequestId: string) => Promise<Object[]>} findSharedNotes - Aggregates non-private documents mapped underneath target sessions.
 * @property {(connectRequestId: string, userId: any) => Promise<Object[]>} findPrivateNotes - Isolates private notes owned specifically by the caller.
 * @property {(noteId: string) => Promise<Object|null>} findNoteById - Resolves an interactive Mongoose note row for mutations.
 * @property {(noteId: string) => Promise<Object|null>} deleteNoteById - Hard discards record metadata rows from database tables.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine structural transformations.
 * @property {(message: string, meta?: Object) => void} warn - Logs external storage service destruction fault warnings.
 */

/**
 * Factory function constructing the core execution logic layer for processing mentorship attachment uploads.
 * * @param {NoteRepository} noteRepo - Data registry persistence abstraction instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured service interface containing document workflow methods.
 */
const createNoteService = (noteRepo, { logger }) => {
    // POST /api/notes/upload
    /**
     * Processes binary attachments, pushes files to secure Cloudinary buckets, and persists metadata structures.
     * * @async
     * @function uploadNote
     * @param {any} userId - Authenticated user credential validation key checking file ownership.
     * @param {Object} body - Inbound text parameters package mapping criteria body.
     * @param {string} body.connectRequestId - Associated unique target platform session channel index.
     * @param {string} [body.title] - Custom title text overriding default fallback file names.
     * @param {string|boolean} [body.isPrivate] - Explicit privacy visibility string flag evaluation state.
     * @param {Object} file - Multipart incoming file descriptor chunk containing memory buffers.
     * @param {string} file.originalname - Original source attachment file name.
     * @param {string} file.mimetype - Validated file format mime header.
     * @param {Buffer} file.buffer - Raw binary data payload stream mapping.
     * @param {number} file.size - Total file size measured in bytes.
     * @throws {AppError} 400 - If required indices or uploaded file chunks are missing.
     * @throws {AppError} 403 - If session token credentials fail relationship validation check boundaries.
     * @throws {AppError} 404 - If structural database queries return an uninitialized parent record.
     * @returns {Promise<{message: string, note: Object}>} Newly created populated note record data confirmation layout.
     */
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

    /**
     * Returns all shared non-private attachment documents, affixing transient crypto-signed Cloudinary download URLs.
     * * @async
     * @function getNotes
     * @param {string} connectRequestId - Dialogue pipeline lookup index key string.
     * @param {any} userId - Secure user verification signature key tracking active permissions.
     * @throws {AppError} 403 - If session tokens fail relationship checks.
     * @throws {AppError} 404 - If database query loops return empty session indicators.
     * @returns {Promise<{notes: Object[]}>} Collection detailing authorized document assets mapping signed parameters.
     */
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

    /**
     * Isolates and appends crypto-signed links onto private personal attachments belonging exclusively to the caller.
     * * @async
     * @function getPrivateNotes
     * @param {string} connectRequestId - Associated unique dynamic communication lane index.
     * @param {any} userId - Performing account token identification pointer checking boundaries.
     * @throws {AppError} 403 - If session tokens fail relationship validations.
     * @returns {Promise<{notes: Object[]}>} Collection array describing isolated personal nodes.
     */
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

    /**
     * Erases bucket asset storage allocations before executing structural database entry deletions.
     * Enforces ownership restrictions ensuring users can only purge self-created structures.
     * * @async
     * @function deleteNote
     * @param {string} noteId - Primary system lookup locator string parameter.
     * @param {any} userId - Security context validation verification pointer checking ownership credentials.
     * @throws {AppError} 400 - If the target document is absent inside data registries.
     * @throws {AppError} 403 - If identity indicators reveal a mismatch against uploader fields.
     * @returns {Promise<{message: string}>} Structural textual confirmation message.
     */
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
// controllers/note.controller.js
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");
const { ok, created, fail, noContent } = require("../utils/response"); 
const createNoteController = (noteService, { logger }) => {
// POST /api/notes/upload

const uploadNote = async (req, res) => {
  try {
    const data = await noteService.uploadNote(req.user._id, req.body, req.file);
    logger.info("uploadNote completed successfully");
    return created(res, data);
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return fail(res, "File too large. Maximum size is 10MB.", 400);
    }
    return handleError(res, err, "note.uploadNote");
  }
};


// GET /api/notes/:connectRequestId

const getNotes = async (req, res) => {
  try {
    const data = await noteService.getNotes(req.params.connectRequestId, req.user._id);
    logger.info("getNotes completed successfully");
    return ok(res, data);
  } catch (err) {
        return handleError(res, err, "note.getNotes");
  }
};


// GET /api/notes/:connectRequestId/private

const getPrivateNotes = async (req, res) => {
  try {
    const data = await noteService.getPrivateNotes(req.params.connectRequestId, req.user._id);
    logger.info("getPrivateNotes completed successfully");
    return ok(res, data);
  } catch (err) {
     return handleError(res, err, "note.getPrivateNotes");
  }
};


// DELETE /api/notes/:id

const deleteNote = async (req, res) => {
  try {
    await noteService.deleteNote(req.params.id, req.user._id);
    logger.info("deleteNote completed successfully");
    return noContent(res);
  } catch (err) {
      return handleError(res, err, "note.deleteNote");
  }
};
  return { uploadNote, getNotes, getPrivateNotes, deleteNote };
};
module.exports = createNoteController;
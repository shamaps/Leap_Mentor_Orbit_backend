// controllers/privateNote.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");
const createPrivateNoteController = (privateNoteService, { logger }) => {
// POST /api/private-notes

const createNote = async (req, res) => {
  try {
    const data = await privateNoteService.createNote(req.user._id, req.body);
    logger.info("createNote completed successfully");
    return created(res, data);
  } catch (err) {
        return handleError(res, err, "privateNote.createNote");
  }
};


// GET /api/private-notes/:connectRequestId

const getNotes = async (req, res) => {
  try {
    const data = await privateNoteService.getNotes(req.params.connectRequestId, req.user._id);
    logger.info("getNotes completed successfully");
    return ok(res, data);
  } catch (err) {
        return handleError(res, err, "privateNote.getNotes");
  }
};


// PATCH /api/private-notes/:id

const updateNote = async (req, res) => {
  try {
    const data = await privateNoteService.updateNote(req.params.id, req.user._id, req.body);
    logger.info("updateNote completed successfully");
    return ok(res, data);
  } catch (err) {
        return handleError(res, err, "privateNote.updateNote");
  }
};


// DELETE /api/private-notes/:id

const deleteNote = async (req, res) => {
  try {
    await privateNoteService.deleteNote(req.params.id, req.user._id);
    logger.info("deleteNote completed successfully");
    return noContent(res);
  } catch (err) {
        return handleError(res, err, "privateNote.deleteNote");
  }
};

  return { createNote, getNotes, updateNote, deleteNote };
};
module.exports = createPrivateNoteController;
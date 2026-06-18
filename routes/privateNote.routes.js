// backend/routes/privateNote.routes.js
const express = require("express");
const router  = express.Router();

const { authenticate } = require("../middleware/authenticate");
const { privateNoteController } = require("../config/container");
const {
    createNote, getNotes, updateNote, deleteNote,
} = privateNoteController;
// POST   /api/private-notes                    — create a note
router.post("/",                authenticate, createNote);

// GET    /api/private-notes/:connectRequestId  — get all notes for session
router.get("/:connectRequestId", authenticate, getNotes);

// PATCH  /api/private-notes/:id               — update a note
router.patch("/:id",             authenticate, updateNote);

// DELETE /api/private-notes/:id               — delete a note
router.delete("/:id",            authenticate, deleteNote);

module.exports = router;
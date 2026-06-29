// backend/routes/privateNote.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { createNoteSchema, updateNoteSchema } = require("../validators/privateNote.validator");
const { authenticate } = require("../middleware/authenticate");
const { privateNoteController } = require("../config/container");
const {
    createNote, getNotes, updateNote, deleteNote,
} = privateNoteController;

/**
 * @openapi
 * /private-notes/{id}:
 *   patch:
 *     tags: [PrivateNotes]
 *     summary: Update a private note
 *     description: At least one of title/content is required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               content:
 *                 type: string
 *                 maxLength: 10000
 *     responses:
 *       200:
 *         description: Note updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed — body must include at least one field.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not the note owner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST   /api/private-notes                    — create a note
router.patch("/:id", authenticate, validate(updateNoteSchema), updateNote);

/**
 * @openapi
 * /private-notes/{connectRequestId}:
 *   get:
 *     tags: [PrivateNotes]
 *     summary: Get all private notes for a session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of private notes.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET    /api/private-notes/:connectRequestId  — get all notes for session
router.get("/:connectRequestId", authenticate, getNotes);

/**
 * @openapi
 * /private-notes:
 *   post:
 *     tags: [PrivateNotes]
 *     summary: Create a private note
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectRequestId]
 *             properties:
 *               connectRequestId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a44"
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Prep notes"
 *               content:
 *                 type: string
 *                 maxLength: 10000
 *     responses:
 *       201:
 *         description: Note created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// PATCH  /api/private-notes/:id               — update a note
router.post("/", authenticate, validate(createNoteSchema), createNote);

/**
 * @openapi
 * /private-notes/{id}:
 *   delete:
 *     tags: [PrivateNotes]
 *     summary: Delete a private note
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Note deleted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not the note owner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// DELETE /api/private-notes/:id               — delete a note
router.delete("/:id", authenticate, deleteNote);

module.exports = router;

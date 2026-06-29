// backend/routes/note.routes.js
const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/authenticate");
const { upload } = require("../middleware/upload.middleware");
const { noteController } = require("../config/container");
const {
  uploadNote, getNotes, getPrivateNotes, deleteNote,
} = noteController;

/**
 * @openapi
 * /notes/upload:
 *   post:
 *     tags: [Notes]
 *     summary: Upload a note file (shared or private)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, connectRequestId]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               connectRequestId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a44"
 *               visibility:
 *                 type: string
 *                 enum: [shared, private]
 *     responses:
 *       201:
 *         description: Note uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Missing file or invalid file type.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /api/notes/upload — upload a note (shared or private)
router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  uploadNote
);

/**
 * @openapi
 * /notes/{connectRequestId}/private:
 *   get:
 *     tags: [PrivateNotes]
 *     summary: Get the logged-in user's own private notes for a session
 *     description: Route is registered before /:connectRequestId to avoid being shadowed by the generic shared-notes route.
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
 *         description: List of own private notes.
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
// ✅ /private MUST come before /:connectRequestId
// GET /api/notes/:connectRequestId/private — own private notes
router.get(
  "/:connectRequestId/private",
  authenticate,
  getPrivateNotes
);

/**
 * @openapi
 * /notes/{connectRequestId}:
 *   get:
 *     tags: [Notes]
 *     summary: Get shared notes for a session
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
 *         description: List of shared notes.
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
// GET /api/notes/:connectRequestId — shared notes
router.get(
  "/:connectRequestId",
  authenticate,
  getNotes
);

/**
 * @openapi
 * /notes/{id}:
 *   delete:
 *     tags: [Notes]
 *     summary: Delete a note
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
// DELETE /api/notes/:id
router.delete(
  "/:id",
  authenticate,
  deleteNote
);

module.exports = router;

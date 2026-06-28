// routes/mentorSearch.routes.js
const express = require("express");
const router = express.Router();
const { mentorSearchController } = require("../config/container");
const { searchMentors, autocompleteMentors } = mentorSearchController;
const { authenticate, requireRole } = require("../middleware/authenticate");
const { searchQuerySchema } = require("../validators/mentorSearch.validator");
const validate = require("../middleware/validate");

/**
 * @openapi
 * /mentors/search:
 *   get:
 *     tags: [MentorSearch]
 *     summary: Search and autocomplete mentors
 *     description: Mentee role only. Uses Atlas Search (autocomplete + text operators) with role/isDeleted filters and regex fallback.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *           maxLength: 100
 *         example: "react"
 *       - name: industry
 *         in: query
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - name: skills
 *         in: query
 *         schema:
 *           type: string
 *           maxLength: 200
 *         example: "Node.js,System Design"
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Paginated list of matching mentors.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         mentors:
 *                           type: array
 *                           items:
 *                             type: object
 *                         total:
 *                           type: integer
 *                           example: 42
 *                         page:
 *                           type: integer
 *                           example: 1
 *       400:
 *         description: Invalid query params.
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
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/mentors/search — only mentees search for mentors
router.get("/search", authenticate, requireRole("mentee"), validate(searchQuerySchema, "query"), searchMentors);
module.exports = router;

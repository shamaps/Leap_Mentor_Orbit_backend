// backend/routes/ai.route.js
const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const { fail } = require("../utils/response");
const { getTraceId } = require("../utils/requestContext");
const { authenticate } = require("../middleware/authenticate");
const { aiLimiter } = require("../middleware/rateLimiter");
logger.info("Groq API key status", { loaded: !!process.env.GROQ_API_KEY });

/**
 * @openapi
 * /ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Groq-powered help center chat proxy
 *     description: Rate-limited via aiLimiter. Forwards messages + systemPrompt to Groq (llama-3.1-8b-instant), 10s timeout.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *               systemPrompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response, reformatted to match the shape HelpCenter.jsx expects.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         example: text
 *                       text:
 *                         type: string
 *       400:
 *         description: messages array missing or not an array.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             example:
 *               error: "messages array is required"
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Groq API returned an error (raw vendor error is never forwarded to the client).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "AI service temporarily unavailable"
 *       504:
 *         description: Groq API did not respond within 10 seconds.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "AI service timed out"
 */
router.post("/chat", authenticate, aiLimiter, async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // Abort if Groq takes longer than 10s — prevents hung connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "X-Trace-Id": getTraceId(),
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 1000,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        logger.error("Groq API timed out after 10s");
        return fail(res, "AI service timed out", 504);
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      // Log full Groq error internally — never forward raw vendor error to client
      logger.error("Groq API error", { status: response.status, errorCode: data?.error?.code });
      return fail(res, "AI service temporarily unavailable", 502);
    }

    // Reformat to match shape HelpCenter.jsx expects
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });

  } catch (err) {
    logger.error("AI proxy error", { error: err.message, stack: err.stack });
    return fail(res, "AI service unavailable", 500);
  }
});

module.exports = router;

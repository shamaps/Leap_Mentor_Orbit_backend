// backend/routes/ai.route.js
const express = require("express");
const router  = express.Router();
const logger = require("../utils/logger");

console.log("GROQ KEY LOADED:", process.env.GROQ_API_KEY ? "YES ✅" : "NO ❌");

/**
 * POST /api/ai/chat
 * Body: { messages: [...], systemPrompt: "..." }
 * Proxies to Groq (free, fast LLM API)
 */
router.post("/chat", async (req, res) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:      "llama-3.1-8b-instant",
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("Groq API error", { status: response.status, response: data });
      return res.status(502).json({ error: "AI service temporarily unavailable" });
    }

    // Reformat to match shape HelpCenter.jsx expects
    const text = data.choices?.[0]?.message?.content || "";
    res.json({ content: [{ type: "text", text }] });

  } catch (err) {
    logger.error("AI proxy error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "AI service unavailable" });
  }
});

module.exports = router;
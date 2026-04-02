/**
 * app/api/routes/chat.route.js
 *
 * Handles the POST /api/chat-onboarding endpoint.
 *
 * This powers the mobile app's conversational onboarding interface.
 * The frontend holds all conversation state and sends the full history
 * on every request. The AI responds with the next message in the conversation.
 *
 * Flow:
 *  1. Validate the messages array with Zod.
 *  2. Dispatch to the AI Strategy Controller → chatWithAssistant().
 *  3. Return { success: true, reply: "AI text here..." }.
 */

import { Router } from "express";
import { zodChatSchema } from "../../schemas/chat.schema.js";
import { chatWithAssistant } from "../../services/ai.service.js";

const router = Router();

/**
 * POST /api/chat-onboarding
 *
 * Body:
 * {
 *   "messages": [
 *     { "role": "user", "content": "I want to start a business" },
 *     { "role": "assistant", "content": "That's exciting! What kind of..." },
 *     { "role": "user", "content": "Something with food delivery..." }
 *   ]
 * }
 *
 * Success Response 200:
 * { "success": true, "reply": "Great! Who would your main customers be?..." }
 *
 * Validation Error 400:
 * { "success": false, "message": "Validation failed.", "errors": [...] }
 *
 * Server / AI Error 500:
 * { "success": false, "message": "..." }
 */
router.post("/", async (req, res, next) => {
  // ── Step 1: Validate the request body ──────────────────────────────────────
  const validation = zodChatSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed. Please check your request.",
      errors: validation.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  const { messages } = validation.data;

  // ── Step 2: Dispatch to the AI Strategy Controller ──────────────────────────
  try {
    const reply = await chatWithAssistant(messages);

    // ── Step 3: Return the AI's reply ─────────────────────────────────────────
    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

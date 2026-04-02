/**
 * app/api/routes/analyzeIdea.route.js
 *
 * Defines and handles the POST /api/analyze-idea endpoint.
 *
 * Responsibilities:
 *  1. Validates the incoming request body with Zod.
 *  2. Delegates AI analysis to the Strategy Controller (ai.service.js),
 *     which internally routes to OpenAI or Anthropic based on AI_PROVIDER.
 *  3. Returns a clean, structured JSON response.
 *  4. Passes all errors to the global error handler via next().
 */

import { Router } from "express";
import { zodRequestSchema } from "../../schemas/analyzeIdea.schema.js";
import { analyzeBusinessIdea } from "../../services/ai.service.js";

const router = Router();

/**
 * POST /api/analyze-idea
 *
 * Body: { "businessIdea": "string" }
 *
 * Success Response 200:
 * {
 *   "success": true,
 *   "report": { ...IdeaAnalysisReport }
 * }
 *
 * Validation Error 400:
 * {
 *   "success": false,
 *   "message": "Validation failed.",
 *   "errors": [ ...ZodError details ]
 * }
 *
 * Server / AI Error 500:
 * {
 *   "success": false,
 *   "message": "..."
 * }
 */
router.post("/", async (req, res, next) => {
  // ── Step 1: Validate the request body ──────────────────────────────────────
  const validation = zodRequestSchema.safeParse(req.body);

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

  const { businessIdea } = validation.data;

  // ── Step 2: Dispatch to the AI Strategy Controller ──────────────────────────
  try {
    const report = await analyzeBusinessIdea(businessIdea);

    // ── Step 3: Return the structured report ─────────────────────────────────
    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error) {
    // Pass to the global errorHandler middleware in server.js
    return next(error);
  }
});

export default router;

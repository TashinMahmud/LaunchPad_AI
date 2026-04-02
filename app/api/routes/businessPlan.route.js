/**
 * app/api/routes/businessPlan.route.js
 *
 * Handles the POST /api/generate-business-plan endpoint.
 *
 * Flow:
 *  1. Validate the request body with Zod (includes userEmail).
 *  2. Dispatch to the AI Strategy Controller → generateBusinessPlan().
 *  3. Return { success: true, plan: BusinessPlan } to the frontend immediately.
 *  4. [Fire & Forget] POST the plan + userEmail to the n8n webhook asynchronously.
 *     This triggers the PDF generation & email delivery pipeline without
 *     blocking or delaying the Express response in any way.
 */

import { Router } from "express";
import { zodBusinessPlanSchema } from "../../schemas/businessPlan.schema.js";
import { generateBusinessPlan } from "../../services/ai.service.js";
import { config } from "../../core/config.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Fire-and-Forget n8n Webhook Dispatch
// Called AFTER the Express response has already been sent. Any failure here
// is logged to the console but never surfaces to the user.
// ─────────────────────────────────────────────────────────────────────────────

const dispatchToN8n = (userEmail, plan) => {
  // If N8N_WEBHOOK_URL is not configured, skip silently (already warned at startup).
  if (!config.n8nWebhookUrl) return;

  // Intentionally NOT awaited — this runs in the background after the response.
  fetch(config.n8nWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userEmail, businessPlan: plan }),
  })
    .then((res) => {
      if (!res.ok) {
        console.warn(
          `⚠️   [n8n] Webhook responded with non-OK status: ${res.status} ${res.statusText}`
        );
      } else {
        console.log(
          `📨  [n8n] Business plan dispatched successfully for: ${userEmail}`
        );
      }
    })
    .catch((err) => {
      // Network failure, n8n down, etc. — log it, never throw.
      console.error(
        `🔴  [n8n] Webhook dispatch failed for ${userEmail}:`,
        err.message
      );
    });
};

/**
 * POST /api/generate-business-plan
 *
 * Body:
 * {
 *   "userEmail": "founder@example.com",
 *   "businessName": "FarmDrop",
 *   "businessIdea": "A mobile app connecting local farmers with urban consumers",
 *   "structure": "LLC",
 *   "location": "Austin, TX"
 * }
 *
 * Success Response 200:
 * {
 *   "success": true,
 *   "plan": {
 *     "companyName": "FarmDrop",
 *     "executiveSummary": "...",
 *     "missionStatement": "...",
 *     "targetMarket": "...",
 *     "productsAndServices": ["...", "...", "..."],
 *     "revenueModel": "...",
 *     "marketingStrategy": ["...", "...", "..."]
 *   }
 * }
 *
 * Side Effect (async, non-blocking):
 *   If N8N_WEBHOOK_URL is configured, the plan is POSTed to n8n which
 *   generates a PDF and emails it to userEmail. This happens AFTER the
 *   200 response is already delivered to the frontend.
 *
 * Validation Error 400:
 * { "success": false, "message": "Validation failed.", "errors": [...] }
 *
 * Server / AI Error 500:
 * { "success": false, "message": "..." }
 */
router.post("/", async (req, res, next) => {
  // ── Step 1: Validate the request body ──────────────────────────────────────
  const validation = zodBusinessPlanSchema.safeParse(req.body);

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

  // Destructure userEmail separately — it's for n8n, not the AI service.
  const { userEmail, ...planData } = validation.data;

  // ── Step 2: Dispatch to the AI Strategy Controller ──────────────────────────
  try {
    const plan = await generateBusinessPlan(planData);

    // ── Step 3: Respond to the frontend immediately ───────────────────────────
    res.status(200).json({
      success: true,
      plan,
    });

    // ── Step 4: Fire & Forget → n8n PDF + Email Pipeline ─────────────────────
    // Called synchronously but NOT awaited. The response above has already been
    // flushed to the client. This runs as a detached promise in the background.
    dispatchToN8n(userEmail, plan);
  } catch (error) {
    return next(error);
  }
});

export default router;


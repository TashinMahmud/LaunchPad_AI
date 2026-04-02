/**
 * app/api/routes/funding.route.js
 *
 * Handles the POST /api/match-funding endpoint.
 *
 * This powers the platform's Funding Center. Given a user's business profile,
 * it returns 3-4 AI-matched funding opportunities (grants, loans, SBA programs)
 * tailored to their location, stage, business type, and credit estimate.
 *
 * Flow:
 *  1. Validate the userProfile object with Zod.
 *  2. Dispatch to the AI Strategy Controller → matchFunding().
 *  3. Return { success: true, matches: FundingMatch[] }.
 */

import { Router } from "express";
import { zodFundingSchema } from "../../schemas/funding.schema.js";
import { matchFunding } from "../../services/ai.service.js";

const router = Router();

/**
 * POST /api/match-funding
 *
 * Body:
 * {
 *   "userProfile": {
 *     "businessType": "Food truck selling vegan street tacos",
 *     "location": "Austin, TX",
 *     "stage": "Pre-revenue",
 *     "creditEstimate": "Fair"
 *   }
 * }
 *
 * Success Response 200:
 * {
 *   "success": true,
 *   "matches": [
 *     {
 *       "programName": "SBA Microloan Program",
 *       "type": "Microloan",
 *       "amountRange": "$500 - $50,000",
 *       "matchScore": 87,
 *       "keyRequirements": ["...", "...", "..."],
 *       "deadline": "Rolling",
 *       "difficulty": "Medium"
 *     },
 *     ...
 *   ]
 * }
 *
 * Validation Error 400:
 * { "success": false, "message": "Validation failed.", "errors": [...] }
 *
 * Server / AI Error 500:
 * { "success": false, "message": "..." }
 */
router.post("/", async (req, res, next) => {
  // ── Step 1: Validate the request body ──────────────────────────────────────
  const validation = zodFundingSchema.safeParse(req.body);

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

  const { userProfile } = validation.data;

  // ── Step 2: Dispatch to the AI Strategy Controller ──────────────────────────
  try {
    const matches = await matchFunding(userProfile);

    // ── Step 3: Return the funding matches ────────────────────────────────────
    return res.status(200).json({
      success: true,
      matches,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

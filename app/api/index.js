/**
 * app/api/index.js
 *
 * Central API router. This is the single file imported by server.js.
 * All future endpoint routes are registered here, keeping server.js clean.
 *
 * Current routes:
 *  POST /api/analyze-idea          →  analyzeIdea.route.js
 *  POST /api/chat-onboarding       →  chat.route.js
 *  POST /api/match-funding         →  funding.route.js
 *  POST /api/generate-business-plan →  businessPlan.route.js
 */

import { Router } from "express";
import analyzeIdeaRouter from "./routes/analyzeIdea.route.js";
import chatRouter from "./routes/chat.route.js";
import fundingRouter from "./routes/funding.route.js";
import businessPlanRouter from "./routes/businessPlan.route.js";

const apiRouter = Router();

// Mount sub-routers
apiRouter.use("/analyze-idea", analyzeIdeaRouter);
apiRouter.use("/chat-onboarding", chatRouter);
apiRouter.use("/match-funding", fundingRouter);
apiRouter.use("/generate-business-plan", businessPlanRouter);

// ── Health Check ─────────────────────────────────────────────────────────────
// A lightweight endpoint to confirm the API is running.
// Useful for deployment health checks and local testing.
apiRouter.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    service: "LaunchPad AI API",
    timestamp: new Date().toISOString(),
  });
});

export default apiRouter;

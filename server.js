/**
 * server.js
 *
 * LaunchPad AI — Express Application Entry Point
 *
 * Startup sequence:
 *  1. config.js loads and validates env vars (crashes fast if missing)
 *  2. Express app is created and configured
 *  3. API routes are mounted at /api
 *  4. Global error handler is registered LAST
 *  5. Server begins listening
 */

import "./app/core/config.js"; // Must be first — validates env vars before anything else
import express from "express";
import cors from "cors";
import { config } from "./app/core/config.js";
import apiRouter from "./app/api/index.js";
import { errorHandler } from "./app/utils/errorHandler.js";

// ─────────────────────────────────────────────────────────────────────────────
// App Initialization
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────────────────────────────────────

// Enable CORS for all origins (frontend-ready for local testing)
// TODO (Phase 2): Restrict to specific frontend origin in production
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Log every incoming request to the console (development convenience)
app.use((req, _res, next) => {
  console.log(`➡️   [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Mount all API routes under the /api prefix
app.use("/api", apiRouter);

// Handle requests to unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler — MUST be registered after all routes
// ─────────────────────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log("");
  console.log("┌─────────────────────────────────────────────────┐");
  console.log("│          🚀  LaunchPad AI — Backend API          │");
  console.log("├─────────────────────────────────────────────────┤");
  console.log(`│  Status : ✅  Running                            │`);
  console.log(`│  Port   : ${config.port}                                │`);
  console.log(`│  Health : http://localhost:${config.port}/api/health      │`);
  console.log(`│  Endpoint: POST /api/analyze-idea               │`);
  console.log("└─────────────────────────────────────────────────┘");
  console.log("");
});

/**
 * app/core/config.js
 *
 * Loads and exposes all environment configuration.
 *
 * Startup validation strategy:
 *  - AI_PROVIDER must be 'openai' or 'anthropic'. Crash immediately if invalid —
 *    a wrong provider value means the whole AI engine is misconfigured.
 *  - API keys & webhook URLs are NOT validated at startup. The app boots freely
 *    with whatever is set. Missing keys throw runtime errors at the point of use;
 *    a missing N8N_WEBHOOK_URL logs a soft warning (PDF delivery silently skipped).
 */

import "dotenv/config";

// ─────────────────────────────────────────────────────────────────────────────
// Validate the AI_PROVIDER value at startup — it controls the entire engine.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PROVIDERS = ["openai", "anthropic", "groq"];
const aiProvider = (process.env.AI_PROVIDER || "openai").toLowerCase();

if (!VALID_PROVIDERS.includes(aiProvider)) {
  console.error(
    `\n❌  FATAL: Invalid AI_PROVIDER value: "${process.env.AI_PROVIDER}"\n` +
      `   Accepted values are: ${VALID_PROVIDERS.join(", ")}\n` +
      `   Please update your .env file.\n`
  );
  process.exit(1);
}

console.log(`🔧  AI Engine configured → provider: "${aiProvider}"`);

// ─────────────────────────────────────────────────────────────────────────────
// Exported config object
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,

  /** Which AI provider is active. Either 'openai', 'anthropic', or 'groq'. */
  aiProvider,

  openai: {
    /** May be undefined — checked at runtime inside the service. */
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-2024-08-06", // Required for strict: true structured outputs
  },

  anthropic: {
    /** May be undefined — checked at runtime inside the service. */
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-3-5-sonnet-20241022",
  },

  groq: {
    /** May be undefined — checked at runtime inside the service. */
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-specdec",
  },

  /**
   * n8n webhook URL for the Business Plan PDF Generator & Emailer workflow.
   * Optional — if not set the plan is still returned to the frontend normally;
   * the PDF email delivery step is silently skipped with a console warning.
   * Set this to the URL shown in your n8n webhook node (e.g. https://your-n8n.com/webhook/business-plan-pdf).
   */
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || null,
};

// Warn (don't crash) if the n8n webhook URL is absent — local dev still works fine.
if (!process.env.N8N_WEBHOOK_URL) {
  console.warn(
    `⚠️   N8N_WEBHOOK_URL is not set. Business plans will be returned to the frontend ` +
      `but will NOT trigger the PDF email workflow. Set it in .env when ready.`
  );
}


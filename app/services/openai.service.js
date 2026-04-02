/**
 * app/services/openai.service.js
 *
 * Encapsulates all communication with the OpenAI API.
 * The route layer calls this service and never touches the OpenAI SDK directly.
 *
 * Uses GPT-4o Structured Outputs (strict: true) to guarantee that the
 * response is always a valid IdeaAnalysisReport — no extra parsing needed.
 */

import OpenAI from "openai";
import { config } from "../core/config.js";
import { openAiJsonSchema } from "../schemas/analyzeIdea.schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Client — Instantiated once and reused across all requests
// ─────────────────────────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// Instructs the AI on its persona, tone, and output expectations.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a premium business consultant at the world's most trusted startup advisory firm.
Your clients are first-time entrepreneurs who have no business or finance background.

Your job is to analyze a raw business idea and produce a comprehensive, structured report.

TONE & LANGUAGE:
- Write at an 8th-grade reading level. Use simple, clear words.
- Be encouraging and positive, but also honest about real risks.
- Avoid corporate jargon. Avoid buzzwords like "leverage", "synergy", or "pivot".
- Be specific. Generic advice is useless. Tailor everything to the exact idea described.

SCORING GUIDELINES:
- overallOpportunityScore: Holistic score 1-100. 70+ is a strong idea. Consider all factors.
- marketDemand.score: 1 = nobody wants this, 10 = massive, proven demand.
- competitionLevel.score: 1 = wide-open market, 10 = dominated by giants, nearly impossible to enter.

FINANCIAL ESTIMATES:
- Base your financial estimates on realistic, conservative real-world data.
- Consider the local/global market context implied by the idea.
- Startup costs should be practical bootstrapped estimates, not venture-backed estimates.

STRUCTURE RECOMMENDATION:
- Be specific to the nature of this idea (e.g., if it has liability risk, recommend LLC).
- Give a one-sentence reason tied directly to the idea, not a generic explanation.

You MUST respond ONLY with a valid JSON object that strictly matches the provided schema.
Do not add any explanation, markdown formatting, or text outside the JSON object.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Core Service Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a business idea to GPT-4o and returns a structured analysis report.
 *
 * @param {string} businessIdea - The raw business idea text from the user.
 * @returns {Promise<Object>} - A parsed IdeaAnalysisReport object.
 * @throws {Error} - Throws a typed error if the OpenAI call fails.
 */
export const analyzeBusinessIdea = async (businessIdea) => {
  console.log(
    `\n🤖  Sending idea to OpenAI [model: ${config.openai.model}]...`
  );

  let response;

  try {
    response = await openai.chat.completions.create({
      model: config.openai.model,
      response_format: {
        type: "json_schema",
        json_schema: openAiJsonSchema,
      },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Please analyze the following business idea and generate a full report:\n\n"${businessIdea}"`,
        },
      ],
      // Conservative token limit for the response — the schema is detailed
      // but should comfortably fit within 2000 tokens.
      max_tokens: 2500,
    });
  } catch (apiError) {
    // OpenAI API-level failure (network, auth, quota, etc.)
    console.error("🔴  OpenAI API call failed:", apiError.message);

    const error = new Error(
      "Failed to connect to the AI engine. Please check your API key and try again."
    );
    error.status = 502; // Bad Gateway — upstream service failure
    throw error;
  }

  const choice = response.choices[0];

  // Check if the model refused to respond (safety filter, etc.)
  if (choice.finish_reason === "content_filter") {
    const error = new Error(
      "The AI declined to analyze this idea due to content policy restrictions."
    );
    error.status = 400;
    throw error;
  }

  // Structured outputs with strict: true should never return null content,
  // but we guard anyway for production resilience.
  if (!choice.message?.content) {
    const error = new Error(
      "The AI returned an empty response. Please try again."
    );
    error.status = 500;
    throw error;
  }

  try {
    const report = JSON.parse(choice.message.content);
    console.log(`✅  Analysis complete. Score: ${report.overallOpportunityScore}/100`);
    return report;
  } catch (parseError) {
    // This should never happen with strict structured outputs, but we handle it.
    console.error("🔴  Failed to parse OpenAI response:", choice.message.content);
    const error = new Error(
      "The AI returned a malformed response. Please try again."
    );
    error.status = 500;
    throw error;
  }
};

/**
 * app/services/ai.service.js
 *
 * THE STRATEGY CONTROLLER — Hybrid AI Engine for LaunchPad AI.
 *
 * Implements the Strategy Pattern. All route handlers call a public function
 * here; internally it dispatches to the correct AI provider based on AI_PROVIDER.
 *
 * Supported Providers:
 *  - 'openai'    → GPT-4o
 *  - 'anthropic' → Claude 3.5 Sonnet
 *
 * Public Exports:
 *  - analyzeBusinessIdea(idea)      → structured IdeaAnalysisReport object
 *  - chatWithAssistant(messages)    → plain string reply for conversational UI
 *  - matchFunding(userProfile)      → FundingMatch[] array
 *  - generateBusinessPlan(planData) → BusinessPlan object
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../core/config.js";
import { openAiJsonSchema } from "../schemas/analyzeIdea.schema.js";
import {
  fundingOpenAiJsonSchema,
  fundingAnthropicTool,
} from "../schemas/funding.schema.js";
import {
  businessPlanOpenAiJsonSchema,
  businessPlanAnthropicTool,
} from "../schemas/businessPlan.schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Used by: analyzeBusinessIdea()
 * Instructs the AI to produce the structured IdeaAnalysisReport JSON.
 */
const ANALYSIS_SYSTEM_PROMPT = `
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
`.trim();

/**
 * Used by: chatWithAssistant()
 * Instructs the AI to act as a conversational onboarding guide for the mobile app.
 * It asks guiding questions to extract the user's business idea, then signals
 * readiness to run a full analysis with a specific trigger phrase.
 */
const CHAT_SYSTEM_PROMPT = `
You are Alex, a warm and friendly business coach at LaunchPad AI.
Your job is to have a short, encouraging conversation with a first-time entrepreneur
to help them figure out and articulate their business idea.

Your clients may have never started a business before. They might feel nervous or unsure.
Your tone must always be positive, supportive, and excited for them.

CONVERSATION RULES:
- Ask only 1 or 2 short, simple questions at a time. Never overwhelm them.
- Use plain, everyday English. No business jargon whatsoever.
- If they give a vague idea, ask a follow-up to make it more specific
  (e.g., "Who would your main customers be?", "Would this be online or in-person?").
- Keep your replies short — 2 to 4 sentences max.
- Be genuinely encouraging. Celebrate their effort to start something.

INFORMATION YOU NEED TO GATHER (naturally, through conversation):
1. What is the core product or service?
2. Who is the target customer?
3. What problem does it solve for them?
4. Will it be local, online, or both?

ANALYSIS TRIGGER:
- Once you have enough information to understand the idea (all 4 points above),
  end your reply with this EXACT phrase on a new line:
  "I have enough details! Are you ready for me to analyze this idea?"
- Do NOT trigger early. Gather all 4 points first.
- Only trigger once — do not repeat this phrase.

Do NOT attempt to run the analysis yourself. Your only job is the conversation.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build a consistent runtime error
// ─────────────────────────────────────────────────────────────────────────────

const makeError = (message, status = 500) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH A: OpenAI GPT-4o
// Uses response_format: { type: "json_schema", strict: true }
// This is the most reliable method — OpenAI enforces the schema at the model level.
// ─────────────────────────────────────────────────────────────────────────────

const callOpenAI = async (businessIdea) => {
  if (!config.openai.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  console.log(`🤖  [OpenAI] Sending to ${config.openai.model}...`);

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      response_format: {
        type: "json_schema",
        json_schema: openAiJsonSchema,
      },
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Please analyze the following business idea and generate a full report:\n\n"${businessIdea}"`,
        },
      ],
      max_tokens: 2500,
    });
  } catch (apiError) {
    console.error("🔴  [OpenAI] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to OpenAI. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (choice.finish_reason === "content_filter") {
    throw makeError(
      "OpenAI declined to analyze this idea due to content policy restrictions.",
      400
    );
  }

  if (!choice.message?.content) {
    throw makeError("OpenAI returned an empty response. Please try again.", 500);
  }

  try {
    return JSON.parse(choice.message.content);
  } catch {
    console.error("🔴  [OpenAI] JSON parse failed:", choice.message.content);
    throw makeError("OpenAI returned a malformed response. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH B: Anthropic Claude 3.5 Sonnet
//
// Strategy: Tool Use API (Forced Tool Call)
//
// We define a single tool called "submit_analysis_report" whose input_schema
// is the full IdeaAnalysisReport JSON Schema. We then force Claude to call
// this tool by setting tool_choice: { type: "tool", name: "..." }.
//
// This is Anthropic's equivalent of OpenAI's structured outputs — Claude has
// no choice but to respond by calling the tool with a valid JSON payload.
// The report is extracted from the tool_use content block, not the text block.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Anthropic tool definition.
 * We reuse the same inner schema object from openAiJsonSchema to keep a
 * single source of truth. Only the wrapper shape differs per provider.
 */
const ANTHROPIC_TOOL = {
  name: "submit_analysis_report",
  description:
    "Submits the completed IdeaAnalysisReport object. You MUST call this tool with " +
    "the fully populated report as your response. Do not respond with text.",
  input_schema: openAiJsonSchema.schema, // Reuse the exact same JSON Schema
};

const callAnthropic = async (businessIdea) => {
  if (!config.anthropic.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  console.log(`🤖  [Anthropic] Sending to ${config.anthropic.model}...`);

  let response;
  try {
    response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      tools: [ANTHROPIC_TOOL],
      // Force Claude to use our tool — it cannot respond with plain text.
      tool_choice: { type: "tool", name: "submit_analysis_report" },
      messages: [
        {
          role: "user",
          content: `Please analyze the following business idea and generate a full report:\n\n"${businessIdea}"`,
        },
      ],
    });
  } catch (apiError) {
    console.error("🔴  [Anthropic] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Anthropic. Please check your API key and try again.",
      502
    );
  }

  // Claude stopped because we forced it to use a tool — find the tool_use block.
  if (response.stop_reason !== "tool_use") {
    console.error("🔴  [Anthropic] Unexpected stop_reason:", response.stop_reason);
    throw makeError(
      "Claude returned an unexpected response format. Please try again.",
      500
    );
  }

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolUseBlock || !toolUseBlock.input) {
    console.error("🔴  [Anthropic] No tool_use block found in response:", response.content);
    throw makeError("Claude returned an empty analysis. Please try again.", 500);
  }

  // toolUseBlock.input is already a parsed JavaScript object — no JSON.parse needed.
  return toolUseBlock.input;
};

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH C: Groq (via OpenAI-compatible base URL)
// ─────────────────────────────────────────────────────────────────────────────

const callGroq = async (businessIdea) => {
  if (!config.groq.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "groq" but GROQ_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  console.log(`🤖  [Groq] Sending to ${config.groq.model}...`);

  let response;
  try {
    const systemPromptWithSchema = `${ANALYSIS_SYSTEM_PROMPT}\n\nYou MUST respond with a valid JSON object matching this schema:\n${JSON.stringify(openAiJsonSchema.schema, null, 2)}`;
    response = await client.chat.completions.create({
      model: config.groq.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptWithSchema },
        {
          role: "user",
          content: `Please analyze the following business idea and generate a full report:\n\n"${businessIdea}"`,
        },
      ],
      max_tokens: 3000,
    });
  } catch (apiError) {
    console.error("🔴  [Groq] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Groq. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (!choice.message?.content) {
    throw makeError("Groq returned an empty response. Please try again.", 500);
  }

  try {
    return JSON.parse(choice.message.content);
  } catch {
    console.error("🔴  [Groq] JSON parse failed:", choice.message.content);
    throw makeError("Groq returned a malformed response. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRANCH A: OpenAI — Conversational reply
// Plain chat completions call. No structured output — we want a natural string.
// ─────────────────────────────────────────────────────────────────────────────

const chatOpenAI = async (messages) => {
  if (!config.openai.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  console.log(`💬  [OpenAI] Chat turn → ${messages.length} message(s) in history...`);

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      // No response_format — we want a natural language string, not JSON.
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        // Spread the full conversation history from the frontend.
        ...messages,
      ],
      max_tokens: 400, // Replies should be short by design (2-4 sentences).
      temperature: 0.7, // Slightly creative for a warm, natural feeling.
    });
  } catch (apiError) {
    console.error("🔴  [OpenAI Chat] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to OpenAI. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (choice.finish_reason === "content_filter") {
    throw makeError(
      "OpenAI declined to respond due to content policy restrictions.",
      400
    );
  }

  const reply = choice.message?.content?.trim();
  if (!reply) {
    throw makeError("OpenAI returned an empty reply. Please try again.", 500);
  }

  return reply;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRANCH B: Anthropic — Conversational reply
// Standard messages API — no tools, no forced JSON. Claude replies naturally.
// Anthropic separates the system prompt from the messages array in its API.
// ─────────────────────────────────────────────────────────────────────────────

const chatAnthropic = async (messages) => {
  if (!config.anthropic.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  console.log(`💬  [Anthropic] Chat turn → ${messages.length} message(s) in history...`);

  let response;
  try {
    response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 400, // Short replies by design.
      system: CHAT_SYSTEM_PROMPT,
      // Anthropic's messages API accepts the same { role, content } shape.
      messages,
    });
  } catch (apiError) {
    console.error("🔴  [Anthropic Chat] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Anthropic. Please check your API key and try again.",
      502
    );
  }

  // For plain chat, stop_reason should be 'end_turn'.
  // Extract text from the first content block.
  const textBlock = response.content.find((block) => block.type === "text");
  const reply = textBlock?.text?.trim();

  if (!reply) {
    console.error("🔴  [Anthropic Chat] No text block in response:", response.content);
    throw makeError("Anthropic returned an empty reply. Please try again.", 500);
  }

  return reply;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BRANCH C: Groq — Conversational reply
// ─────────────────────────────────────────────────────────────────────────────

const chatGroq = async (messages) => {
  if (!config.groq.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "groq" but GROQ_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  console.log(`💬  [Groq] Chat turn → ${messages.length} message(s) in history...`);

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.groq.model,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 400,
      temperature: 0.7,
    });
  } catch (apiError) {
    console.error("🔴  [Groq Chat] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Groq. Please check your API key and try again.",
      502
    );
  }

  const reply = response.choices[0].message?.content?.trim();
  if (!reply) {
    throw makeError("Groq returned an empty reply. Please try again.", 500);
  }

  return reply;
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNDING SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Used by: matchFunding()
 * Instructs the AI to act as a funding advisor and return tailored matches.
 */
const FUNDING_SYSTEM_PROMPT = `
You are an expert US business financial advisor specializing in startup funding.
You help first-time entrepreneurs find real, specific funding programs they actually qualify for.

Your task: Given a user's business profile, identify 3 to 4 highly relevant funding opportunities
from your knowledge of real US federal, state-level, and private grant/loan programs.

FUNDINESS RULES:
- Prioritize programs the user is MOST LIKELY to qualify for based on their stage and credit.
- Include a mix of types: at least one grant (if applicable), one loan or microloan, and one SBA program.
- If the location suggests a state-specific program exists (city/state economic development grants,
  CDFI loans, Chamber of Commerce micro-grants), include that as one of the matches — be specific.
- If the business type suggests minority, women-owned, veteran, or rural eligibility, surface those.
- Do NOT invent program names. Only include programs that genuinely exist in the real world.
- Be specific: use the real program name, real amount range, and real eligibility requirements.

MATCH SCORING:
- matchScore (1-100): How well does this specific user profile qualify?
  - 90-100: Almost certain to qualify with minimal barriers.
  - 70-89: Strong match with manageable requirements.
  - 50-69: Possible match but requires more work or better credit.
  - Below 50: A stretch, but worth knowing about.

CREDIT CONTEXT:
- Poor credit: Focus on grants (no repayment), CDFIs, microloans with relaxed credit requirements.
- Fair credit: SBA Microloans, community lenders, and some state grants are realistic.
- Good/Excellent: Full SBA loan program options open up.

KEY REQUIREMENTS: Each program needs exactly 3 bullet points of specific eligibility criteria.
DEADLINE: Use 'Rolling' for open programs, a real month for annual cycles, or null if unknown.
DIFFICULTY: 'Easy' = minimal paperwork, 'Medium' = moderate docs, 'Competitive' = selective/many applicants.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// FUNDING BRANCH A: OpenAI — Structured Outputs
// ─────────────────────────────────────────────────────────────────────────────

const fundingOpenAI = async (userProfile) => {
  if (!config.openai.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  const profileSummary =
    `Business Type: ${userProfile.businessType}\n` +
    `Location: ${userProfile.location}\n` +
    `Stage: ${userProfile.stage}\n` +
    `Credit Estimate: ${userProfile.creditEstimate}`;

  console.log(`💰  [OpenAI] Finding funding matches for: ${userProfile.location} / ${userProfile.stage}...`);

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      response_format: {
        type: "json_schema",
        json_schema: fundingOpenAiJsonSchema,
      },
      messages: [
        { role: "system", content: FUNDING_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Find the best 3-4 funding opportunities for this entrepreneur:\n\n${profileSummary}`,
        },
      ],
      max_tokens: 3000,
    });
  } catch (apiError) {
    console.error("🔴  [OpenAI Funding] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to OpenAI. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (choice.finish_reason === "content_filter") {
    throw makeError(
      "OpenAI declined to process this request due to content policy restrictions.",
      400
    );
  }

  if (!choice.message?.content) {
    throw makeError("OpenAI returned an empty funding response. Please try again.", 500);
  }

  try {
    const parsed = JSON.parse(choice.message.content);
    return parsed.matches; // Unwrap from the container object → return the array directly
  } catch {
    console.error("🔴  [OpenAI Funding] JSON parse failed:", choice.message.content);
    throw makeError("OpenAI returned a malformed funding response. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNDING BRANCH B: Anthropic — Tool Use API
// ─────────────────────────────────────────────────────────────────────────────

const fundingAnthropic = async (userProfile) => {
  if (!config.anthropic.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const profileSummary =
    `Business Type: ${userProfile.businessType}\n` +
    `Location: ${userProfile.location}\n` +
    `Stage: ${userProfile.stage}\n` +
    `Credit Estimate: ${userProfile.creditEstimate}`;

  console.log(`💰  [Anthropic] Finding funding matches for: ${userProfile.location} / ${userProfile.stage}...`);

  let response;
  try {
    response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: FUNDING_SYSTEM_PROMPT,
      tools: [fundingAnthropicTool],
      tool_choice: { type: "tool", name: "submit_funding_matches" },
      messages: [
        {
          role: "user",
          content:
            `Find the best 3-4 funding opportunities for this entrepreneur:\n\n${profileSummary}`,
        },
      ],
    });
  } catch (apiError) {
    console.error("🔴  [Anthropic Funding] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Anthropic. Please check your API key and try again.",
      502
    );
  }

  if (response.stop_reason !== "tool_use") {
    console.error("🔴  [Anthropic Funding] Unexpected stop_reason:", response.stop_reason);
    throw makeError(
      "Claude returned an unexpected response format for funding. Please try again.",
      500
    );
  }

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolUseBlock?.input?.matches) {
    console.error("🔴  [Anthropic Funding] No valid tool_use block:", response.content);
    throw makeError("Claude returned an empty funding result. Please try again.", 500);
  }

  return toolUseBlock.input.matches; // Return the array directly
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNDING BRANCH C: Groq — Structured Outputs via JSON mode
// ─────────────────────────────────────────────────────────────────────────────

const fundingGroq = async (userProfile) => {
  if (!config.groq.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "groq" but GROQ_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const profileSummary =
    `Business Type: ${userProfile.businessType}\n` +
    `Location: ${userProfile.location}\n` +
    `Stage: ${userProfile.stage}\n` +
    `Credit Estimate: ${userProfile.creditEstimate}`;

  console.log(`💰  [Groq] Finding funding matches for: ${userProfile.location} / ${userProfile.stage}...`);

  let response;
  try {
    const systemPromptWithSchema = `${FUNDING_SYSTEM_PROMPT}\n\nYou MUST respond with a valid JSON object containing a "matches" key whose value is an array of funding objects matching this schema:\n${JSON.stringify(fundingOpenAiJsonSchema.schema, null, 2)}`;
    response = await client.chat.completions.create({
      model: config.groq.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptWithSchema },
        {
          role: "user",
          content:
            `Find the best 3-4 funding opportunities for this entrepreneur:\n\n${profileSummary}`,
        },
      ],
      max_tokens: 3000,
    });
  } catch (apiError) {
    console.error("🔴  [Groq Funding] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Groq. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (!choice.message?.content) {
    throw makeError("Groq returned an empty funding response. Please try again.", 500);
  }

  try {
    const parsed = JSON.parse(choice.message.content);
    return parsed.matches;
  } catch {
    console.error("🔴  [Groq Funding] JSON parse failed:", choice.message.content);
    throw makeError("Groq returned a malformed funding response. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY CONTROLLERS — Public API (called by route handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes a business idea using the active AI provider.
 *
 * @param {string} businessIdea - The raw business idea text from the user.
 * @returns {Promise<IdeaAnalysisReport>} - A normalized report object.
 * @throws {Error} - A typed error with a `.status` code if the call fails.
 */
export const analyzeBusinessIdea = async (businessIdea) => {
  const provider = config.aiProvider;
  let report;

  switch (provider) {
    case "openai":
      report = await callOpenAI(businessIdea);
      break;
    case "anthropic":
      report = await callAnthropic(businessIdea);
      break;
    case "groq":
      report = await callGroq(businessIdea);
      break;
    default:
      throw makeError(
        `Unknown AI provider: "${provider}". Set AI_PROVIDER to 'openai', 'anthropic', or 'groq'.`,
        500
      );
  }

  console.log(
    `✅  [${provider.toUpperCase()}] Analysis complete. ` +
      `Score: ${report.overallOpportunityScore}/100 | Title: "${report.title}"`
  );

  return report;
};

/**
 * Sends the full conversation history to the active AI provider and returns
 * the assistant's next plain-text reply.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @returns {Promise<string>} - The AI's plain text reply.
 * @throws {Error} - A typed error with a `.status` code if the call fails.
 */
export const chatWithAssistant = async (messages) => {
  const provider = config.aiProvider;
  let reply;

  switch (provider) {
    case "openai":
      reply = await chatOpenAI(messages);
      break;
    case "anthropic":
      reply = await chatAnthropic(messages);
      break;
    case "groq":
      reply = await chatGroq(messages);
      break;
    default:
      throw makeError(
        `Unknown AI provider: "${provider}". Set AI_PROVIDER to 'openai', 'anthropic', or 'groq'.`,
        500
      );
  }

  console.log(`✅  [${provider.toUpperCase()}] Chat reply sent (${reply.length} chars).`);

  return reply;
};

/**
 * Matches a user's business profile against real-world funding programs.
 * Returns 3-4 tailored FundingMatch objects sorted by match score (best first).
 *
 * @param {{ businessType: string, location: string, stage: string, creditEstimate: string }} userProfile
 * @returns {Promise<FundingMatch[]>} - Array of matched funding opportunities.
 * @throws {Error} - A typed error with a `.status` code if the call fails.
 */
export const matchFunding = async (userProfile) => {
  const provider = config.aiProvider;
  let matches;

  switch (provider) {
    case "openai":
      matches = await fundingOpenAI(userProfile);
      break;
    case "anthropic":
      matches = await fundingAnthropic(userProfile);
      break;
    case "groq":
      matches = await fundingGroq(userProfile);
      break;
    default:
      throw makeError(
        `Unknown AI provider: "${provider}". Set AI_PROVIDER to 'openai', 'anthropic', or 'groq'.`,
        500
      );
  }

  // Sort by matchScore descending so the best match is always first
  matches.sort((a, b) => b.matchScore - a.matchScore);

  console.log(
    `✅  [${provider.toUpperCase()}] Funding matches found: ${matches.length} programs. ` +
      `Top match: "${matches[0]?.programName}" (${matches[0]?.matchScore}/100)`
  );

  return matches;
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PLAN SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Used by: generateBusinessPlan()
 * Instructs the AI to act as a professional business plan writer.
 */
const BUSINESS_PLAN_SYSTEM_PROMPT = `
You are an elite business plan writer with 20 years of experience helping first-time
entrepreneurs launch successful companies. Your plans are concise, professional, and
designed to be immediately useful — not padded with filler content.

Your task: Generate a focused, 1-page business plan based on the provided inputs.
The plan must be tailored specifically to the exact business name, idea, legal structure,
and location provided. Generic content is unacceptable.

WRITING STANDARDS:
- Tone: Highly professional yet encouraging. This person is just starting out.
- Language: Clear, confident, and jargon-free. An 8th-grade reading level for accessibility.
- Specificity: Reference the actual business name, idea, and location in every section.
  Avoid generic statements that could apply to any business.
- Actionability: Every section must give the entrepreneur something concrete they can act on.

SECTION GUIDANCE:
- executiveSummary: 1 strong paragraph. Hook the reader. Mention what the company does,
  who it serves, and why it has a real shot at success in this specific market.
- missionStatement: 1-2 sentences. The "why" behind the business. Inspiring but grounded.
- targetMarket: Be specific. Demographics, psychographics, geography, pain points.
  Don't say "people who like X" — say "urban professionals aged 28-40 in [location] who..."
- productsAndServices: 3-5 bullet points. Each should name the offering AND its core value.
- revenueModel: Explain pricing, frequency, and primary revenue streams clearly.
  e.g., subscription at $29/month, commission on sales, one-time service fee of $X.
- marketingStrategy: 3 practical, zero-jargon tactics for acquiring the very first customers.
  Think: local community groups, social media, partnerships — not "build brand awareness".

LEGAL STRUCTURE NOTE:
Acknowledge the chosen legal structure (${"LLC"}, ${"Corporation"}, or ${"Sole Proprietorship"})
briefly in the executiveSummary if relevant (e.g., "operating as an LLC").
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PLAN BRANCH A: OpenAI — Structured Outputs
// ─────────────────────────────────────────────────────────────────────────────

const planOpenAI = async (planData) => {
  if (!config.openai.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "openai" but OPENAI_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });

  const inputSummary =
    `Business Name: ${planData.businessName}\n` +
    `Business Idea: ${planData.businessIdea}\n` +
    `Legal Structure: ${planData.structure}\n` +
    `Location: ${planData.location}`;

  console.log(`📄  [OpenAI] Generating business plan for: "${planData.businessName}"...`);

  let response;
  try {
    response = await client.chat.completions.create({
      model: config.openai.model,
      response_format: {
        type: "json_schema",
        json_schema: businessPlanOpenAiJsonSchema,
      },
      messages: [
        { role: "system", content: BUSINESS_PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Please generate a complete 1-page business plan for the following:\n\n${inputSummary}`,
        },
      ],
      max_tokens: 2000,
    });
  } catch (apiError) {
    console.error("🔴  [OpenAI Plan] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to OpenAI. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (choice.finish_reason === "content_filter") {
    throw makeError(
      "OpenAI declined to generate this plan due to content policy restrictions.",
      400
    );
  }

  if (!choice.message?.content) {
    throw makeError("OpenAI returned an empty business plan. Please try again.", 500);
  }

  try {
    return JSON.parse(choice.message.content);
  } catch {
    console.error("🔴  [OpenAI Plan] JSON parse failed:", choice.message.content);
    throw makeError("OpenAI returned a malformed business plan. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PLAN BRANCH B: Anthropic — Tool Use API
// ─────────────────────────────────────────────────────────────────────────────

const planAnthropic = async (planData) => {
  if (!config.anthropic.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "anthropic" but ANTHROPIC_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const inputSummary =
    `Business Name: ${planData.businessName}\n` +
    `Business Idea: ${planData.businessIdea}\n` +
    `Legal Structure: ${planData.structure}\n` +
    `Location: ${planData.location}`;

  console.log(`📄  [Anthropic] Generating business plan for: "${planData.businessName}"...`);

  let response;
  try {
    response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: BUSINESS_PLAN_SYSTEM_PROMPT,
      tools: [businessPlanAnthropicTool],
      tool_choice: { type: "tool", name: "submit_business_plan" },
      messages: [
        {
          role: "user",
          content: `Please generate a complete 1-page business plan for the following:\n\n${inputSummary}`,
        },
      ],
    });
  } catch (apiError) {
    console.error("🔴  [Anthropic Plan] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Anthropic. Please check your API key and try again.",
      502
    );
  }

  if (response.stop_reason !== "tool_use") {
    console.error("🔴  [Anthropic Plan] Unexpected stop_reason:", response.stop_reason);
    throw makeError(
      "Claude returned an unexpected format for the business plan. Please try again.",
      500
    );
  }

  const toolUseBlock = response.content.find((block) => block.type === "tool_use");

  if (!toolUseBlock?.input) {
    console.error("🔴  [Anthropic Plan] No tool_use block found:", response.content);
    throw makeError("Claude returned an empty business plan. Please try again.", 500);
  }

  return toolUseBlock.input;
};

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PLAN BRANCH C: Groq — Structured Outputs via JSON mode
// ─────────────────────────────────────────────────────────────────────────────

const planGroq = async (planData) => {
  if (!config.groq.apiKey) {
    throw makeError(
      'AI_PROVIDER is set to "groq" but GROQ_API_KEY is missing from your .env file.',
      500
    );
  }

  const client = new OpenAI({
    apiKey: config.groq.apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const inputSummary =
    `Business Name: ${planData.businessName}\n` +
    `Business Idea: ${planData.businessIdea}\n` +
    `Legal Structure: ${planData.structure}\n` +
    `Location: ${planData.location}`;

  console.log(`📄  [Groq] Generating business plan for: "${planData.businessName}"...`);

  let response;
  try {
    const systemPromptWithSchema = `${BUSINESS_PLAN_SYSTEM_PROMPT}\n\nYou MUST respond with a valid JSON object matching this schema:\n${JSON.stringify(businessPlanOpenAiJsonSchema.schema, null, 2)}`;
    response = await client.chat.completions.create({
      model: config.groq.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptWithSchema },
        {
          role: "user",
          content: `Please generate a complete 1-page business plan for the following:\n\n${inputSummary}`,
        },
      ],
      max_tokens: 2500,
    });
  } catch (apiError) {
    console.error("🔴  [Groq Plan] API call failed:", apiError.message);
    throw makeError(
      "Failed to connect to Groq. Please check your API key and try again.",
      502
    );
  }

  const choice = response.choices[0];

  if (!choice.message?.content) {
    throw makeError("Groq returned an empty business plan. Please try again.", 500);
  }

  try {
    return JSON.parse(choice.message.content);
  } catch {
    console.error("🔴  [Groq Plan] JSON parse failed:", choice.message.content);
    throw makeError("Groq returned a malformed business plan. Please try again.", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT: generateBusinessPlan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a structured 1-page business plan using the active AI provider.
 *
 * @param {{ businessName: string, businessIdea: string, structure: string, location: string }} planData
 * @returns {Promise<BusinessPlan>} - A normalized BusinessPlan object.
 * @throws {Error} - A typed error with a `.status` code if the call fails.
 */
export const generateBusinessPlan = async (planData) => {
  const provider = config.aiProvider;
  let plan;

  switch (provider) {
    case "openai":
      plan = await planOpenAI(planData);
      break;
    case "anthropic":
      plan = await planAnthropic(planData);
      break;
    case "groq":
      plan = await planGroq(planData);
      break;
    default:
      throw makeError(
        `Unknown AI provider: "${provider}". Set AI_PROVIDER to 'openai', 'anthropic', or 'groq'.`,
        500
      );
  }

  console.log(
    `✅  [${provider.toUpperCase()}] Business plan generated for: "${plan.companyName}"`
  );

  return plan;
};



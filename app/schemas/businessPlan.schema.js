/**
 * app/schemas/businessPlan.schema.js
 *
 * Zod validation schema for the POST /api/generate-business-plan endpoint.
 * Also defines the OpenAI JSON Schema and Anthropic tool that enforce the
 * structured BusinessPlan output from the AI.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ZOD — HTTP Request Body Validation
// ─────────────────────────────────────────────────────────────────────────────

export const zodBusinessPlanSchema = z.object({
  userEmail: z
    .string({
      required_error: "userEmail is required.",
      invalid_type_error: "userEmail must be a string.",
    })
    .email({ message: "userEmail must be a valid email address." }),

  businessName: z
    .string({
      required_error: "businessName is required.",
      invalid_type_error: "businessName must be a string.",
    })
    .min(2, { message: "businessName must be at least 2 characters." })
    .max(100, { message: "businessName must not exceed 100 characters." }),

  businessIdea: z
    .string({
      required_error: "businessIdea is required.",
      invalid_type_error: "businessIdea must be a string.",
    })
    .min(10, { message: "businessIdea must be at least 10 characters." })
    .max(2000, { message: "businessIdea must not exceed 2000 characters." }),

  structure: z.enum(["LLC", "Corporation", "Sole Proprietorship"], {
    required_error: "structure is required.",
    invalid_type_error:
      "structure must be one of: 'LLC', 'Corporation', 'Sole Proprietorship'.",
  }),

  location: z
    .string({
      required_error: "location is required.",
      invalid_type_error: "location must be a string (e.g., 'Miami, FL').",
    })
    .min(2, { message: "location must be at least 2 characters." })
    .max(100, { message: "location must not exceed 100 characters." }),
});


// ─────────────────────────────────────────────────────────────────────────────
// 2. OPENAI JSON SCHEMA — Structured Outputs Contract
//    strict: true locks the BusinessPlan shape at the model level.
// ─────────────────────────────────────────────────────────────────────────────

/** Inner schema — reused by both OpenAI and Anthropic. */
export const businessPlanItemSchema = {
  type: "object",
  properties: {
    companyName: {
      type: "string",
      description: "The official name of the business as provided by the user.",
    },
    executiveSummary: {
      type: "string",
      description:
        "A compelling 1-paragraph overview of the business: what it does, who it serves, and why it will succeed. Written for a potential investor or partner.",
    },
    missionStatement: {
      type: "string",
      description:
        "A crisp 1 to 2 sentence mission statement that captures the purpose and values of the business.",
    },
    targetMarket: {
      type: "string",
      description:
        "A clear description of the ideal customer: who they are, where they are, what they need, and why this business is the right solution for them.",
    },
    productsAndServices: {
      type: "array",
      description:
        "3 to 5 concise bullet points describing the specific products or services the business will offer, with a brief value note for each.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 5,
    },
    revenueModel: {
      type: "string",
      description:
        "A clear 1-paragraph explanation of exactly how the business will generate revenue: pricing model, frequency, and key revenue streams.",
    },
    marketingStrategy: {
      type: "array",
      description:
        "Exactly 3 specific, actionable marketing steps to acquire the first paying customers. Each step should be practical for a first-time entrepreneur with a limited budget.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: [
    "companyName",
    "executiveSummary",
    "missionStatement",
    "targetMarket",
    "productsAndServices",
    "revenueModel",
    "marketingStrategy",
  ],
  additionalProperties: false,
};

/** Full OpenAI response_format wrapper. */
export const businessPlanOpenAiJsonSchema = {
  name: "BusinessPlan",
  strict: true,
  schema: businessPlanItemSchema,
};

/** Anthropic Tool definition — reuses the identical inner schema. */
export const businessPlanAnthropicTool = {
  name: "submit_business_plan",
  description:
    "Submits the completed 1-page business plan. " +
    "You MUST call this tool with the fully populated plan object. Do not respond with text.",
  input_schema: businessPlanItemSchema,
};

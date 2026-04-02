/**
 * app/schemas/funding.schema.js
 *
 * Zod validation schema for the POST /api/match-funding endpoint.
 * Also defines the OpenAI JSON Schema and Anthropic tool used to enforce
 * a structured FundingMatch[] array from the AI response.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ZOD — HTTP Request Body Validation
// ─────────────────────────────────────────────────────────────────────────────

export const zodFundingSchema = z.object({
  userProfile: z.object(
    {
      businessType: z
        .string({
          required_error: "businessType is required.",
          invalid_type_error: "businessType must be a string.",
        })
        .min(3, { message: "businessType must be at least 3 characters." })
        .max(200, { message: "businessType must not exceed 200 characters." }),

      location: z
        .string({
          required_error: "location is required.",
          invalid_type_error: "location must be a string (e.g., 'Austin, TX').",
        })
        .min(2, { message: "location must be at least 2 characters." })
        .max(100, { message: "location must not exceed 100 characters." }),

      stage: z
        .string({
          required_error: "stage is required.",
          invalid_type_error: "stage must be a string (e.g., 'Idea', 'Pre-revenue').",
        })
        .min(2, { message: "stage must be at least 2 characters." })
        .max(50, { message: "stage must not exceed 50 characters." }),

      creditEstimate: z.enum(["Poor", "Fair", "Good", "Excellent"], {
        required_error: "creditEstimate is required.",
        invalid_type_error:
          "creditEstimate must be one of: 'Poor', 'Fair', 'Good', 'Excellent'.",
      }),
    },
    {
      required_error: "userProfile object is required.",
      invalid_type_error: "userProfile must be an object.",
    }
  ),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPENAI JSON SCHEMA — Structured Outputs Contract
//    The AI must return an array of FundingMatch objects.
//    "strict: true" locks the shape at the model level.
// ─────────────────────────────────────────────────────────────────────────────

/** Inner schema for a single FundingMatch — reused by both providers. */
export const fundingMatchItemSchema = {
  type: "object",
  properties: {
    programName: {
      type: "string",
      description:
        "The full official name of the funding program, e.g., 'SBA Microloan Program' or 'USDA Rural Energy for America Program'.",
    },
    type: {
      type: "string",
      description: "The category of funding.",
      enum: ["Grant", "Loan", "Microloan", "SBA"],
    },
    amountRange: {
      type: "string",
      description:
        "The typical funding amount range as a string, e.g., '$500 - $50,000'.",
    },
    matchScore: {
      type: "integer",
      description:
        "An integer from 1 to 100 indicating how well the user's profile qualifies for this program. 90+ = excellent match, 60-89 = good match, below 60 = possible but harder.",
      minimum: 1,
      maximum: 100,
    },
    keyRequirements: {
      type: "array",
      description:
        "Exactly 3 short bullet points describing the key eligibility requirements for this program.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    deadline: {
      type: ["string", "null"],
      description:
        "Application deadline. Use 'Rolling' for programs with no set deadline, a specific month (e.g., 'March 31') for annual deadlines, or null if not applicable or unknown.",
    },
    difficulty: {
      type: "string",
      description:
        "How difficult the application process is relative to a first-time entrepreneur.",
      enum: ["Easy", "Medium", "Competitive"],
    },
  },
  required: [
    "programName",
    "type",
    "amountRange",
    "matchScore",
    "keyRequirements",
    "deadline",
    "difficulty",
  ],
  additionalProperties: false,
};

/** Full OpenAI response_format wrapper — passed to json_schema response_format. */
export const fundingOpenAiJsonSchema = {
  name: "FundingMatchList",
  strict: true,
  schema: {
    type: "object",
    description:
      "A container object holding the array of matched funding programs.",
    properties: {
      matches: {
        type: "array",
        description: "An array of 3 to 4 tailored funding opportunities.",
        items: fundingMatchItemSchema,
        minItems: 3,
        maxItems: 4,
      },
    },
    required: ["matches"],
    additionalProperties: false,
  },
};

/** Anthropic Tool definition — reuses the same inner schema. */
export const fundingAnthropicTool = {
  name: "submit_funding_matches",
  description:
    "Submits the completed list of 3 to 4 matched funding programs. " +
    "You MUST call this tool with the fully populated matches array. Do not respond with text.",
  input_schema: fundingOpenAiJsonSchema.schema,
};

/**
 * app/schemas/analyzeIdea.schema.js
 *
 * Single source of truth for ALL schema definitions for the
 * POST /api/analyze-idea endpoint.
 *
 * Contains:
 *  1. zodRequestSchema  — Zod schema to validate the incoming HTTP request body.
 *  2. openAiJsonSchema  — The literal JSON Schema object passed to OpenAI's
 *                         `response_format` to enforce strict structured output.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ZOD — HTTP Request Body Validation
// ─────────────────────────────────────────────────────────────────────────────

export const zodRequestSchema = z.object({
  businessIdea: z
    .string({
      required_error: "businessIdea is required.",
      invalid_type_error: "businessIdea must be a string.",
    })
    .min(10, { message: "businessIdea must be at least 10 characters long." })
    .max(2000, {
      message: "businessIdea must not exceed 2000 characters.",
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OPENAI JSON SCHEMA — Structured Outputs Contract
//    Passed directly to response_format.json_schema.schema.
//    "strict: true" means OpenAI WILL NOT deviate from this shape.
// ─────────────────────────────────────────────────────────────────────────────

export const openAiJsonSchema = {
  name: "IdeaAnalysisReport",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A catchy, AI-generated business name or title derived from the idea.",
      },
      overallOpportunityScore: {
        type: "integer",
        description: "An overall opportunity score for the business idea, between 1 and 100.",
        minimum: 1,
        maximum: 100,
      },
      executiveSummary: {
        type: "string",
        description:
          "3 to 5 sentences summarizing the business opportunity in plain, encouraging English for a first-time entrepreneur.",
      },
      marketDemand: {
        type: "object",
        properties: {
          score: {
            type: "integer",
            description: "Market demand score from 1 (very low) to 10 (very high).",
            minimum: 1,
            maximum: 10,
          },
          reasons: {
            type: "array",
            description: "Exactly 3 bullet points explaining the key demand signals for this idea.",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ["score", "reasons"],
        additionalProperties: false,
      },
      competitionLevel: {
        type: "object",
        properties: {
          score: {
            type: "integer",
            description:
              "Competition level score from 1 (very little competition) to 10 (extremely saturated).",
            minimum: 1,
            maximum: 10,
          },
          mainCompetitors: {
            type: "string",
            description:
              "A brief description of who the main competitors are in this space.",
          },
          marketSaturation: {
            type: "string",
            description:
              "A brief description of how saturated the market currently is.",
          },
          competitiveGap: {
            type: "string",
            description:
              "A clear description of where the user can stand out and differentiate themselves.",
          },
        },
        required: ["score", "mainCompetitors", "marketSaturation", "competitiveGap"],
        additionalProperties: false,
      },
      profitPotential: {
        type: "object",
        properties: {
          monthlyRevenueRange: {
            type: "string",
            description: "Estimated monthly revenue range, e.g., '$3,000 - $8,000'.",
          },
          startupCostEstimate: {
            type: "string",
            description: "Estimated startup cost range, e.g., '$500 - $1,500'.",
          },
          breakEvenTimeframe: {
            type: "string",
            description:
              "Estimated time to break even, e.g., '3 - 6 months'.",
          },
        },
        required: ["monthlyRevenueRange", "startupCostEstimate", "breakEvenTimeframe"],
        additionalProperties: false,
      },
      riskAssessment: {
        type: "object",
        properties: {
          level: {
            type: "string",
            description: "Overall risk level of the business idea.",
            enum: ["Low", "Medium", "High"],
          },
          risks: {
            type: "array",
            description:
              "Exactly 3 key risks with actionable mitigation strategies for each.",
            items: {
              type: "object",
              properties: {
                risk: {
                  type: "string",
                  description: "A specific risk associated with this business idea.",
                },
                mitigation: {
                  type: "string",
                  description:
                    "A practical, actionable strategy to reduce or eliminate this risk.",
                },
              },
              required: ["risk", "mitigation"],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ["level", "risks"],
        additionalProperties: false,
      },
      industryTrends: {
        type: "array",
        description:
          "3 to 4 bullet points on where the relevant industry is heading, with a focus on opportunity.",
        items: { type: "string" },
        minItems: 3,
        maxItems: 4,
      },
      recommendedStructure: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              "The recommended legal business structure for this specific idea.",
            enum: ["LLC", "Corporation", "Sole Proprietorship"],
          },
          reason: {
            type: "string",
            description:
              "A one-sentence explanation tailored to this specific idea, explaining why this structure was recommended.",
          },
        },
        required: ["type", "reason"],
        additionalProperties: false,
      },
    },
    required: [
      "title",
      "overallOpportunityScore",
      "executiveSummary",
      "marketDemand",
      "competitionLevel",
      "profitPotential",
      "riskAssessment",
      "industryTrends",
      "recommendedStructure",
    ],
    additionalProperties: false,
  },
};

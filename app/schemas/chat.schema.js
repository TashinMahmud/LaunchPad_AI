/**
 * app/schemas/chat.schema.js
 *
 * Zod validation schema for the POST /api/chat-onboarding endpoint.
 *
 * The frontend manages conversation state and sends the full message history
 * on every request. We validate the shape here before touching the AI layer.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Individual message schema
// ─────────────────────────────────────────────────────────────────────────────

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"], {
    errorMap: () => ({
      message: "Each message role must be either 'user' or 'assistant'.",
    }),
  }),
  content: z
    .string({
      required_error: "Message content is required.",
      invalid_type_error: "Message content must be a string.",
    })
    .min(1, { message: "Message content cannot be empty." })
    .max(4000, { message: "A single message cannot exceed 4000 characters." }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Request body schema
// ─────────────────────────────────────────────────────────────────────────────

export const zodChatSchema = z.object({
  messages: z
    .array(chatMessageSchema, {
      required_error: "messages array is required.",
      invalid_type_error: "messages must be an array.",
    })
    .min(1, { message: "The messages array must contain at least one message." })
    .max(50, {
      message:
        "The conversation history cannot exceed 50 messages. Start a new session.",
    }),
});

# LaunchPad AI — API Contract

> **For:** Backend Team & Frontend Team  
> **Base URL:** `http://localhost:5000/api` (development) | `https://api.launchpad-ai.com/api` (production)  
> **Protocol:** REST over HTTPS. All request bodies are JSON. All responses are JSON.  
> **Auth:** None (open endpoints — auth layer to be added in Phase 3)

---

## Global Conventions

### Request Headers (all endpoints)
```
Content-Type: application/json
```

### Standard Error Envelope
All errors follow this shape — frontend should handle `success: false` consistently:

```json
{
  "success": false,
  "message": "Human-readable error summary.",
  "errors": [
    { "field": "fieldName", "message": "Specific validation message." }
  ]
}
```
> `errors` array is **only present on 400 Validation errors**. For 500/502 errors, only `message` is returned.

### HTTP Status Codes Used

| Code | Meaning |
|---|---|
| `200` | Success |
| `400` | Validation failed (bad request body) |
| `402` | Content policy violation (AI refused) |
| `500` | Internal server / AI service error |
| `502` | AI provider unreachable (upstream error) |

---

## Endpoints

---

## 1. `POST /api/analyze-idea`

**Purpose:** Takes a raw business idea and returns a comprehensive, structured analysis report with market scoring, financial estimates, competition analysis, and legal structure recommendations.

**Powers:** Web dashboard — "Analyze My Idea" screen

---

### Request Body

```json
{
  "businessIdea": "string"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `businessIdea` | `string` | ✅ | Min 10 chars · Max 5000 chars |

**Example:**
```json
{
  "businessIdea": "A subscription box service delivering curated African skincare products to women in the US diaspora"
}
```

---

### Success Response `200`

```json
{
  "success": true,
  "report": {
    "title": "string",
    "tagline": "string",
    "overallOpportunityScore": "integer (1–100)",
    "executiveSummary": "string",
    "marketDemand": {
      "score": "integer (1–10)",
      "summary": "string",
      "keyInsight": "string"
    },
    "competitionLevel": {
      "score": "integer (1–10)",
      "summary": "string",
      "topCompetitors": ["string", "string", "string"]
    },
    "targetAudience": {
      "primarySegment": "string",
      "ageRange": "string",
      "location": "string",
      "painPoints": ["string", "string", "string"]
    },
    "financialEstimates": {
      "estimatedStartupCost": "string",
      "monthlyOperatingCost": "string",
      "potentialMonthlyRevenue": "string",
      "breakEvenTimeline": "string"
    },
    "topStrengths": ["string", "string", "string"],
    "topRisks": ["string", "string", "string"],
    "legalStructureRecommendation": {
      "recommended": "string",
      "reason": "string"
    },
    "immediateNextSteps": ["string", "string", "string", "string", "string"]
  }
}
```

**Key field notes for frontend:**

| Field | Display guidance |
|---|---|
| `overallOpportunityScore` | Show as a gauge/circle. `70+` = green, `50–69` = yellow, `<50` = red |
| `marketDemand.score` | `/10` scale. Higher = more demand |
| `competitionLevel.score` | `/10` scale. Higher = harder market to enter |
| `financialEstimates.*` | Pre-formatted strings (e.g., `"$2,000 - $5,000"`) — render as-is |
| `immediateNextSteps` | Render as a numbered checklist |

---

### Error Responses

**400 — Validation Failed**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    { "field": "businessIdea", "message": "businessIdea must be at least 10 characters." }
  ]
}
```

**500 — AI Error**
```json
{
  "success": false,
  "message": "Failed to connect to OpenAI. Please check your API key and try again."
}
```

---

### Frontend Integration Notes
- Show a **loading spinner** (AI calls take 10–30 seconds)
- Disable the submit button while loading to prevent duplicate requests
- The `overallOpportunityScore` is the hero metric — feature it prominently at the top of the results screen

### Backend Notes
- Uses `gpt-4o-2024-08-06` with `response_format: { type: "json_schema", strict: true }`
- Anthropic branch uses Claude Tool Use API with forced tool call
- Schema is the single source of truth: `app/schemas/analyzeIdea.schema.js`

---

---

## 2. `POST /api/chat-onboarding`

**Purpose:** Stateless conversational AI endpoint for the mobile app's onboarding chat UI. The AI (acting as "Alex") asks guiding questions to help users articulate their business idea. Returns a plain text reply each turn.

**Powers:** Mobile app — Onboarding chat screen

---

### Request Body

```json
{
  "messages": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `messages` | `array` | ✅ | Min 1 item · Max 50 items |
| `messages[].role` | `"user"` \| `"assistant"` | ✅ | Exact enum values |
| `messages[].content` | `string` | ✅ | Min 1 char · Max 4000 chars |

> ⚠️ **Stateless design:** The backend stores NO conversation history. The frontend is responsible for maintaining the full message array and sending it on every request. Each turn, append the new user message and POST the entire array.

**First turn (user opens chat):**
```json
{
  "messages": [
    { "role": "user", "content": "Hi, I want to start a business but I don't know where to begin" }
  ]
}
```

**Subsequent turns (append AI reply + new user message):**
```json
{
  "messages": [
    { "role": "user", "content": "I want to sell handmade candles online" },
    { "role": "assistant", "content": "That's a wonderful idea! Who do you picture buying them — do you have a specific type of customer in mind?" },
    { "role": "user", "content": "Mostly women who love home decor, aged 25-40" }
  ]
}
```

---

### Success Response `200`

```json
{
  "success": true,
  "reply": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `reply` | `string` | Alex's plain-text conversational response (2–4 sentences) |

**Example:**
```json
{
  "success": true,
  "reply": "I love that! Home decor enthusiasts are a passionate and loyal group. One more thing — would you sell these candles exclusively online, or are you thinking about local markets and pop-up shops too?\n\nI have enough details! Are you ready for me to analyze this idea?"
}
```

---

### Analysis Trigger Detection

When the AI has gathered enough information, `reply` will end with this **exact phrase**:

```
I have enough details! Are you ready for me to analyze this idea?
```

**Frontend must detect this substring** and show an "Analyze Now" button. When tapped, extract the conversation context and call `POST /api/analyze-idea`.

```javascript
// React Native / JS detection example
if (reply.includes("I have enough details! Are you ready for me to analyze this idea?")) {
  showAnalyzeButton();
}
```

---

### Error Responses

**400 — Validation Failed**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    { "field": "messages[0].role", "message": "Invalid enum value. Expected 'user' | 'assistant'" }
  ]
}
```

---

### Frontend Integration Notes
- Render `reply` as a chat bubble (assistant side)
- After each successful response, **push the reply as `{ role: "assistant", content: reply }`** into your local messages array
- Cap the messages array at 50 items (enforced server-side too, but good to handle client-side)
- On the trigger phrase: extract the full conversation as a single summary string to pass to `/api/analyze-idea`

### Backend Notes
- No `response_format` — plain chat completion for natural voice
- `max_tokens: 400` — keeps replies short by design
- `temperature: 0.7` — slightly warm/creative tone

---

---

## 3. `POST /api/match-funding`

**Purpose:** Takes a user's business profile and returns 3–4 tailored, real-world funding opportunities (grants, loans, SBA programs) ranked by match score.

**Powers:** Web dashboard — "Funding Center" screen

---

### Request Body

```json
{
  "userProfile": {
    "businessType": "string",
    "location": "string",
    "stage": "string",
    "creditEstimate": "Poor" | "Fair" | "Good" | "Excellent"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userProfile` | `object` | ✅ | — |
| `userProfile.businessType` | `string` | ✅ | Min 3 · Max 200 chars |
| `userProfile.location` | `string` | ✅ | Min 2 · Max 100 chars · Format: "City, ST" |
| `userProfile.stage` | `string` | ✅ | Min 2 · Max 50 chars |
| `userProfile.creditEstimate` | `enum` | ✅ | Exactly: `"Poor"` \| `"Fair"` \| `"Good"` \| `"Excellent"` |

**Stage examples** (no enum — free text): `"Idea"`, `"Pre-revenue"`, `"Early Revenue"`, `"Scaling"`

**Example:**
```json
{
  "userProfile": {
    "businessType": "Food truck selling vegan street tacos",
    "location": "Austin, TX",
    "stage": "Pre-revenue",
    "creditEstimate": "Fair"
  }
}
```

---

### Success Response `200`

```json
{
  "success": true,
  "matches": [
    {
      "programName": "string",
      "type": "Grant" | "Loan" | "Microloan" | "SBA",
      "amountRange": "string",
      "matchScore": "integer (1–100)",
      "keyRequirements": ["string", "string", "string"],
      "deadline": "string | null",
      "difficulty": "Easy" | "Medium" | "Competitive"
    }
  ]
}
```

**Response example:**
```json
{
  "success": true,
  "matches": [
    {
      "programName": "SBA Microloan Program",
      "type": "Microloan",
      "amountRange": "$500 - $50,000",
      "matchScore": 87,
      "keyRequirements": [
        "Business must be for-profit and based in the US",
        "Borrower must have acceptable credit history (no minimum score required)",
        "Funds must be used for working capital, inventory, or equipment"
      ],
      "deadline": "Rolling",
      "difficulty": "Medium"
    },
    {
      "programName": "Austin Small Business Program",
      "type": "Grant",
      "amountRange": "$5,000 - $25,000",
      "matchScore": 74,
      "keyRequirements": [
        "Business must be located within Austin city limits",
        "Annual revenue must be under $500,000",
        "Business owner must own at least 51% of the company"
      ],
      "deadline": "March 31",
      "difficulty": "Competitive"
    }
  ]
}
```

**Key field notes for frontend:**

| Field | Display guidance |
|---|---|
| `matchScore` | Show as a percentage badge. Color: `90+` green · `70–89` blue · `50–69` yellow · `<50` grey |
| `type` | Show as a pill/badge (`Grant`, `Loan`, etc.) |
| `difficulty` | Show as a colored label. `Easy` = green · `Medium` = yellow · `Competitive` = red |
| `deadline` | `null` → show "No deadline". `"Rolling"` → show "Rolling — Apply Anytime" |
| `keyRequirements` | Render as 3 bullet points |
| Array order | Already sorted best match first (highest `matchScore` at index 0) |

---

### Error Responses

**400 — Invalid creditEstimate value**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    {
      "field": "userProfile.creditEstimate",
      "message": "creditEstimate must be one of: 'Poor', 'Fair', 'Good', 'Excellent'."
    }
  ]
}
```

---

### Frontend Integration Notes
- `creditEstimate` must be sent as a **capitalized enum value** — use a dropdown UI, not free text
- Recommended UI: 4-option selector (Poor / Fair / Good / Excellent) — never a text input
- Display 3–4 cards, sorted as returned (no client-side sorting needed)

### Backend Notes
- AI uses real-world knowledge — no database needed  
- Results are sorted by `matchScore` desc in `matchFunding()` after the AI call
- OpenAI: `FundingMatchList` schema with `matches[]` container object (unwrapped before returning)
- Anthropic: `submit_funding_matches` tool forced call

---

---

## 4. `POST /api/generate-business-plan`

**Purpose:** Generates a complete, structured 1-page business plan draft. Also asynchronously triggers the n8n PDF generation and email delivery pipeline without delaying the response.

**Powers:** Web dashboard — "Business Plan Generator" screen  
**Side effect:** Triggers n8n workflow to email a PDF version to `userEmail`

---

### Request Body

```json
{
  "userEmail": "string",
  "businessName": "string",
  "businessIdea": "string",
  "structure": "LLC" | "Corporation" | "Sole Proprietorship",
  "location": "string"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userEmail` | `string` | ✅ | Valid email format |
| `businessName` | `string` | ✅ | Min 2 · Max 100 chars |
| `businessIdea` | `string` | ✅ | Min 10 · Max 2000 chars |
| `structure` | `enum` | ✅ | Exactly: `"LLC"` \| `"Corporation"` \| `"Sole Proprietorship"` |
| `location` | `string` | ✅ | Min 2 · Max 100 chars · Format: "City, ST" |

**Example:**
```json
{
  "userEmail": "founder@example.com",
  "businessName": "FarmDrop",
  "businessIdea": "A mobile app connecting local farmers with urban consumers for same-day fresh produce delivery",
  "structure": "LLC",
  "location": "Austin, TX"
}
```

---

### Success Response `200`

```json
{
  "success": true,
  "plan": {
    "companyName": "string",
    "executiveSummary": "string",
    "missionStatement": "string",
    "targetMarket": "string",
    "productsAndServices": ["string", "string", "string"],
    "revenueModel": "string",
    "marketingStrategy": ["string", "string", "string"]
  }
}
```

**Response example:**
```json
{
  "success": true,
  "plan": {
    "companyName": "FarmDrop",
    "executiveSummary": "FarmDrop is an Austin-based LLC that connects local Texas farmers directly with urban consumers through a same-day produce delivery app. By eliminating the middleman, FarmDrop delivers fresher food faster while ensuring farmers receive fair compensation. The Austin market's strong farm-to-table culture and tech-savvy population make it an ideal launchpad for this high-demand service.",
    "missionStatement": "To make fresh, locally grown food accessible to every urban household — one same-day delivery at a time.",
    "targetMarket": "Health-conscious urban professionals aged 28–45 in Austin, TX who value fresh, locally sourced produce but lack time to visit farmers markets. They shop online, prioritize sustainability, and are willing to pay a premium for quality and convenience.",
    "productsAndServices": [
      "Same-day delivery of fresh, locally grown produce sourced from 20+ Texas farms",
      "Customizable weekly produce boxes starting at $35 with no subscription required",
      "FarmDrop app (iOS & Android) with real-time order tracking and farm origin stories",
      "Farmer partnership program — onboarding local farms at no upfront cost"
    ],
    "revenueModel": "FarmDrop earns revenue through a 15% commission on every order placed through the platform. A $45 average order value generates $6.75 per transaction. With a target of 200 orders per day at launch, projected monthly gross revenue is $40,500. Subscription box bundles at $35–$65/week provide stable recurring revenue.",
    "marketingStrategy": [
      "Partner with 5 Austin-based food bloggers and Instagram influencers for a free box giveaway campaign — target 10,000 impressions in the first 2 weeks at zero cost",
      "Set up a booth at the SFC Farmers Market in Austin on 3 consecutive weekends — collect 200 email sign-ups with a QR code linking to a 20% off first order discount",
      "Launch a referral program inside the app: existing users get $5 credit for every new user they refer who places their first order"
    ]
  }
}
```

**Key field notes for frontend:**

| Field | Display guidance |
|---|---|
| `productsAndServices` | Render as a bulleted list (3–5 items) |
| `marketingStrategy` | Render as a numbered list (exactly 3 items) |
| All string fields | Editable text fields — this plan is a **draft** for the user to refine |

---

### Side Effect — PDF Email Delivery

After the `200` response is returned, the backend fires a **non-blocking background request** to the n8n webhook:

```
POST N8N_WEBHOOK_URL
Body: { "userEmail": "...", "businessPlan": { ...plan object... } }
```

This triggers the PDF generation and email pipeline. **The frontend does not need to handle this** — it happens automatically if `N8N_WEBHOOK_URL` is configured on the backend.

> 💡 **Recommended UX:** After showing the plan, display a green banner:  
> `"📨 A PDF copy of your plan has been sent to founder@example.com"`

---

### Error Responses

**400 — Invalid structure value**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    {
      "field": "structure",
      "message": "structure must be one of: 'LLC', 'Corporation', 'Sole Proprietorship'."
    }
  ]
}
```

**400 — Invalid email**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    {
      "field": "userEmail",
      "message": "userEmail must be a valid email address."
    }
  ]
}
```

---

### Frontend Integration Notes
- `structure` must be sent as an **exact enum string** — use a 3-option dropdown
- Show a loading state during generation (10–25 seconds typical)
- After success, render the plan in an editable format (text areas per section)
- Include a "Download PDF" note or "PDF sent to your email" confirmation

### Backend Notes
- `userEmail` is destructured before calling `generateBusinessPlan()` — the AI service never receives or uses it
- Fire-and-forget dispatch uses native `fetch()` (Node 18+ built-in) — no library needed
- n8n dispatch failures are caught and logged; they never affect the Express response

---

---

## Health Check

### `GET /api/health`

No auth, no body. Use for uptime monitoring and deployment checks.

**Response `200`:**
```json
{
  "success": true,
  "status": "OK",
  "service": "LaunchPad AI API",
  "timestamp": "2026-04-03T00:00:00.000Z"
}
```

---

## Environment Variables Reference

These must be set on the backend server before any endpoint will work:

```env
# Required — controls which AI provider all endpoints use
AI_PROVIDER=openai          # or: anthropic

# Required if AI_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Required if AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Optional — enables PDF email delivery for /api/generate-business-plan
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/business-plan-pdf

# Optional — defaults to 5000
PORT=5000
```

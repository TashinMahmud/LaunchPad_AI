# LaunchPad AI — Backend API

An AI-powered business analysis REST API. Send a raw business idea, get back a fully structured analysis report powered by GPT-4o Structured Outputs.

---

## 🗂️ Project Structure

```
LaunchPad_Ai/
├── app/
│   ├── api/
│   │   ├── index.js                    # Central API router
│   │   └── routes/
│   │       └── analyzeIdea.route.js    # POST /api/analyze-idea
│   ├── core/
│   │   └── config.js                   # Env var loading & validation
│   ├── schemas/
│   │   └── analyzeIdea.schema.js       # Zod + OpenAI JSON Schema
│   ├── services/
│   │   └── openai.service.js           # OpenAI GPT-4o integration
│   └── utils/
│       └── errorHandler.js             # Global Express error middleware
├── .env                                # Your secrets (git-ignored)
├── .env.example                        # Safe template to commit
├── server.js                           # App entry point
└── package.json
```

---

## ⚡ Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
# Copy the template
cp .env.example .env
```

Open `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-real-key-here
PORT=5000
```

### 3. Start the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:
```
┌─────────────────────────────────────────────────┐
│          🚀  LaunchPad AI — Backend API          │
├─────────────────────────────────────────────────┤
│  Status : ✅  Running                            │
│  Port   : 5000                                  │
│  Health : http://localhost:5000/api/health       │
│  Endpoint: POST /api/analyze-idea               │
└─────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### `GET /api/health`

Confirms the server is running.

**Response `200`:**
```json
{
  "success": true,
  "status": "OK",
  "service": "LaunchPad AI API",
  "timestamp": "2024-08-01T12:00:00.000Z"
}
```

---

### `POST /api/analyze-idea`

Analyzes a raw business idea using GPT-4o and returns a structured report.

**Request Body:**
```json
{
  "businessIdea": "A mobile app that connects local farmers with urban consumers for fresh produce delivery"
}
```

**Constraints:**
- `businessIdea` is required.
- Minimum 10 characters, maximum 2000 characters.

**Success Response `200`:**
```json
{
  "success": true,
  "report": {
    "title": "FarmDrop",
    "overallOpportunityScore": 78,
    "executiveSummary": "...",
    "marketDemand": {
      "score": 8,
      "reasons": ["...", "...", "..."]
    },
    "competitionLevel": {
      "score": 6,
      "mainCompetitors": "...",
      "marketSaturation": "...",
      "competitiveGap": "..."
    },
    "profitPotential": {
      "monthlyRevenueRange": "$3,000 - $8,000",
      "startupCostEstimate": "$1,000 - $3,000",
      "breakEvenTimeframe": "4 - 8 months"
    },
    "riskAssessment": {
      "level": "Medium",
      "risks": [
        { "risk": "...", "mitigation": "..." }
      ]
    },
    "industryTrends": ["...", "...", "..."],
    "recommendedStructure": {
      "type": "LLC",
      "reason": "..."
    }
  }
}
```

**Validation Error `400`:**
```json
{
  "success": false,
  "message": "Validation failed. Please check your request.",
  "errors": [
    { "field": "businessIdea", "message": "businessIdea must be at least 10 characters long." }
  ]
}
```

**Server Error `500`:**
```json
{
  "success": false,
  "message": "An internal server error occurred. Please try again."
}
```

---

## 🧪 Testing with curl

```bash
# Health check
curl http://localhost:5000/api/health

# Analyze an idea
curl -X POST http://localhost:5000/api/analyze-idea \
  -H "Content-Type: application/json" \
  -d '{"businessIdea": "A subscription box service that delivers curated art supplies for hobbyist painters every month"}'
```

---

## 🔮 Planned Future Phases

- **Phase 2**: MongoDB/PostgreSQL persistence — save reports to a user's Documents Vault
- **Phase 3**: JWT + OAuth 2.0 authentication middleware
- **Phase 4**: Rate limiting and usage quotas per user tier

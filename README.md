# 🚀 LaunchPad AI — Startup Valuation & Business Plan Engine

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18%2B-000000?style=for-the-badge&logo=express&logoColor=white)](#getting-started)
[![Zod](https://img.shields.io/badge/Zod-Validation-3E67B1?style=for-the-badge&logo=zod&logoColor=white)](#zod-request-schema-validation)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](#dual-provider-ai-strategy-controller)
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude--3.5-D97706?style=for-the-badge&logo=anthropic&logoColor=white)](#dual-provider-ai-strategy-controller)
[![Groq](https://img.shields.io/badge/Groq-llama--3.3-orange?style=for-the-badge)](#dual-provider-ai-strategy-controller)

---

**LaunchPad AI** is a professional-grade Node.js strategy engine designed to help founders analyze business viability, evaluate funding matches, and draft comprehensive business proposals. Powered by **Express**, **Zod**, **OpenAI**, **Anthropic Claude**, and **Groq**, it provides fully validated idea diagnostics and strategy generation.

</div>

---

## 🛠️ Technical Architecture

LaunchPad AI functions as a modular business intelligence microservice.

```
+-------------------------------------------------------------+
|                      CLIENT INGESTION                       |
|   Submits Pitch / Idea Details  <--->  Receives Reports     |
+------------------------------+------------------------------+
                               | (HTTP POST /api/analyze-idea)
                               v
+-------------------------------------------------------------+
|                      EXPRESS APP ROUTER                     |
|  Validates JSON body structures via Zod validation schemas  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|               STRATEGY CONTROLLER COORDINATOR               |
|  Loads settings and routes to OpenAI/Anthropic based on env  |
+------------------------------+------------------------------+
                               |
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
+-----------------------+               +-----------------------+
|  OPENAI GPT SERVICE   |               |  ANTHROPIC CLAUDE SVC |
|  - JSON mode parser   |               |  - System prompts     |
|  - GPT-4o-mini engine |               |  - Claude 3.5 Sonnet  |
+-----------------------+               +-----------------------+
```

### Core Code Modules & Responsibilities

*   App Entry:
    *   [`server.js`](server.js): Initializes the Express application, configures CORS, binds logging, and handles the registration of the global exception catcher.
*   `app/api/` Layer:
    *   [`index.js`](app/api/index.js): Centralized API router mounting endpoint routes and exposing the system health route.
    *   [`routes/analyzeIdea.route.js`](app/api/routes/analyzeIdea.route.js): Implements the idea analysis POST route, running request validation before triggering AI analysis.
*   `app/schemas/` Layer:
    *   [`analyzeIdea.schema.js`](app/schemas/analyzeIdea.schema.js): Zod structural validation schemas specifying strict type, length, and format boundaries.
*   `app/services/` Layer:
    *   [`ai.service.js`](app/services/ai.service.js): Unified strategy controller dynamically resolving completions via OpenAI or Anthropic models depending on the config variables.
*   `app/utils/` Layer:
    *   [`errorHandler.js`](app/utils/errorHandler.js): Catches all route errors, formats message outputs, and sets appropriate HTTP status codes.

---

## ⚡ Core Integration Interfaces

<details>
<summary><b>📐 Zod Request Schema Validation</b></summary>

Validates input payloads at the route layer. Zod intercepts malformed payloads before they hit LLM APIs, returning detailed validation reports containing exact field failure summaries.
</details>

<details>
<summary><b>🤖 Multi-Provider AI Strategy Controller</b></summary>

Integrates a provider strategy loader:
*   **OpenAI GPT-4o-mini**: Executes JSON schema-enforced runs.
*   **Anthropic Claude 3.5 Sonnet**: Employs structural prompt parsing.
*   **Groq API**: Offers extremely fast, cost-effective completions using models like `llama-3.3-70b-versatile` with compatible JSON schema parsing support.
The active provider is determined by changing `AI_PROVIDER` (`openai` | `anthropic` | `groq`) inside the environment variables.
</details>

<details>
<summary><b>🔒 Global Exception Handler Middleware</b></summary>

Standardizes API responses during execution errors. If an LLM times out or credentials fail, the controller bubbles up the error to a central Express middleware, shielding system directories and outputting clean JSON messages.
</details>

---

## 🚀 Getting Started

### 1. Requirements
*   Node.js 18+
*   npm or pnpm package manager

### 2. Configurations Setup
1.  Copy `.env.example` to a new `.env` file:
    ```bash
    cp .env.example .env
    ```
2.  Set your credentials:
    ```env
    PORT=8000
    AI_PROVIDER=openai # openai | anthropic | groq
    OPENAI_API_KEY=sk-proj-your-key-here
    ANTHROPIC_API_KEY=sk-ant-your-key-here
    GROQ_API_KEY=gsk_your-key-here
    GROQ_MODEL=llama-3.3-70b-versatile
    ```

### 3. Installation & Run
Install dependencies:
```bash
npm install
```

Start the server:
```bash
# Start in production mode
npm start

# Start in development mode (with nodemon)
npm run dev
```
The server will start at `http://localhost:8000`. You can verify execution status by pinging:
`http://localhost:8000/api/health`

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

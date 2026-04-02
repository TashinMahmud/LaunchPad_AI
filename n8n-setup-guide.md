# LaunchPad AI — n8n Workflow Setup Guide

> **For:** Automation / Operations Team  
> **Purpose:** Complete setup reference for all n8n workflows powering the LaunchPad AI platform.  
> Every section can be completed independently — credentials are shared across workflows.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Global Credential Setup](#2-global-credential-setup) ← **Do this first, once**
3. [Workflow 1 — Business Plan PDF Generator & Emailer](#3-workflow-1--business-plan-pdf-generator--emailer)
4. [Workflow 2 — Service Marketplace Order Router](#4-workflow-2--service-marketplace-order-router)
5. [Planned Workflows 3–6](#5-planned-workflows-36)
6. [Adding a New Workflow (Template)](#6-adding-a-new-workflow-template)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

### n8n Instance

You need a running n8n instance — either:

| Option | Best For | Link |
|---|---|---|
| **n8n Cloud** | Fastest to start, managed hosting | [app.n8n.cloud](https://app.n8n.cloud) |
| **Self-Hosted (Docker)** | Full control, no usage limits | [docs.n8n.io/hosting](https://docs.n8n.io/hosting/) |
| **Railway / Render** | Free self-hosted tier | Search "n8n on Railway" |

> **Minimum version:** n8n **1.0+** (all workflows use Switch v1, HTTP Request v4.1, emailSend v2.1)

### Node.js Backend
The LaunchPad AI Express backend must already be running and accessible. Workflows are triggered by it via webhook calls. No additional backend changes are needed for workflows 3–6.

---

## 2. Global Credential Setup

> **Create these once.** Every workflow references these credentials by name.  
> In n8n: **Settings → Credentials → Add Credential**

---

### 2A. SMTP (Email Sending)

Used by: **All workflows that send emails**

| Field | Value |
|---|---|
| Credential Name | `LaunchPad SMTP` |
| Provider | Your choice: Gmail, SendGrid, Mailgun, etc. |

**Gmail (App Password) steps:**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already on
3. Search for **"App passwords"** → Create one for "Mail"
4. Copy the 16-character password

**n8n SMTP fields:**
```
Host:       smtp.gmail.com
Port:       465
User:       your@gmail.com
Password:   [the 16-char app password]
SSL/TLS:    ✅ Enable
```

**SendGrid (recommended for production):**
```
Host:       smtp.sendgrid.net
Port:       587
User:       apikey
Password:   SG.your_sendgrid_api_key
```

> Update `fromEmail` fields in all email nodes to match the sending address above.

---

### 2B. PDFShift API Key (HTTP Basic Auth)

Used by: **Workflow 1 — Business Plan PDF Generator**

1. Sign up at [pdfshift.io](https://pdfshift.io) (free tier: 50 conversions/month)
2. Copy your API key from the dashboard

**n8n credential fields:**
```
Credential Name:  PDFShift API Key
Type:             HTTP Basic Auth
Username:         [your PDFShift API key]
Password:         [leave blank]
```

---

### 2C. Slack Incoming Webhook

Used by: **Workflow 2 — Order Router (Branch A: CEO Intensive)**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From Scratch**
2. App name: `LaunchPad AI Bot` | Choose your workspace
3. Click **Incoming Webhooks** → Toggle **Activate Incoming Webhooks: ON**
4. Click **Add New Webhook to Workspace** → Select your **#sales** or **#alerts** channel
5. Copy the Webhook URL (format: `https://hooks.slack.com/services/T.../B.../XXXX`)

**Where to paste it in n8n:**
- Open Workflow 2 → Node `A — Slack: Notify Internal Team`
- Replace the placeholder URL with your copied Webhook URL directly in the URL field

> No credential needed — the webhook URL IS the auth. Store it securely.

---

### 2D. ClickUp API (Task Creation)

Used by: **Workflow 2 — Order Router (Branch B: Done-For-You)**

**Step 1 — Get your API Token:**
1. Log into [app.clickup.com](https://app.clickup.com)
2. Go to **Settings → Apps** → Copy your **Personal API Token**

**Step 2 — Get your List ID:**
1. Navigate to the list where fulfillment tasks should be created (e.g., "Client Projects")
2. Click the **...** next to the list name → **Copy Link**
3. The List ID is the last number in the URL: `https://app.clickup.com/12345678/v/l/li/**901234567**`

**Where to paste in n8n:**
- Open Workflow 2 → Node `B — ClickUp: Create Fulfillment Task`
- Replace `YOUR_CLICKUP_API_TOKEN` in the **Authorization** header
- Replace `YOUR_CLICKUP_LIST_ID` in the URL path

---

## 3. Workflow 1 — Business Plan PDF Generator & Emailer

**File:** `n8n-business-plan-workflow.json`  
**Triggered by:** `POST /api/generate-business-plan` on the Node.js backend (fire-and-forget after the 200 response)

### Import Steps
1. n8n → **Workflows** → **New Workflow**
2. Click **⋯ (3-dot menu)** → **Import from JSON**
3. Paste the full contents of `n8n-business-plan-workflow.json`
4. Click **Save**

### Node-by-Node Configuration

| Node | Action Required |
|---|---|
| **Webhook — Receive Plan** | None. URL is auto-generated on activation. |
| **Code — Format HTML Document** | None. Logic is complete. |
| **HTTP — Convert HTML to PDF** | Assign the `PDFShift API Key` credential (created in §2B) |
| **Email — Send Plan to User** | Assign the `LaunchPad SMTP` credential (created in §2A). Update `fromEmail` if needed. |

### Activation & URL Copy

1. Toggle **Active: ON** (top right of workflow editor)
2. Open node **Webhook — Receive Plan**
3. Copy the **Production URL** — it looks like:
   ```
   https://your-n8n.com/webhook/business-plan-pdf
   ```
4. Paste this into your `.env` file on the Node.js backend:
   ```env
   N8N_WEBHOOK_URL=https://your-n8n.com/webhook/business-plan-pdf
   ```
5. Restart the backend server

### Test It
```bash
curl -X POST https://your-n8n.com/webhook/business-plan-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "your@email.com",
    "businessPlan": {
      "companyName": "TestCo",
      "executiveSummary": "A test company.",
      "missionStatement": "To test n8n workflows.",
      "targetMarket": "QA engineers.",
      "productsAndServices": ["Service A", "Service B", "Service C"],
      "revenueModel": "Monthly subscription at $99/month.",
      "marketingStrategy": ["Step 1", "Step 2", "Step 3"]
    }
  }'
```
**Expected:** n8n execution succeeds, PDF email arrives in inbox within ~30 seconds.

---

## 4. Workflow 2 — Service Marketplace Order Router

**File:** `n8n-marketplace-order-router.json`  
**Triggered by:** Your backend or Stripe webhook (payment confirmation events)

### Import Steps
Same as Workflow 1 — import via **⋯ → Import from JSON**.

### Node-by-Node Configuration

| Node | Action Required |
|---|---|
| **Webhook — Receive Order** | None. URL auto-generated on activation. |
| **Switch — Route by Service** | Matches on exact string. Values must match what your backend sends for `servicePurchased`. |
| **A — Email: Receipt + Calendly Link** | Assign `LaunchPad SMTP`. Replace Calendly URL placeholder. |
| **A — Slack: Notify Internal Team** | Replace URL with your Slack Incoming Webhook URL (§2C). |
| **B — Email: Onboarding Questionnaire** | Assign `LaunchPad SMTP`. Replace form URL with your Typeform/Google Form link. |
| **B — ClickUp: Create Fulfillment Task** | Replace API Token + List ID (§2D). |

### Configurable Values Checklist

```
☐ Calendly URL  →  Node "A — Email" → find the href link inside the message
☐ Slack URL     →  Node "A — Slack" → URL field
☐ Form URL      →  Node "B — Email" → find the href link inside the message
☐ ClickUp Token →  Node "B — ClickUp" → Authorization header value
☐ ClickUp List  →  Node "B — ClickUp" → URL path (replace YOUR_CLICKUP_LIST_ID)
```

### Service Name Matching

The Switch node matches the **exact value** of `servicePurchased` from the incoming payload:

| servicePurchased value (exact) | Routes to |
|---|---|
| `CEO Strategy Intensive` | Branch A |
| `Done-For-You Online Business` | Branch B |
| Anything else | Fallback (no action, logged in n8n) |

> ⚠️ If you add a new service, open the Switch node → add a new Rule → connect a new branch.

### Activation & URL
After activating, copy the Production URL and configure it wherever you send payment confirmations (Stripe webhook, backend endpoint, etc.).

### Test It
```bash
# Branch A
curl -X POST https://your-n8n.com/webhook/marketplace-order \
  -H "Content-Type: application/json" \
  -d '{"userEmail":"test@email.com","userName":"Test User","servicePurchased":"CEO Strategy Intensive","amountPaid":997}'

# Branch B
curl -X POST https://your-n8n.com/webhook/marketplace-order \
  -H "Content-Type: application/json" \
  -d '{"userEmail":"test@email.com","userName":"Test User","servicePurchased":"Done-For-You Online Business","amountPaid":2997}'
```

---

## 5. Planned Workflows 3–6

> Workflow JSON files will be added here as they are built. Setup cards are pre-populated so you can configure credentials in advance.

---

### Workflow 3 — *(To Be Built)*

**Purpose:** TBD  
**File:** `n8n-workflow-3-TBD.json`  
**Triggered by:** TBD

**Likely credentials needed:**
- `LaunchPad SMTP` ✅ (already set up)
- Additional service TBD

**Setup card:** *(Will be added when workflow is built)*

---

### Workflow 4 — *(To Be Built)*

**Purpose:** TBD  
**File:** `n8n-workflow-4-TBD.json`

**Setup card:** *(Will be added when workflow is built)*

---

### Workflow 5 — *(To Be Built)*

**Purpose:** TBD  
**File:** `n8n-workflow-5-TBD.json`

**Setup card:** *(Will be added when workflow is built)*

---

### Workflow 6 — *(To Be Built)*

**Purpose:** TBD  
**File:** `n8n-workflow-6-TBD.json`

**Setup card:** *(Will be added when workflow is built)*

---

## 6. Adding a New Workflow (Template)

Use this checklist every time a new workflow JSON is imported:

```
☐ 1. Import JSON → n8n canvas
☐ 2. Assign credentials to every node that shows a red "credential" warning
☐ 3. Replace all placeholder values:
       - URLs (Slack, Calendly, forms, external APIs)
       - API tokens, list IDs, channel IDs
       - fromEmail address
☐ 4. Run a test execution (click "Execute Workflow" — does NOT require activation)
☐ 5. Check all node outputs are green (no red errors)
☐ 6. Toggle Active: ON
☐ 7. Copy Production Webhook URL
☐ 8. Paste URL into the relevant .env variable on the backend
☐ 9. Restart the backend (or update env and reload without restart if supported)
☐ 10. Run a live end-to-end test with real data
```

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| Webhook returns 404 | Workflow is not **Active**. Toggle it ON. |
| PDF email not arriving | Check n8n execution log. Common cause: PDFShift free tier exceeded (50/month). |
| Slack notification not sending | Verify the Incoming Webhook URL is the full URL including the token path. |
| ClickUp task not created | Confirm the List ID is numeric only (no letters). Check that the API token has workspace permissions. |
| Switch node falls to fallback | `servicePurchased` value in the payload doesn't exactly match the rule strings (case-sensitive). |
| SMTP auth error | Gmail requires an App Password, not your regular password. Re-read §2A. |
| n8n execution timeout | Increase timeout in n8n Settings → Workflow → Execution Timeout. Default is 3 minutes. |
| Backend not triggering workflow | Check `N8N_WEBHOOK_URL` is set in `.env` and backend was restarted after change. |

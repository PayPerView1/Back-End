# 🤖 Backend Requirements Specification — AI Chatbot Assistant

> **Project:** PayPerView Platform  
> **Document:** Backend Requirements v1.0 (English Edition)  
> **Date:** September 5, 2026  
> **Target Roles:** `CLIPPER` (Content Creator) | `BRAND` (Advertiser / Campaign Owner)

---

## 1. Overview

The AI Chatbot Assistant is a core intelligent component of the PayPerView platform. Beyond serving standard FAQs, it acts as a personalized assistant capable of inspecting and interacting with user-specific data in real time:

- **CLIPPER:** *"How much earnings did I make this week?"* — *"What is the status of my submissions?"* — *"Help me optimize my profile."*
- **BRAND:** *"How is my campaign performing?"* — *"Explain the stats of this ad."* — *"Help me draft a new campaign."*

### Core Architectural Principles

| Principle | Description |
|-----------|-------------|
| **Identity & Authentication** | Every HTTP request must identify the user via a valid Bearer JWT. |
| **Strict Data Isolation** | No user can access or view another user's threads or messages. |
| **Personalized Context** | User stats and profile details are dynamically fetched and injected prior to invoking the LLM. |
| **Server-Side Authorization** | User ID is extracted strictly from the validated JWT token server-side, never from client payloads. |

---

## 2. Authentication & Authorization

### 2.1 Mandatory JWT Protection

All endpoints under `/api/v1/ai/` MUST enforce JWT verification middleware.

```http
Authorization: Bearer <JWT_TOKEN>
```

- Missing or expired token $\rightarrow$ `401 Unauthorized`.
- `userId` and `role` are parsed strictly from the token payload.

### 2.2 Token Payload Schema

```json
{
  "sub": "user_abc123",
  "role": "CLIPPER",
  "email": "user@example.com",
  "iat": 1725000000,
  "exp": 1725086400
}
```

> ⚠️ **Security Rule:** `userId` MUST always be obtained from `req.user.id` via JWT middleware verification. Never trust `req.body.userId` or `req.query.userId`.

---

## 3. Data Isolation & Database Schema

### 3.1 Multi-Tenant Thread Scoping

Each conversation thread belongs exclusively to a single `user_id`.

```sql
-- Fetch user chat threads
SELECT * FROM chat_threads 
WHERE user_id = :currentUserId 
ORDER BY updated_at DESC;

-- Fetch thread messages with strict ownership verification
SELECT * FROM chat_messages
WHERE thread_id = :threadId
  AND thread_id IN (SELECT id FROM chat_threads WHERE user_id = :currentUserId)
ORDER BY created_at ASC;
```

> ⚠️ Attempting to query a `threadId` belonging to another user MUST return `403 Forbidden`.

### 3.2 Relational Database Schema

```sql
-- Chat Threads Table
CREATE TABLE chat_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_chat_threads_user_id ON chat_threads(user_id);
CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
```

---

## 4. API Endpoints Specification

### 4.1 Create Chat Thread

```http
POST /api/v1/ai/threads
Authorization: Bearer <token>
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "threadId": "uuid-xxxx-xxxx-xxxx",
    "createdAt": "2026-09-05T10:00:00Z"
  }
}
```

---

### 4.2 List Chat Threads

```http
GET /api/v1/ai/threads
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-xxxx-xxxx-xxxx",
      "title": "Weekly Earnings Inquiry",
      "updatedAt": "2026-09-05T10:00:00Z",
      "lastMessage": "You earned $240 this week."
    }
  ]
}
```

---

### 4.3 Fetch Thread Messages

```http
GET /api/v1/ai/threads/:threadId/messages
Authorization: Bearer <token>
```

**Validation:** Verify that `threadId` is owned by `currentUserId`, otherwise return `403 Forbidden`.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": "msg-1", "role": "user",      "content": "How much did I earn?", "createdAt": "..." },
    { "id": "msg-2", "role": "assistant", "content": "You earned $240 this week.", "createdAt": "..." }
  ]
}
```

---

### 4.4 Send Message & Generate AI Response ⭐

```http
POST /api/v1/ai/threads/:threadId/messages
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "How much did I earn this week?"
}
```

**Backend Processing Sequence:**

1. **Authenticate JWT:** Extract `userId` and `role`.
2. **Verify Thread Ownership:** Ensure `threadId` belongs to `userId`.
3. **Sanitize Input:** Guard against Prompt Injection attempts.
4. **Fetch User Context:** Query database for recent earnings, submissions, or campaign metrics.
5. **Construct System Prompt:** Inject structured role-specific context.
6. **Invoke LLM Service:** Forward conversation history and allowed function tools.
7. **Handle Tool Executions:** Execute tool queries scoped by `userId` and return results to LLM.
8. **Persist Messages:** Save both user prompt and assistant response to database.
9. **Return Response:** Send sanitized assistant response back to the client.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "During the current week, you earned $240 across 12 approved submissions.",
      "createdAt": "2026-09-05T10:05:00Z"
    }
  }
}
```

---

### 4.5 Delete Thread

```http
DELETE /api/v1/ai/threads/:threadId
Authorization: Bearer <token>
```

**Validation:** Ensure `threadId` belongs to `currentUserId`.

---

## 5. Dynamic Context Injection

Before invoking the LLM, the backend queries the database for user stats and injects them into a system prompt.

### 5.1 System Prompt — CLIPPER Role

```text
You are the intelligent assistant for the PayPerView platform.

CURRENT USER CONTEXT:
- Name: {user.fullName}
- Role: Content Creator (Clipper)
- Interests: {user.interests}

THIS WEEK'S METRICS:
- Earnings: ${earnings.thisWeek}
- Approved Submissions: {earnings.approvedCount}
- Pending Submissions: {earnings.pendingCount}

RECENT SUBMISSIONS (Last 5):
{submissions.map(s => `- ${s.campaignName}: ${s.status} ($${s.amount})`).join('\n')}

RULES:
- Respond in the language of the user prompt (Arabic or English).
- Never reveal data of other users under any circumstances.
- If requested to perform actions (e.g., submit to campaign), outline instructions without executing non-permitted operations.
```

### 5.2 System Prompt — BRAND Role

```text
You are the intelligent assistant for the PayPerView platform.

CURRENT USER CONTEXT:
- Name: {user.fullName} / Organization: {user.companyName}
- Role: Advertiser (Brand)

ACTIVE CAMPAIGNS:
{campaigns.map(c => `
  - ${c.title}: ${c.status} | Submissions: ${c.submissionsCount}
  - Budget Spent: $${c.spentBudget} / $${c.totalBudget}
  - Total Views: ${c.totalViews}
`).join('\n')}

REMAINING ACCOUNT BUDGET: ${budget.remaining}

RULES:
- Respond in the user's language.
- Never expose details of other brands or creators.
- When creating campaigns, gather required fields step-by-step.
```

---

## 6. Function Calling & Tool Definitions

The LLM is configured with function definitions (tools) allowing it to query live database metrics dynamically.

### 6.1 Tools for CLIPPER

| Tool Name | Purpose | Parameters Schema |
|-----------|---------|-------------------|
| `get_weekly_earnings` | Fetch weekly earnings breakdown | `{ week?: string }` |
| `get_monthly_earnings` | Fetch monthly earnings breakdown | `{ month?: string, year?: number }` |
| `get_submissions` | Query submissions filtered by status | `{ status?: 'pending' \| 'approved' \| 'rejected', limit?: number }` |
| `get_available_campaigns` | List active campaigns open for submission | `{ category?: string, limit?: number }` |
| `get_campaign_details` | View specific campaign requirements | `{ campaignId: string }` |
| `get_profile_summary` | Summary of user account status | `{}` |

### 6.2 Tools for BRAND

| Tool Name | Purpose | Parameters Schema |
|-----------|---------|-------------------|
| `get_campaign_stats` | Detailed metrics for a specific campaign | `{ campaignId: string }` |
| `list_campaigns` | List brand campaigns | `{ status?: 'active' \| 'paused' \| 'ended', limit?: number }` |
| `get_budget_summary` | Query account balances and spend rates | `{}` |
| `get_submissions_for_campaign` | Query creator submissions on a campaign | `{ campaignId: string, status?: string }` |
| `create_campaign_draft` | Initialize a new draft campaign | `{ title, description, budget, category, deadline }` |
| `get_account_summary` | Summary of advertiser account stats | `{}` |

---

## 7. System Architecture & Integration Flow

This section illustrates how Frontend (Next.js), Backend (Express/Node.js), Database (PostgreSQL), and AI Service communicate seamlessly.

### 7.1 Architecture Topology

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                           │
│                                                                     │
│   AIAssistantPanel.js                                               │
│   ┌─────────────────────────────────────┐                           │
│   │  User types message                 │                           │
│   │  → chatService.sendMessage(msg)     │                           │
│   │  → displays loading spinner         │                           │
│   │  → renders AI response              │                           │
│   └────────────────┬────────────────────┘                           │
│                    │ HTTP POST + Bearer JWT                          │
└────────────────────┼────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BACKEND (Express / Node.js)                       │
│                                                                     │
│   ① authenticateJWT()     → Extracts userId + role from JWT         │
│   ② verifyThreadOwner()   → Verifies thread belongs to userId       │
│   ③ sanitizeMessage()     → Filters prompt injection risks          │
│   ④ buildUserContext()    → Queries DB for user-scoped context      │
│   ⑤ buildSystemPrompt()   → Constructs role-based system prompt     │
│   ⑥ callAIService()       → Sends prompt & tools to LLM Provider    │
│   ⑦ handleToolCalls()     → Executes function calls against DB      │
│   ⑧ saveMessages()        → Stores user and assistant messages      │
│   ⑨ sendResponse()        → Sends HTTP JSON response to Frontend    │
│                                                                     │
└────────────────────┬───────────────────────┬────────────────────────┘
                     │                       │
          ┌──────────▼──────┐    ┌───────────▼──────────┐
          │   DATABASE      │    │    AI SERVICE         │
          │   (PostgreSQL)  │    │  (OpenAI / Gemini /   │
          │                 │    │   Claude / etc.)      │
          │  - users        │    │                       │
          │  - chat_threads │    │  - Chat Completions   │
          │  - chat_messages│    │  - Function Calling   │
          │  - campaigns    │    │  - System Prompt      │
          │  - submissions  │    │                       │
          │  - earnings     │    │                       │
          └─────────────────┘    └───────────────────────┘
```

---

### 7.2 Backend Implementation Reference

#### Route Handler Specification

```javascript
// routes/ai.routes.js
const express = require('express');
const router = express.Router();

router.post(
  '/threads/:threadId/messages',
  authenticateJWT,          // 1. Verify token
  rateLimiter(30, '1m'),    // 2. Rate limit (30 reqs/min)
  verifyThreadOwner,        // 3. Verify thread ownership
  sendMessageController     // 4. Controller logic
);

module.exports = router;
```

#### Controller & Function Call Orchestration

```javascript
// controllers/chat.controller.js
async function sendMessageController(req, res) {
  const { content } = req.body;
  const { id: userId, role } = req.user;
  const { threadId } = req.params;

  // 1. Input Sanitization
  const safeContent = sanitizeUserMessage(content);

  // 2. Fetch User Context
  const userContext = await buildUserContext(userId, role);

  // 3. Fetch Conversation History (Last 20 messages)
  const history = await db.chatMessages.findAll({
    where: { thread_id: threadId },
    order: [['created_at', 'ASC']],
    limit: 20
  });

  // 4. Construct LLM Payload
  const messages = [
    { role: 'system', content: buildSystemPrompt(userContext, role) },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: safeContent }
  ];

  // 5. Invoke LLM Service
  const aiMessage = await callAIService({
    messages,
    tools: getToolsForRole(role)
  });

  // 6. Resolve Function Tool Execution if requested by LLM
  const finalResponse = await handleToolCalls(aiMessage, userId, role, messages);

  // 7. Persist Messages
  await db.chatMessages.bulkCreate([
    { thread_id: threadId, role: 'user', content: safeContent },
    { thread_id: threadId, role: 'assistant', content: finalResponse }
  ]);

  // 8. Update Thread timestamp
  await db.chatThreads.update(
    { updated_at: new Date() },
    { where: { id: threadId } }
  );

  // 9. Send JSON response
  res.json({
    success: true,
    data: { message: { role: 'assistant', content: finalResponse } }
  });
}
```

#### Secure Tool Execution Engine

```javascript
// services/toolExecutor.service.js
async function executeTool(toolName, userId, args) {
  // All DB queries are strictly constrained by userId extracted from JWT
  const tools = {
    get_weekly_earnings:     () => db.getWeeklyEarnings(userId, args.week),
    get_monthly_earnings:    () => db.getMonthlyEarnings(userId, args.month, args.year),
    get_submissions:         () => db.getSubmissions(userId, args),
    get_available_campaigns: () => db.getAvailableCampaigns(args),
    get_campaign_details:    () => db.getCampaignDetails(args.campaignId),
    get_campaign_stats:      () => db.getCampaignStats(userId, args.campaignId),
    list_campaigns:          () => db.listUserCampaigns(userId, args),
    get_budget_summary:      () => db.getBudgetSummary(userId),
    create_campaign_draft:   () => db.createCampaignDraft(userId, args),
    get_account_summary:     () => db.getAccountSummary(userId),
  };

  if (!tools[toolName]) throw new Error(`Unknown tool execution requested: ${toolName}`);
  return await tools[toolName]();
}
```

---

### 7.3 Real-Time Streaming Support (Server-Sent Events)

For optimal UX, streaming responses token-by-token via Server-Sent Events (SSE) is supported:

```javascript
// Backend SSE Controller Endpoint
async function sendMessageStreaming(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-4o',
    messages: preparedMessages,
    stream: true
  });

  let fullContent = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    fullContent += delta;
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();

  // Save complete message once stream finishes
  await saveMessages(threadId, userMessage, fullContent);
}
```

---

### 7.4 Frontend API Client Service (`src/services/chat.js`)

Frontend integration helper communicating with backend endpoints using existing `axiosInstance`:

```javascript
// src/services/chat.js
import axiosInstance from "@/lib/axiosInstance";

export async function createThread() {
  const res = await axiosInstance.post('/api/v1/ai/threads');
  return res.data.data.threadId;
}

export async function listThreads() {
  const res = await axiosInstance.get('/api/v1/ai/threads');
  return res.data.data;
}

export async function getMessages(threadId) {
  const res = await axiosInstance.get(`/api/v1/ai/threads/${threadId}/messages`);
  return res.data.data;
}

export async function sendMessage(threadId, content) {
  const res = await axiosInstance.post(`/api/v1/ai/threads/${threadId}/messages`, { content });
  return res.data.data.message;
}

export async function deleteThread(threadId) {
  await axiosInstance.delete(`/api/v1/ai/threads/${threadId}`);
}
```

---

## 8. Security & Compliance Checklist

- [x] **Zero-Trust User ID:** Client cannot pass `userId` in parameters; JWT token payload is the single source of truth.
- [x] **Database Isolation:** All queries explicitly include `WHERE user_id = currentUserId`.
- [x] **Thread Authorization:** Middleware checks ownership before returning messages or updating threads.
- [x] **Rate Limiting:** Maximum 30 chat requests per minute per IP/User.
- [x] **Prompt Injection Defense:** Input sanitization filtering control keywords and payload boundary manipulation patterns.
- [x] **Token Windowing:** History payloads truncated to a maximum of 20 messages (approx. 1500 tokens).

---

*This document serves as the official reference specification for the backend engineering team.*

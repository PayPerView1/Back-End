# API Contract — Chatbot

## 1. Overview

This document defines the API contract for the Chatbot feature in the PayPerView backend.

The frontend uses these endpoints to:
- Create a new chat thread.
- Display the user's existing chat threads.
- Load messages of a selected thread.
- Send a message and receive an AI response.
- Delete a chat thread.

### Base URL

```text
/api/v1/chat
```

All chatbot endpoints are protected by JWT authentication and rate limiting.

### Authentication

Every request must include:

```http
Authorization: Bearer <JWT_TOKEN>
```

The backend forwards the authorization token to the AI service.

### Rate Limit

The chatbot routes use **30 requests per minute**.

---

# 2. Endpoint Summary

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/chat/threads` | Create a new conversation |
| GET | `/api/v1/chat/threads` | Get the user's conversations |
| GET | `/api/v1/chat/threads/:threadId/messages` | Get messages |
| POST | `/api/v1/chat/threads/:threadId/messages` | Send message and get AI response |
| DELETE | `/api/v1/chat/threads/:threadId` | Delete conversation |

---

# 3. Create New Conversation

## Request

```http
POST /api/v1/chat/threads
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body

```json
{
  "title": "Campaign Help"
}
```

`title` is optional.

If it is not provided or is an empty string, the backend uses:

```text
New thread```

### Response — 201 Created

```json
{
  "success": true,
  "data": {
    "threadId": "66xxxxxxxxxxxxxxxxxxxxxx",
    "aiThreadId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "title": "Campaign Help",
    "createdAt": "2026-09-12T12:00:00.000Z"
  }
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Success indicator |
| `data.threadId` | string | MongoDB ID of the local chat thread |
| `data.aiThreadId` | string | Thread ID returned by the AI service |
| `data.title` | string | Conversation title |
| `data.createdAt` | string | Creation timestamp |

### Error — 500

```json
{
  "success": false,
  "message": "Server error",
  "code": "INTERNAL_ERROR"
}
```

---

# 4. Get User Conversations

## Request

```http
GET /api/v1/chat/threads
Authorization: Bearer <JWT_TOKEN>
```

No request body is required.

The backend returns only conversations belonging to the authenticated user.

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "66xxxxxxxxxxxxxxxxxxxxxx",
      "title": "Campaign Help",
      "updatedAt": "2026-09-12T12:30:00.000Z",
      "lastMessage": "How can I create a campaign?"
    },
    {
      "id": "67xxxxxxxxxxxxxxxxxxxxxx",
      "title": "New thread",
      "updatedAt": "2026-09-11T15:20:00.000Z",
      "lastMessage": "بداية محادثة جديدة"
    }
  ]
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Success indicator |
| `data` | array | List of conversations |
| `data[].id` | string | Local MongoDB thread ID |
| `data[].title` | string | Conversation title |
| `data[].updatedAt` | string | Last update timestamp |
| `data[].lastMessage` | string | Latest message content |

Threads are returned with the most recently updated first.

### Empty List

```json
{
  "success": true,
  "data": []
}
```

### Error — 500

```json
{
  "success": false,
  "message": "Server error",
  "code": "INTERNAL_ERROR"
}
```

---

# 5. Get Messages

## Request

```http
GET /api/v1/chat/threads/:threadId/messages
Authorization: Bearer <JWT_TOKEN>
```

### Path Parameter

| Parameter | Type | Description |
|---|---|---|
| `threadId` | string | Local MongoDB ID of the chat thread |

### Response — 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "70xxxxxxxxxxxxxxxxxxxxxx",
      "role": "user",
      "content": "How can I create a campaign?",
      "createdAt": "2026-09-12T12:00:00.000Z",
      "feedback": null
    },
    {
      "id": "71xxxxxxxxxxxxxxxxxxxxxx",
      "role": "assistant",
      "content": "You can create a campaign by...",
      "createdAt": "2026-09-12T12:00:03.000Z",
      "feedback": null
    }
  ]
}
```

### Message Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | MongoDB message ID |
| `role` | string | `user` or `assistant` |
| `content` | string | Message text |
| `createdAt` | string | Message creation timestamp |
| `feedback` | object or null | The user's saved feedback for an assistant message. |

Messages are returned from oldest to newest.

### Unknown or Unowned Thread — 404

```json
{
  "success": false,
  "message": "Conversation not found",
  "code": "NOT_FOUND"
}
```

### Error — 500

```json
{
  "success": false,
  "message": "Server error",
  "code": "INTERNAL_ERROR"
}
```

---

# 6. Send Message

Sends a user message to an existing conversation and returns the AI response.

## Request

```http
POST /api/v1/chat/threads/:threadId/messages
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Path Parameter

| Parameter | Type | Description |
|---|---|---|
| `threadId` | string | Local MongoDB ID of the chat thread |

### Request Body

```json
{
  "content": "How can I create a campaign?"
}
```

`content` is required and cannot be empty or whitespace-only.
The backend accepts at most 4,000 characters, matching the AI service request schema.

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "message": {
      "id": "71xxxxxxxxxxxxxxxxxxxxxx",
      "role": "assistant",
      "content": "You can create a campaign by...",
      "createdAt": "2026-09-12T12:00:03.000Z"
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Success indicator |
| `data.message.id` | string | Local MongoDB ID of the AI message |
| `data.message.role` | string | `assistant` |
| `data.message.content` | string | AI response |
| `data.message.createdAt` | string | Creation timestamp |

### Empty Message — 400

```json
{
  "success": false,
  "message": "please enter a message"
}
```

### Unknown or Unowned Thread — 404

```json
{
  "success": false,
  "message": "Conversation not found",
  "code": "NOT_FOUND"
}
```

### AI Service Errors — 502 or 503

```json
{
  "success": false,
  "message": "The AI assistant is temporarily unavailable",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

An invalid or unsuccessful upstream response uses HTTP `502` and code `AI_SERVICE_BAD_RESPONSE`. Database or other backend failures use HTTP `500` with code `INTERNAL_ERROR` and the generic message `Server error`.

---

# 7. Delete Conversation

## Request

```http
DELETE /api/v1/chat/threads/:threadId
Authorization: Bearer <JWT_TOKEN>
```

The backend:
1. Deletes the thread from the AI service.
2. Deletes associated local messages.
3. Deletes the local chat thread.

### Response — 200 OK

```json
{
  "success": true,
  "message": "thread deleted successfully"
}
```

### Unknown or Unowned Thread — 404

```json
{
  "success": false,
  "message": "Conversation not found",
  "code": "NOT_FOUND"
}
```

### AI Service Error — 502 or 503

```json
{
  "success": false,
  "message": "The AI assistant is temporarily unavailable",
  "code": "AI_SERVICE_UNAVAILABLE"
}
```

Local database failures during deletion return HTTP `500` with code `INTERNAL_ERROR`.

---

# 8. Frontend Integration Flow

## A. Open Chatbot

Call:

```http
GET /api/v1/chat/threads
```

Use `data` to display the user's conversation list.

## B. Create New Chat

Call:

```http
POST /api/v1/chat/threads
```

Example:

```json
{
  "title": "New Campaign"
}
```

Store the returned `data.threadId`.

## C. Open Existing Chat

Call:

```http
GET /api/v1/chat/threads/{threadId}/messages
```

Render:
- `role = user` → user message
- `role = assistant` → AI message

## D. Send Message

Call:

```http
POST /api/v1/chat/threads/{threadId}/messages
```

Body:

```json
{
  "content": "My question here"
}
```

Append the returned assistant message to the chat UI.

## E. Delete Chat

Call:

```http
DELETE /api/v1/chat/threads/{threadId}
```

After success, remove the conversation from the frontend list.

---

# 9. Important Frontend Notes

### Local Thread ID vs AI Thread ID

There are two IDs:

- `threadId`: MongoDB ID belonging to the PayPerView backend.
- `aiThreadId`: thread ID belonging to the AI service.

For normal frontend requests, use **`threadId`**.

The frontend does not need to call the AI service directly.

### User ID

The frontend must not send `user_id`.

The backend gets the authenticated user from:

```javascript
req.user._id
```

### AI Thread ID

The frontend does not need to send `ai_thread_id`.

The backend stores and manages it internally.

### Authentication

All endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

### JSON Requests

For requests containing JSON:

```http
Content-Type: application/json
```

---

# 10. Standard Response Pattern

Successful responses generally use:

```json
{
  "success": true,
  "data": {}
}
```

or:

```json
{
  "success": true,
  "message": "..."
}
```

Error responses generally use:

```json
{
  "success": false,
  "message": "..."
}
```

The frontend can check:

```javascript
response.data.success
```

to determine whether the operation was successful.

---

# 11. Quick Reference

```text
POST   /api/v1/chat/threads
       Create new chat

GET    /api/v1/chat/threads
       List user's chats

GET    /api/v1/chat/threads/:threadId/messages
       Get messages

POST   /api/v1/chat/threads/:threadId/messages
       Send message + receive AI response

PATCH  /api/v1/chat/threads/:threadId/messages/:messageId/feedback
       Submit feedback for an assistant message

DELETE /api/v1/chat/threads/:threadId
       Delete chat
```

---

# 12. Current Backend Limitations

Based directly on the supplied backend implementation:

1. No endpoint currently exists for renaming an existing thread.
2. Thread listing has no pagination parameters.
3. Message listing has no pagination parameters.
4. The send-message endpoint is not streaming; it waits for the AI service response and returns the completed assistant message.
5. Message content is limited to 4,000 characters to match the AI-service request schema.
6. Rate limiting is 30 requests per minute.
7. The frontend should use the local MongoDB `threadId` for chatbot endpoints.
8. A thread the caller does not own returns `404 NOT_FOUND` so its existence is not disclosed.

---

# 13. Assistant Message Feedback

```http
PATCH /api/v1/chat/threads/:threadId/messages/:messageId/feedback
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

Request:

```json
{
  "rating": "HELPFUL",
  "comment": "Optional comment, up to 1,000 characters"
}
```

`rating` is required and must be `HELPFUL` or `NOT_HELPFUL`. The thread must belong to the authenticated user and the message must be an assistant message.

Success returns `{ "success": true, "data": { "messageId": "...", "feedback": { "rating": "HELPFUL", "comment": "", "submittedAt": "..." } } }`. An inaccessible thread or missing/non-assistant message returns `404 NOT_FOUND`.

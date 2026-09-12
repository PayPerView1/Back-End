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

If it is not provided, the backend uses:

```text
New conversation```

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
  "message": "failed to create thread, please try again"
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
      "title": "New Conversation",
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
  "message": "failed to list threads, please try again"
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
      "_id": "70xxxxxxxxxxxxxxxxxxxxxx",
      "role": "user",
      "content": "How can I create a campaign?",
      "created_at": "2026-09-12T12:00:00.000Z"
    },
    {
      "_id": "71xxxxxxxxxxxxxxxxxxxxxx",
      "role": "assistant",
      "content": "You can create a campaign by...",
      "created_at": "2026-09-12T12:00:03.000Z"
    }
  ]
}
```

### Message Fields

| Field | Type | Description |
|---|---|---|
| `_id` | string | MongoDB message ID |
| `role` | string | `user` or `assistant` |
| `content` | string | Message text |
| `created_at` | string | Message creation timestamp |

Messages are returned from oldest to newest.

### Unauthorized Thread — 403

```json
{
  "success": false,
  "message": "you are not authorized to access this thread"
}
```

### Error — 500

```json
{
  "success": false,
  "message": "failed to get messages, please try again"
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

### Unauthorized Thread — 403

```json
{
  "success": false,
  "message": "you are not authorized to send messages in this thread"
}
```

### Server / AI Service Error — 500

```json
{
  "success": false,
  "message": "failed to send message, please try again"
}
```

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

### Unauthorized Thread — 403

```json
{
  "success": false,
  "message": "you are not authorized to delete this thread"
}
```

### Error — 500

```json
{
  "success": false,
  "message": "failed to delete the thread. Please try again."
}
```

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
5. Several chatbot-specific error messages are currently in Arabic.
6. Rate limiting is 30 requests per minute.
7. The frontend should use the local MongoDB `threadId` for chatbot endpoints.

# AI Service local and deployment configuration

The backend calls the AI Service server to server. Merge the variables in [`.env.ai.example`](../.env.ai.example) into the backend environment; do not copy service credentials into frontend configuration.

## Local host setup

Start the service from `C:\Users\Jebril\Desktop\AI`:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Set the backend `AI_SERVICE_BASE_URL` to `http://127.0.0.1:8001` and set `AI_SERVICE_API_KEY` to the same server-only key used by the AI Service. The service's health and readiness endpoints are `GET /health` and `GET /ready`. The readiness route reports whether the service is configured; the integration test also checks the authenticated request contract.

The AI Service's own `.env` needs `AI_SERVICE_PORT=8001`, `GEMINI_API_KEY`, the same `JWT_SECRET` used by the Express backend, the same `AI_SERVICE_API_KEY`, and a `BACKEND_URL` reachable from the AI process (for a same-host setup, `http://127.0.0.1:5000`). Its README documents the Chroma and chat-history persistence options. `/ready` checks that required configuration and local Chroma state are present, but it does not make a paid Gemini request or verify live backend credentials.

## Containers and deployment

- If backend and AI Service share a container network, use the AI Service's internal DNS/service name, such as `http://ai-service:8001`.
- If the backend runs in a container and the AI Service runs on the host, use the runtime's host gateway address. `127.0.0.1` inside a container addresses that same container.
- If deployed separately, use a private network address and restrict ingress to the backend. Do not expose the local AI listener or its service-key-protected endpoints to browser clients or the public internet.
- Configure a distinct base URL and key in development, test, and production. Keep the shared service key and Express JWT signing secret on server runtimes only.

## Timeout and unavailable behavior

`AI_SERVICE_TIMEOUT_MS` sets the bounded shared default (45 seconds). The operation-specific values in the sample preserve the existing slower campaign review, submission review, and chatbot response windows; fast recommendation/view/earnings operations retain their lower client caps. Values are bounded to 1 second through 120 seconds.

`AI_SERVICE_ENABLED=false` turns off AI calls. Missing or invalid URL/key configuration also fails closed. Optional analysis endpoints return a controlled unavailable response, campaign recommendation ranking falls back to backend signals, and campaign/submission review routes the record to manual review. An unavailable or invalid AI response is never treated as approval.

`AI_SERVICE_URL` remains a compatibility alias for existing local environments. New deployments should set `AI_SERVICE_BASE_URL`. The hardcoded hosted-service fallback has been removed.

## Live integration test

With the AI Service running and ready, run the opt-in real-service test from the backend root:

```powershell
$env:AI_SERVICE_INTEGRATION = 'true'
& .\node_modules\.bin\jest.cmd --config='{}' --runInBand src/tests/aiService.integration.test.js
Remove-Item Env:AI_SERVICE_INTEGRATION -ErrorAction SilentlyContinue
```

The test uses `/health`, `/ready`, and the deterministic authenticated language-detection endpoint. It does not call Gemini or modify Main Backend records. Ordinary unit tests keep the live-service test skipped unless the explicit opt-in flag is set.


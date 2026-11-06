# PayPerView Back-End

Express 5 + Mongoose 9 REST API. CommonJS (`require`), no build step, no TypeScript.
All endpoints live under `/api/v1`.

## Commands

- `npm start` — run the server (`server.js` → `src/app.js`)
- `npm test` — Jest (`--runInBand --detectOpenHandles`)
- `npm test -- src/tests/<name>.test.js` — single test file
- Tests need `MONGO_URI_TEST` in `.env`; they hit a real test database and build indexes in
  `beforeAll`. The first run downloads `mongod` and can take a minute — set
  `jest.setTimeout(120000)` in new suites.
- Test helpers: `src/tests/helpers/db.js` (`connect`, `clearDatabase`, `disconnect`)
  and `src/tests/helpers/factories.js`.

## Layering

```
route → controller → service → model
```

- `src/routes/<domain>/*.routes.js` — paths and middleware only
- `src/controllers/<domain>/*.controller.js` — parse request, call service, shape response
- `src/services/<domain>/*.service.js` — business logic, DB access, throws errors
- `src/models/*.js` — Mongoose schemas
- `src/validators/<domain>/*.validator.js` — request validation
- `src/middlewares/` — auth, roles, uploads, rate limits
- `src/jobs/*.job.js` — node-cron jobs; `src/utils/` — pure helpers; `src/constants/` — enums

Controllers stay thin. Business logic never lives in a controller.

## app.js ordering is load-bearing

- Webhook raw-body handlers (`/wallet/paypal/webhook`, `/wallet/moyasar/webhook`) MUST be
  registered before `express.json()`, otherwise signature verification breaks.
- Fixed paths before parameterized ones: `/campaigns/drafts` before `/campaigns`.
- A router mounted on `/api/v1` with paths spanning several prefixes must NOT use
  `router.use(protect)`; apply `protect` per route instead.
- Always check route order before adding a route under an existing prefix.

## Responses

```js
// success
{ success: true, data }              // 201 when created
// error
{ success: false, message, code }    // + errors[] for validation, details optional
```

- Prefer `AppError` and `sendError(res, err, context)` from `src/utils/errors.js`.
- `code` must exist in `STATUS_BY_CODE`; it maps to the HTTP status.
- Never leak internal messages on 5xx — `sendError` already masks them.
- Older wallet code throws plain `Error` with `error.code`; `sendError` handles both shapes.

## Validation

- Preferred: `validate({ params, query, body })` from
  `src/middlewares/validate.middleware.js` (Joi, `abortEarly:false`,
  `stripUnknown:true`, `convert:true`). Read results from `req.validated.*`.
- Legacy express-validator chains (`validateSubmitRefund`, etc.) still exist in wallet routes.
- Never reassign `req.query` — it is read-only in Express 5.

## Auth and roles

- `protect` from `src/middlewares/authMiddleware.js` (note: file name has no dot)
- `requireBrandRole`, `requireClipperRole`, `verifyCampaignOwnership`, `verifyDraftOwnership`
  from `src/middlewares/campaign/campaignValidationMiddleware.js`
- `adminOnly` from `src/middlewares/adminOnly.js` (default export)
- `src/middlewares/roleMiddleware.js` exists but is empty and unused — do not import from it.

## Style

- Code comments and user-facing messages are written in Arabic — match that.
- 2-space indent, single quotes, `const`, `async/await`.
- No ESLint or Prettier config; match the file you are editing.

## Adding an endpoint

route + controller + service + validator + test. Read one existing sibling in the same
domain and mirror its structure and error handling before writing anything.

## Scope discipline

- Read only the module you are changing; do not scan all of `src/`.
- Skip `node_modules/`, `.aider.*`, `uploads/`, and `package-lock.json`.
- Requirements live in `Requirements/` — read one sprint contract at a time, never all of them.
- Never print or commit values from `.env`.

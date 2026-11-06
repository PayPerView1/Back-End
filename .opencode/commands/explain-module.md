---
description: Map a module end to end (route, controller, service, model)
agent: plan
---
Explain the `$ARGUMENTS` module end to end.

Read only what is needed, in this order:
1. `src/routes/**/$ARGUMENTS*`
2. `src/controllers/**/$ARGUMENTS*`
3. `src/services/**/$ARGUMENTS*`
4. `src/models/**/$ARGUMENTS*`
5. related files in `src/validators/**` and `src/middlewares/**`

Then summarize:
- the HTTP endpoints (method + path)
- the request flow: route -> controller -> service -> model
- models and collections touched
- side effects (jobs, emails, payments, notifications)

Cite file paths for every claim. Do not read `node_modules/` or all of `Requirements/`.

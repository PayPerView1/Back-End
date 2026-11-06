---
description: Scaffold a new endpoint following the project's layering
agent: build
---
Add a new endpoint for: $ARGUMENTS

Follow the existing conventions:
- route in `src/routes/<domain>/`, controller in `src/controllers/<domain>/`,
  service in `src/services/<domain>/`, validator in `src/validators/<domain>/`
- business logic lives in the service, not the controller
- add a Jest test in `src/tests/` using the `mongodb-memory-server` helpers

Before writing anything, read ONE existing sibling module in the same domain and mirror its structure and error handling.
List the files you will create or change first, then implement.

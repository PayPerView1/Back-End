---
description: Locate where something is implemented, without reading whole files
agent: plan
---
Find where `$ARGUMENTS` is implemented in this project.

Use `grep` and `glob` first. Read only the matching regions, never whole files.

Reply with a short table: file path | line | one-line description of what it does.
Then state the single entry point a developer should start from.
Do not summarize unrelated code.

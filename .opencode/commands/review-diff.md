---
description: Review current changes for bugs, security issues and missing tests
agent: plan
---
Review the current changes for correctness, security and missing tests.

!`git diff --stat && git diff`

Report findings in severity order with `file:line` references.
Group them as: Blocking, Should fix, Nit.
Do not edit any files.
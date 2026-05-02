---
name: commit
description: Create a clean git commit for the intended Symphony issue changes.
---

# Commit

## Contract

- Inspect `git status --short --branch`, `git diff`, and `git diff --staged`.
- Stage only files that belong to the current issue.
- Do not include build output, logs, local environment files, or unrelated user changes.
- Run or cite the required validation before committing.
- Use a concise conventional subject and a body that records summary, rationale, and tests.

## Required Validation

```bash
npm run test
npm run build
```

## Message Shape

```text
<type>(<scope>): <imperative summary>

Summary:
- <what changed>

Rationale:
- <why this is the right narrow increment>

Tests:
- <command and result>

Co-authored-by: Codex <codex@openai.com>
```

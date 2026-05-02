---
name: push
description: Push the current Symphony issue branch and create or update its GitHub PR when GitHub auth and a pushable origin are available.
---

# Push

## Preconditions

- `gh` is installed and authenticated.
- A pushable `origin` remote exists.
- The branch contains only current-issue commits.
- Validation is green.

## Required Validation

```bash
npm run test
npm run build
```

## Flow

1. Inspect branch, status, and remotes.
2. If `origin` is missing or points to a local filesystem clone, do not push. Record a blocker in the Linear workpad.
3. Run the required validation.
4. Push with upstream tracking:

```bash
git push -u origin HEAD
```

5. If push is rejected because the branch is stale, use the `pull` skill, revalidate, then push again.
6. Create or update the PR:

```bash
gh pr view --json number,url,state,title
gh pr create --title "<clear issue outcome>" --body-file /tmp/pr-body.md
```

7. PR body must include:
   - linked Linear issue
   - summary
   - validation commands and results
   - screenshots or manual notes for UI changes
   - risks or known blockers
8. Attach the PR URL to the Linear issue.
9. Move the issue to `Human Review` only after the PR exists and validation is recorded.

---
name: land
description: Land a Symphony PR after approval by syncing, checking CI, and squash-merging when green.
---

# Land

Use this only when the Linear issue is in `Merging`.

## Preconditions

- The current branch has an open PR.
- `gh` is authenticated.
- The working tree is clean.
- Human review has approved the change or the project policy explicitly allows landing.

## Flow

1. Locate the PR:

```bash
gh pr view --json number,url,state,mergeable,headRefName,baseRefName
```

2. Sync with the PR base using the `pull` skill if needed.
3. Run:

```bash
npm run test
npm run build
```

4. Check PR status:

```bash
gh pr checks --watch
```

5. If checks fail, inspect logs, fix, commit, push, and repeat.
6. If mergeability is conflicting, sync, resolve, validate, and push.
7. Squash merge with the PR title and body:

```bash
gh pr merge --squash
```

8. Move the Linear issue to `Done` and record the merge SHA in the workpad.

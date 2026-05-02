---
name: pull
description: Sync the current Symphony issue branch with the configured upstream branch when a pushable origin exists.
---

# Pull

## Contract

1. Inspect `git status --short --branch`.
2. If the tree is dirty, commit or stash only current-issue work before merging.
3. If no `origin` remote exists, record `no origin remote configured` in the workpad and continue local execution.
4. Fetch `origin`.
5. Prefer `origin/main`; fall back to `origin/master` when this repo's default branch is still `master`.
6. Merge with conflict context:

```bash
git -c merge.conflictstyle=zdiff3 merge origin/main
```

or:

```bash
git -c merge.conflictstyle=zdiff3 merge origin/master
```

7. Resolve conflicts by preserving product behavior and this issue's intent.
8. Run:

```bash
npm run test
npm run build
```

9. Record the sync source, resulting `HEAD`, conflicts, and validation in the workpad.

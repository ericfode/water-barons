---
name: push
description:
  Push current branch changes to origin and create or update the corresponding
  pull request; use when asked to push, publish updates, or create pull request.
---

# Push

## Prerequisites

- `gh` CLI is installed and available in `PATH`.
- `gh auth status` succeeds for GitHub operations in this repo.

## Goals

- Push current branch changes to `origin` safely.
- Create a PR if none exists for the branch, otherwise update the existing PR.
- Keep branch history clean when remote has moved.

## Related Skills

- `pull`: use this when push is rejected or sync is not clean.

## Steps

1. Identify current branch and confirm remote state.
2. Run local validation before pushing:

   ```bash
   npm run test
   npm run build
   ```

3. Push branch to `origin` with upstream tracking if needed, using whatever
   remote URL is already configured.
4. If push is rejected for a non-fast-forward or stale branch, run the `pull`
   skill, revalidate, and push again.
5. If the configured remote rejects the push for auth, permissions, or workflow
   restrictions, stop and surface the exact error instead of rewriting remotes or
   switching protocols as a workaround.
6. Ensure a PR exists for the branch:
   - If no PR exists, create one.
   - If a PR exists and is open, update it.
   - If the branch is tied to a closed or merged PR, create a new branch and PR.
7. PR title/body must reflect the full current branch scope and include:
   - linked Linear issue when applicable;
   - summary of user-facing or runtime changes;
   - validation commands and results;
   - screenshots or manual notes for UI changes;
   - known risks or blockers.
8. Reply with the PR URL from `gh pr view`.

## Commands

```bash
branch="$(git branch --show-current)"

npm run test
npm run build

git push -u origin HEAD

pr_state="$(gh pr view --json state -q .state 2>/dev/null || true)"
if [ "$pr_state" = "MERGED" ] || [ "$pr_state" = "CLOSED" ]; then
  echo "Current branch is tied to a closed PR; create a new branch + PR." >&2
  exit 1
fi

pr_title="<clear PR title written for this change>"
if [ -z "$pr_state" ]; then
  gh pr create --title "$pr_title" --body-file /tmp/pr_body.md
else
  gh pr edit --title "$pr_title" --body-file /tmp/pr_body.md
fi

gh pr view --json url -q .url
```

## Notes

- Do not use `--force`; use `--force-with-lease` only when history was
  deliberately rewritten locally.
- Distinguish sync problems from remote auth/permission problems.
- Do not claim UI validation unless the changed path was actually run or
  inspected.

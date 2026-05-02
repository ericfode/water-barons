---
name: spec-writing
description:
  Write, revise, audit, or harden repository specifications, design docs,
  workflow contracts, schemas, conformance criteria, and implementation plans.
---

# Spec Writing

## Purpose

Produce durable specifications that make Waterbarons behavior explicit enough to
implement, verify, review, and hand off. Prefer a narrow, checkable contract over
an expansive document that hides uncertainty.

## Default Inputs

Read only what is needed, but start from the durable project surfaces:

- `AGENTS.md` for local operating rules.
- `README.md` for runnable setup and current project framing.
- `WORKFLOW.md` for Symphony automation behavior.
- Related files under `docs/`.
- Relevant source, tests, content data, and UI files when the spec describes
  behavior they already implement or should verify.

For Waterbarons, preserve these boundaries unless the user explicitly changes the
project direction:

- The project is a browser-based multiplayer roguelike city/basebuilder.
- It is derived from the original `ericfode/water-barons` board/card engine-builder
  concept, whose source snapshot is vendored under `reference/water-barons`.
- Runtime behavior is TypeScript/Vite/React/Phaser plus a Colyseus server.
- Project validation centers on `npm run test` and `npm run build`; UI claims need
  concrete browser or manual verification evidence.

## Workflow

1. Recover state.
   - Check `git status --short --branch`.
   - Read the current spec or nearest durable docs before drafting.
   - Inspect implementation and tests when the requested spec describes existing
     behavior.

2. Classify the spec.
   - Normative contract: required behavior and conformance language.
   - Design spec: architecture, tradeoffs, invariants, and rollout.
   - Operational spec: procedures, inputs, outputs, failure modes, and validation.
   - Product/gameplay spec: player loop, rules, balancing assumptions, and UI flow.

3. Write the smallest complete artifact.
   - Put new repo docs under `docs/` unless the project already has a canonical
     target.
   - Start with status, purpose, scope, and non-goals.
   - Define terms before relying on them.
   - Include paths, commands, examples, data shapes, and conformance tests where
     useful.
   - Name explicit open questions instead of burying guesses in prose.

4. Reconcile with reality.
   - If code and docs disagree, update the spec to match current behavior or make
     the intended behavior change explicit.
   - Keep claims auditable: say what evidence exists, what is assumed, and what is
     deferred.

5. Verify.
   - For documentation-only edits, at minimum reread the changed artifact for
     internal consistency and stale path references.
   - For code or behavior changes, run:

     ```bash
     npm run test
     npm run build
     ```

## Quality Bar

A good spec is:

- testable: it names observable behavior and gates;
- bounded: it states scope and non-goals;
- auditable: it preserves artifacts, paths, commands, and score components;
- honest: it marks unknowns and implementation-defined behavior explicitly.

Avoid:

- restating the chat thread instead of writing a contract;
- using aspirational language where a requirement is needed;
- inventing architecture not implied by the repo or user request;
- claiming verification that was not run.

## Output

When finished, report:

- the spec file written or updated;
- the behavior or contract it now fixes in place;
- verification run, or why it was not run;
- any remaining open questions that block implementation.

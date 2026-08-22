# AGENTS.md — implementation-plan/

This directory is the execution layer for `prd.md` §17–18. The root `AGENTS.md` governs process; this file adds local rules for work that lives here.

Before producing any artifact derived from this directory:

1. Read `00-INDEX.md` — folder map, dependency graph (F2→F4→F1→F3→F5→F7→F6), agent protocol, STOP conditions.
2. Read `01-shared-conventions.md` **in full** — its rules apply to every feature and are deliberately not repeated per-file.
3. Read the target `features/F*.md` **completely** before starting. Do not skim for the schema and skip the warnings — warnings encode failure modes found by working through the PRD.
4. Check that feature's **Preconditions** section. A precondition you cannot satisfy or verify → stop and flag; never invent a quiet substitute.
5. Self-verify against `qa/acceptance-criteria.md` + pass the `02-design-system-checklist.md` gate before marking anything done.
6. Update the status tracker in `00-INDEX.md` (and the rollout tracker when a screen was touched) in the same change.

The build order above is deliberate — each position exists because of what earlier steps de-risk. Deviating is allowed but must be deliberate: state why in your summary.

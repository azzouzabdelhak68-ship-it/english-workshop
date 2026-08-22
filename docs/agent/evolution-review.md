# Evolution Review — Procedure

Run when `docs/agent/evolution-state.md` says a review is due (`scripts/check-evolution-due.ps1` checks mechanically), or on any scheduled opportunity (dates containing digit 5). Reviews are **opportunities, not obligations** — the most common correct outcome is `NO_CHANGE`.

## Procedure

1. **State check** — read `evolution-state.md`. If a review was already done for this date window, stop.
2. **Collect repository evidence**
   - Lessons log (below): anything recorded since last review? Any failure repeated ≥ 2×?
   - Human corrections: prompts where you had to redo work against an explicit correction.
   - Doc drift: did the codebase/spec change such that guidance here is stale?
3. **Research scan** (time-boxed; skip if no evidence of problems) — current practices in agent instruction systems, context/harness/loop engineering, verification, memory, security. Primary docs and strong engineering sources over hype.
4. **Evaluate candidates** with the adoption filter:
   ```
   TECHNIQUE / Problem solved / Evidence / Maturity / Project relevance /
   Expected benefit / Implementation cost / Operational cost / Failure modes /
   Where it belongs (this file? AGENTS.md? skill? script? CI?) → Decision
   ```
   Decisions: ADOPT NOW · ADOPT WITHIN INFRASTRUCTURE · EXPERIMENT · MONITOR · REJECT.
5. **Decide & record** — fill one Decision Record below; append to the index in `evolution-state.md`; update `next_due`.
6. **Promote lessons** — a lesson recurring twice becomes one line in `implementation-plan/01-shared-conventions.md` naming the failure it prevents. Do not promote single hunches.

## Decision Record

```markdown
### <date> — <trigger: scheduled | missed-review | ad-hoc>
- Research performed:
- Repository evidence:
- Candidate improvements:
- Decision: UPDATED | EXPERIMENT | MONITOR | NO_CHANGE | REJECTED
- Files changed:
- Validation:
- Follow-up:
```

Keep records concise. This file must not become a second AGENTS.md.

## Lessons log

| Date | Failure observed (what the agent got wrong) | Lesson | Promoted? |
|---|---|---|---|
| — | — | — | — |

# Evolution State

Lightweight machine-readable state for the agent-system review cycle (procedure: `evolution-review.md`; policy: root `AGENTS.md` § Agent-system evolution).

```yaml
last_review: 2026-08-22
last_meaningful_update: 2026-08-22   # initial AGENTS.md operating system created
last_review_result: UPDATED          # initial creation, not a scheduled review
next_due: 2026-08-25                 # earliest upcoming date containing digit 5
```

## Rules

- `next_due` = first date after `last_review` that contains the digit 5 (5th/15th/25th).
- Reviews are opportunities, not obligations. Valid outcomes: `UPDATED`, `EXPERIMENT`, `MONITOR`, `NO_CHANGE`, `REJECTED`.
- Any substantial working session checks this file first: if `next_due` ≤ today, run `docs/agent/evolution-review.md` during that session without being asked.
- Scheduled automation (`.github/workflows/agent-evolution.yml`) activates once the repo is pushed to GitHub; until then the session-start check is the only trigger.
- `scripts/check-evolution-due.ps1` performs the due check mechanically — prefer running it over eyeballing dates.

## Decision record index

| Date | Trigger | Decision | Record |
|---|---|---|---|
| 2026-08-22 | Initial system creation | UPDATED | (initial design; adoption report in `docs/agent/adoption-report.md`) |

# Adoption Report — AGENTS.md Operating System (2026-08-22)

## Sources inspected

- `prd.md` (§1–19), `00-INDEX.md` (×2, duplicates), `01-shared-conventions.md`, `02-design-system-checklist.md`, `qa/acceptance-criteria.md`, features F1–F7 incl. the F7 subfolder.
- Research: agents.md spec + ecosystem guides (2026), Anthropic context-engineering guidance (Claude Code prompt reduction), progressive-disclosure / context-rot literature, Thoughtworks Radar Apr 2026 (progressive context disclosure: Adopt; Agent Skills: Trial; agent instruction bloat: Caution).

## Retained from existing docs

Everything substantive was already in the plan docs and stays there — the new system routes to it rather than duplicating it:

- Precedence rule (PRD > plan > process) and conflict-flagging protocol.
- RLS-first, secrets taxonomy (static vs Vault), i18n/RTL rules, migration discipline.
- Build order F2→F4→F1→F3→F5→F7→F6 with rationale.
- STOP conditions, [ASSUMPTION]/[OPEN DECISION] surfacing.
- Acceptance criteria + 12-row design gate as the definition of done.

## Added

| Addition | Why |
|---|---|
| Provenance-trap warning up top | The single most likely agent failure here: treating older-project paths (`src/lib/i18n.ts` etc.) as existing files. |
| Orientation table (task → read list) | Progressive disclosure; keeps sessions lean. |
| Operating loop with failure policy | Explicit diagnose→re-run→regression-check; stop after 2 failed hypotheses. |
| Feature-intent rule | Requests = capability slices, not patches; anti-fake-functionality rules (F7 honesty). |
| Data-vs-hardcode decision table | Encodes PRD-specific calls (enums verbatim, fallback banks as data, points default 0 behind constant). |
| Command placeholder section | Forces the first scaffolding session to record real build/test commands. |
| Knowledge map | Four memory kinds separated: stable rules / status / decisions-at-site / lessons+state. |
| Evolution system (state file, procedure, script, workflow) | Reviews on dates containing digit 5 without relying on agent memory; missed-review detection every session. |
| Nested `implementation-plan/AGENTS.md` | Nearest-file-wins for work landing directly in that subtree. |

## Adopted techniques (with filter outcomes)

- **AGENTS.md as router/index** — ADOPT NOW (root ≤ ~150 lines; every line passes "would removing this cause a mistake?").
- **Progressive disclosure** — ADOPT NOW (orientation table; deep content stays in plan docs).
- **Nested instruction files** — ADOPT NOW (implementation-plan/ only; no other subtree justifies one).
- **Executable harness over prose** — ADOPT NOW (`check-evolution-due.ps1`; CI gate once on GitHub). Soft markdown rules are ~70% compliant by research consensus; hard boundaries stay stated AND get mechanical checks where cheap.
- **Scheduled automation** — ADOPT WITHIN INFRASTRUCTURE (workflow activates on GitHub push).
- **Agent Skills format (.agents/skills/)** — MONITOR: this repo's recurring procedures are few and already live in plan docs; revisit if a third copy-paste procedure appears.

## Rejected

- **Monolithic mega-prompt** — bloat dilutes signal (ETH Zurich finding; Anthropic cut 80% of its system prompt losslessly).
- **Generic advice** ("write clean code", motivational prose) — zero project-specific value.
- **Auto-date-triggered mandatory changes** — review opportunities only; forced churn produces noise.
- **Second realtime/AI/test-runner abstractions** — already prohibited in shared conventions; not restated further.

## Experiment later

- Skills packaging (`.agents/skills/`) when the codebase exists and procedures accumulate.
- Trajectory/observability tooling once real agent sessions run against real code.

## Uncertain / open

- Which agent CLI will execute the scheduled CI review (workflow has a wiring stub).
- Whether doc-only verification (consistency checks) suffices until scaffolding — first build session must replace the command placeholder section.

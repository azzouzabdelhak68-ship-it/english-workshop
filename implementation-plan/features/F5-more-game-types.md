# F5 — More Game Types (PRD §17.5)

**Objective:** Extend the existing `GameEngine` + `HotSeatStrategy` with: Word Order Race, Rapid-Fire Vocabulary Chain, Idioms/Slang Trivia, Meme & Caption Contest (vote), Grammar Detective (fix a paragraph), Roleplay Scenario Rooms. Host picks type + difficulty + round count + per-question timer at launch.

## 🛑 Mandatory first step

This is the highest architectural-risk item in the plan because it extends existing code the agent has not seen. **Read the real `GameEngine` and `HotSeatStrategy` source before writing anything.** Everything below is a proposed interface **contingent on that read** — if the real code differs, adapt to it; do not force the real code to fit this document.

## Proposed strategy interface (illustrative — verify against real code)

```ts
interface GameStrategy {
  readonly type: GameType;
  generateRound(config: RoundConfig): Promise<RoundData>;   // AI (Groq) or static bank
  scoreAnswer(round: RoundData, answer: PlayerAnswer): ScoreResult;
  getTimerSeconds(difficulty: Difficulty): number;
  renderMode: 'select-one' | 'free-text' | 'vote' | 'ordering';
}
```

## ⚠️ Why `renderMode` is not optional

§8 describes the existing HotSeat UI as hardcoded around "options grid, select one, lock on select, green/red flash." Several new types are **structurally different**:
- **Meme & Caption Contest** is a *vote* mechanic — multiple players submit, then everyone votes. There is no single "correct answer" to flash green, so forcing it through the select-one shell produces a nonsensical game.
- **Grammar Detective** is free-text/click-to-fix, not multiple choice.

Forcing every new type through the existing single-select component will produce a broken or crippled game for at least two of the six requested types. The Playing screen needs a generic **shell + per-`renderMode` renderer** refactor *before* strategies are added — budget for this refactor as the majority of the implementation effort, not the individual strategies.

## Content generation

Reuse the existing Groq AI path (§6, §8 "Generate AI Questions") rather than standing up a second AI integration. Each strategy's `generateRound` calls a shared `generateWithGroq(promptTemplate, schema)` helper, with a **static demo-bank fallback per type** — this mirrors the existing HotSeat resilience pattern ("3 demo questions... if AI questions are loaded, they replace the bank," §8). Do not ship a new type with zero offline/failure fallback; that regresses a resilience property the platform already has.

## Host config UI

Extend the Host Projector Dashboard (§8) launch controls: game-type select, difficulty select, round-count input, per-question timer input, before "Start Game Round Now." **Persist the chosen config on the round record**, not only in the host's local React state — a host page refresh mid-round would otherwise strand any student who reconnects or joins late without a consistent config to render against.

## Vote mechanic specifics (Meme & Caption Contest)

Most novel type — needs a two-phase round (submission-phase timer, then voting-phase timer), a `round_submissions` table, and:
- Self-voting blocked at the **query/RLS level**, not just hidden in the UI (a UI-only block is bypassable via direct request).
- A defined tie-break rule — recommend "first submission wins," deterministic and simple. **[OPEN DECISION]** if a different rule is wanted.

## Roleplay Scenario Rooms — cross-reference, don't duplicate

This is really a specialization of **F3 (Breakout Rooms)** — small group + a scenario prompt — not a `GameEngine` strategy at all. Implement it as a breakout-room variant with a `scenario_prompt` field rather than building a second small-group-room subsystem inside the game engine.

## Acceptance criteria

See `qa/acceptance-criteria.md#f5`.

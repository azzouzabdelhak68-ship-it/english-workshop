# Design System Gate (from PRD §18)

Apply this checklist to **every new component** built for §17, before marking a feature done. It is a compressed, testable version of the 40-principle constitution — not a replacement for it; consult §18 in the PRD for full rationale on any row.

| # | Check | Concrete test | Common failure |
|---|---|---|---|
| 1 | Geometry | New surfaces reuse the app's existing radius/curvature scale — no ad hoc `rounded-[7px]` one-offs | A new modal with different corner radius than existing modals |
| 2 | Tactile size | Primary interactive controls ≥ 48×48dp | A new icon-only button sized to its glyph instead of its hit area |
| 3 | Spacing | New layout uses the existing spacing scale, not arbitrary px values | `gap-[13px]` instead of a scale step |
| 4 | Typography | Uses existing type scale (display/heading/body/label/caption) | A new component introducing its own font-size value |
| 5 | Color tokens | Only `petrol`/`mist`/`brass` semantic tokens (or their CSS vars) — zero raw hex, zero bare `indigo-*`/`violet-*` outside the documented remap | Copy-pasting a Tailwind snippet with `bg-blue-600` |
| 6 | Contrast | New text/background pairing meets WCAG AA (4.5:1 body, 3:1 large text) — check against the *specific* pairing, brass-on-white is a known failure already worked around with navy text | Reusing brass as a background under white text |
| 7 | Elevation | Single consistent light source/shadow direction | A new card with a shadow angle that doesn't match existing cards |
| 8 | Motion | Interactions follow `approach → hover → focus → press → release → confirmation` | A button with no visible pressed/confirmed state |
| 9 | Accessibility | Keyboard-navigable, screen-reader labeled, primary targets ≥48×48dp (secondary/dense UI floor: 24×24dp per WCAG 2.2 minimum — treat 48 as the target, 24 as the absolute floor, not the goal) | Icon button with no `aria-label` |
| 10 | Responsive | Layout recomposes at breakpoints rather than only shrinking | Text/buttons that just get smaller and smaller on narrow viewports until illegible |
| 11 | RTL correctness | Directional icons mirror, non-directional icons don't; logical spacing used throughout | Chevron pointing the wrong way in Arabic; layout using `ml-`/`mr-` |
| 12 | Zoom QA | Screen checked at 100%, 200%, and browser max zoom | Layout that overlaps or clips text at 200% |

## Rollout tracker

The app was built fresh (2026-08-22) against the Coastal/Composed/Upscale palette — every screen below was created *to this standard from day one* rather than audited after the fact. Reference components: `src/views/AnnouncementsView.tsx`, `src/views/SessionsView.tsx`. Any §17 iteration on these screens must re-pass the 12-row gate.

| Screen | Status | Owner feature (if touched by §17 work) |
|---|---|---|
| Announcements | ✅ Built to standard | — |
| Sessions | ✅ Built to standard | F2, F4 shipped here |
| Live Games | ✅ Built to standard | F5 shipped here |
| Homework | ✅ Built to standard | F1 shipped here |
| Library | ✅ Built to standard | — |
| Rankings | ✅ Built to standard | — |
| Chat | ✅ Built to standard | F3 shared `<TextChatStream>` |
| Profile Modal | ✅ Built to standard | — |
| Notifications dropdown | ✅ Built to standard | — |
| BottomNav (mobile) | ✅ Built to standard | — |
| Host Session Control Panel | ✅ Built to standard | F4 End Session trigger |
| Host Projector Dashboard | ✅ Built to standard | F5 |
| New: AI Chat Room + settings | ✅ Built to standard | F7 |
| New: Admin Analytics Dashboard | ✅ Built to standard | F6 |

Update the Status column as each screen is revised; don't wait for a single "design pass" epic at the end — every feature above already touches a screen on this list, so align it while the agent is already in that file rather than scheduling a second pass.

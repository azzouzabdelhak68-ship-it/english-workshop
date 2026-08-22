# F2 — Calendar Export (PRD §17.2)

**Objective:** Per-session `Add to Calendar` → `.ics` download + Google Calendar link, title/time/location-or-link/description, respecting the student's already-auto-detected local timezone.

No migration, no RLS change — this is a pure client-side feature reading data that already exists.

## Preconditions

- Verify `sessions` timestamps are stored as `timestamptz`, not naive `timestamp`. If naive, correct export is impossible without also knowing the org's canonical source timezone — check this first; don't assume UTC.
- Verify a duration field exists (e.g. `duration_minutes`, mirroring the pattern used elsewhere in the PRD for `session.duration_minutes` in §17.7). If sessions only store a start time with no duration, this is a genuine gap: **[OPEN DECISION]** — flag it rather than silently defaulting every exported event to an arbitrary length. If forced to pick a placeholder for scoping purposes only, use 60 minutes, but do not ship that guess without surfacing it.

## Technique — `.ics` generation

Hand-roll a minimal RFC 5545 `VEVENT` string rather than pulling in a full `ics` npm package. Rationale: a single-event export needs only `DTSTART`/`DTEND`/`SUMMARY`/`DESCRIPTION`/`LOCATION`/`URL` — a full library is unnecessary weight for a PWA where every dependency has a bundle-size cost. Store both `DTSTART`/`DTEND` in **UTC with a `Z` suffix** (`VALUE=DATE-TIME`), and skip embedding a `VTIMEZONE` block entirely — UTC-with-Z lets the receiving calendar app localize on import, which is simpler and more portable than hand-building VTIMEZONE data, a common source of subtle interop bugs across calendar apps.

```
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:<session-id>@<domain>
DTSTAMP:<now UTC>
DTSTART:<start UTC, YYYYMMDDTHHmmssZ>
DTEND:<start+duration UTC>
SUMMARY:<session title>
DESCRIPTION:<session description>
LOCATION:<location or meetingLink>
END:VEVENT
END:VCALENDAR
```

## Technique — Google Calendar link

Public, unauthenticated URL template — no API key, no server round-trip:

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=<url-encoded title>
  &dates=<start UTC>/<end UTC>
  &details=<url-encoded description>
  &location=<url-encoded location or meetingLink>
```

Opens in the student's own Google account context client-side. One real limitation worth noting in a code comment: this only works for a signed-in Google user; there's no server-side confirmation the event was actually added.

## Steps

1. Compute UTC start from the session's stored `timestamptz`.
2. Compute end = start + duration (see Preconditions above if duration is missing).
3. Build the `.ics` blob client-side; trigger download via `Blob` + `URL.createObjectURL` + a synthetic `<a download>` click — no server round-trip.
4. Build the Google Calendar link as a second button/menu option.
5. i18n: button label localized per `src/lib/i18n.ts`. For the `.ics`/Google-link text fields themselves, use the session's **English** title as the primary `SUMMARY` — calendar apps handle RTL text in these fields inconsistently across platforms. **[OPEN DECISION]** flagged for revisit if Arabic-primary users report issues.
6. Virtual sessions: use `meetingLink` as `LOCATION`/`URL`. In-person: use the `location` field verbatim — do not attempt geocoding or address structuring, none is implied by the PRD.

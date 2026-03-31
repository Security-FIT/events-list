## Conference Deadlines (GitHub Pages)

Minimal static site that loads conferences from `conferences.json` and displays:
- **Known AoE deadlines** (left column) sorted by submission time by default + live countdowns
- **TBD deadlines** (right column) with optional approximate disclosure date
- **Tag filters** (LLMs, Security, Biometrics, Speech, Usability)

It also supports a **Journals** view loaded from `journals.json`.

### `conferences.json` format

Top-level may be either:
- `{ "conferences": [ ... ] }` (recommended), or
- `[ ... ]` (array directly)

Each conference has **exactly these items**:
- `name` (string)
- `url` (string)
- `submission` (object) — either known AoE datetime or TBD
- `note` (string, optional) — shown in the Note column (if omitted, `—` is shown)
- `core_ranking` (string) — e.g. `"A*"`, `"A"`, `"B"`, `"C"`
- `tags` (array of strings) — subset of: `LLMs`, `Security`, `Biometrics`, `Speech`, `Usability`, `Blockchain`, `Quantum`, `Post-Quantum`
- `id` (optional string) — stable ID; if omitted we auto-generate one

Known deadline (AoE wall-clock, interpreted as UTC−12):

```json
{
  "name": "MyConf 2026",
  "url": "https://myconf.org",
  "note": "Optional note (e.g., abstract registration one week earlier).",
  "submission": { "type": "datetime_aot", "aot": "2026-05-15T23:59:59" },
  "core_ranking": "A",
  "tags": ["LLMs", "Security"]
}
```

Known deadline (timezone-aware ISO 8601, recommended if not AoE):

```json
{
  "name": "MyConf 2026",
  "url": "https://myconf.org",
  "note": "Optional note (e.g., local time deadline).",
  "submission": { "type": "datetime", "iso": "2026-05-15T23:59:59-04:00" },
  "core_ranking": "A",
  "tags": ["LLMs", "Security"]
}
```

TBD deadline:

```json
{
  "name": "OtherConf",
  "url": "https://otherconf.org",
  "note": "Usually announced early June",
  "submission": {
    "type": "tbd",
    "approx_disclosure_date": "2026-06-01"
  },
  "core_ranking": "B",
  "tags": ["Speech"]
}
```

### Notes on AoE/AoT

- The app supports two known-deadline encodings:
  - `datetime_aot`: `submission.aot` is a wall-clock time in **UTC−12 (AoE)**.
  - `datetime`: `submission.iso` must be ISO 8601 **with timezone** (offset or `Z`).
- Countdown uses the parsed absolute time.
- Deadlines are displayed and sorted as **AoE** (UTC−12) in the UI.
- Notes:
  - Notes are shown in the **Note** column via the top-level `note` field.

### `journals.json` format

Top-level may be either:
- `{ "journals": [ ... ] }` (recommended), or
- `[ ... ]` (array directly)

Each journal has:
- `name` (string)
- `url` (string)
- `sjr` (string) — one of: `Q1`, `Q2`, `Q3`, `Q4`, `D1` (or `""`/`-` if unknown)
- `tags` (array of strings)
- `note` (string)
- `id` (optional string)

# chaoxing-homework

Agent skill: submit or revise a homework assignment on Chaoxing (超星学习通) end-to-end —
locate the work editor (`doHomeWorkNew` / `reediter`), write the answer text, upload a
zip/rar attachment through the UEditor attachment flow, submit, and verify with
`submit=true` + status 待批阅.

Built from five successful real submission runs. Contains zero absolute paths:
all environment-specific values are `<PLACEHOLDER>`s you fill once before first use.

## Contents

| File | Purpose |
|---|---|
| `SKILL.md` | Main flow: config table + 6 steps, each with a completion criterion |
| `REFERENCE.md` | Deep-dive notes (CDP protocol, editor/attachment gotchas, zipping/rar, emulator recording, offline Android build) + failure-symptom quick table |
| `scripts/find-reediter.mjs` | Walk the iframe tree from a Chaoxing course page and print the full edit-page URL (zero-dep, Node ≥22) |
| `scripts/cdp-upload.mjs` | Real-mouse click the UEditor attachment button, inject a zip/rar via `DOM.setFileInputFiles`, poll until the attachment cloud appears (zero-dep) |

## Install

Copy the folder into your agent's skills directory, e.g.:

```powershell
Copy-Item <repo-path>\chaoxing-homework <your-skills-dir>\ -Recurse
```

The skill is model-invoked (its description carries the trigger branches). If you
prefer human-only invocation, add `disable-model-invocation: true` to the frontmatter.

## Configure before first use

Read the config table at the top of `SKILL.md` and replace every `<...>` placeholder:

- `<SESSION_NAME>`, `<SESSION_DIR>`, `<PROFILE_DIR>` — your agent-browser session and profile
- `<COURSE_ID>`, `<CLASS_ID>` — from the course page URL (`courseId` / `clazzid`)
- `<CDP_URL>` — from `agent-browser get cdp-url`, fetched fresh per session

## Requirements

- [agent-browser](https://github.com/elie222/agent-browser) (≥0.36) with a logged-in Chaoxing profile
- Node ≥22 (built-in `WebSocket`; scripts have no npm dependencies)
- For recording demos: Android SDK emulator + [ADBKeyBoard](https://github.com/senzhk/ADBKeyBoard)
  (Chinese text input) — see `REFERENCE.md`
- For `.rar` deliverables: WinRAR (`7-Zip` can only extract RAR)

## Maintenance note

Chaoxing page structure and selectors can change. When a step's completion criterion
fails against a live page, re-derive the selector with `uiautomator dump` / CDP and
update this skill (single source of truth in `REFERENCE.md`).

## License

MIT — see [LICENSE](LICENSE).

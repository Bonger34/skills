# skills

Personal agent-skills collection. The repository layout mirrors a user-level
skills directory (`~\.agents\skills\` or `~/.agents/skills/`): each skill is a
folder with its own `SKILL.md` (plus reference docs and scripts), so you can
copy individual skills into your own skills directory, or the whole tree at
once.

## Layout

```
skills/
└── chaoxing-homework/        # 超星学习通作业提交 end-to-end
    ├── SKILL.md              # main flow: config table + 6 steps (completion criteria)
    ├── REFERENCE.md          # deep-dive notes + failure-symptom quick table
    ├── README.md             # per-skill readme (install/config/maintenance)
    └── scripts/              # zero-dependency Node scripts (Node ≥22)
```

## Install (single skill)

```powershell
Copy-Item <repo>\chaoxing-homework <your-skills-dir>\ -Recurse
```

Copy the whole collection instead with:

```powershell
Copy-Item <repo>\* <your-skills-dir>\ -Recurse
```

## Skills

- **[chaoxing-homework](chaoxing-homework/)** — submit or revise a homework
  assignment on Chaoxing (超星学习通): locate the work editor (`doHomeWorkNew`
  / `reediter`), write the answer text, upload a zip/rar attachment through the
  UEditor real-mouse flow, submit, and verify (`submit=true`, status 待批阅).
  Contains no absolute paths; configure the `<placeholder>`s once before first use.

## Conventions

- Each skill folder is self-contained: `SKILL.md` is the entry point, and any
  deep-dive material lives behind a pointer in a sibling file (progressive
  disclosure per the [writing-for-agents](https://github.com/anthropics/anthropic-quickstarts)
  conventions).
- Steps carry explicit completion criteria; failure modes have a quick lookup
  table so the flow is verifiable rather than hopeful.
- No absolute paths, no environment-specific facts: everything environment-led
  is a `<PLACEHOLDER>` documented at the top of each `SKILL.md`.

## License

[MIT](LICENSE) © 2026 Bonger34

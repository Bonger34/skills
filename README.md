# Skills

Personal agent-skills collection. The repository layout mirrors the official
[anthropics/skills](https://github.com/anthropics/skills) convention: skills
live under [`skills/`](skills), each self-contained in its own folder with a
`SKILL.md` entry point, a `LICENSE.txt`, and any reference docs or scripts it
needs. New skills start from the [`template/`](template) skeleton.

> This repository contains my implementations of agent skills. For information
> about the Agent Skills standard, see [agentskills.io](https://agentskills.io).

## About This Repository

Each skill is a folder of instructions, scripts, and resources that an agent
loads dynamically to perform a specialized task in a repeatable way. Skills
range from practical workflow automation (Chaoxing homework submission) to
whatever joins the collection next. Browse [`skills/`](skills) for the
currently available skills, and copy individual folders into your own skills
directory (`~/.agents/skills/` or equivalent) to use them.

These skills are provided as-is for personal and educational use. The
implementations target the sites and tools they describe; always test a skill
in your own environment before relying on it.

## Skill sets

- [./skills](./skills) — all skills
- [./skills/chaoxing-homework](./skills/chaoxing-homework) — 超星学习通
  (Chaoxing) homework submission end-to-end: locate the work editor
  (`doHomeWorkNew` / `reediter`), write the answer text, inject a zip/rar
  attachment through the UEditor real-mouse flow, submit, and verify
  (`submit=true`, status 待批阅). No absolute paths; configure the
  `<placeholder>`s once before first use.

## Installing a skill

Copy one skill folder into your skills directory:

```powershell
Copy-Item <repo>\skills\chaoxing-homework <your-skills-dir>\ -Recurse
```

Or copy the whole collection (skills + template):

```powershell
Copy-Item <repo>\* <your-skills-dir>\ -Recurse
```

## Conventions

- **Self-contained folders**: `SKILL.md` is the entry point; deep-dive
  material lives behind a pointer in sibling files (progressive disclosure).
- **Completion criteria**: steps in a `SKILL.md` carry explicit
  "done" signals, and failure modes have a quick lookup table — the flow is
  verifiable rather than hopeful.
- **Portable**: no absolute paths and no environment-specific facts; anything
  environment-led is a documented `<PLACEHOLDER>` at the top of each `SKILL.md`.

## License

MIT © 2026 Bonger34 — see [LICENSE](LICENSE). Each skill folder also carries an
identical `LICENSE.txt`, matching the official per-skill convention.

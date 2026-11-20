# Progress — team-upgrade

Branch: `team-upgrade` (tracks `origin/team-upgrade`). Never merged to `main`,
never deployed to production. Plan: [PLAN.md](PLAN.md). Audit: [AUDIT.md](AUDIT.md).

## Done
| Phase | Commit | Summary |
|---|---|---|
| 0 Stabilize | a142c84 | Build fixes, timer bugs, repo hygiene, PWA icons, ESLint/Vitest/pytest, CI |
| 1 Physics engine | 46d50c9 | `frontend/src/physics/`: Hohmann/patched conics, ephemeris windows, rocket equation, mission model; 78 Vitest tests; App wired to engine |
| A Audit | (this commit) | AUDIT.md — architecture, backend/API, security, a11y, performance, UX/personas |
| B Plan | (this commit) | PLAN.md — Must/Should/Nice, phased |

## In progress
- Phase 2: physics extension (launch vehicles, life support, seeded events, scoring, fixed windows, golden fixtures).

## Next
See PLAN.md phase list: 3 backend mirror + Vercel API · 4 refactor/design system/a11y · 5 core experience · 6 compare/share · 7 3D · 8 delight · 9 launch quality · D final review.

## How to resume
```bash
git checkout team-upgrade && git pull
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
cd frontend && npm ci && npm run lint && npm test && npm run build
cd ../backend && .venv/bin/python -m pytest      # create venv: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
```
Then pick the first unchecked phase in PLAN.md. After each phase: lint + tests + build + pytest, commit
(`git -c user.name=... -c user.email=... commit`, message ends with the Co-Authored-By line), update this file, `git push origin team-upgrade`.

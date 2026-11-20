# Progress — team-upgrade

Branch: `team-upgrade` (tracks `origin/team-upgrade`). Never merged to `main`,
never deployed to production. Plan: [PLAN.md](PLAN.md). Audit: [AUDIT.md](AUDIT.md).

## Done
| Phase | Commit | Summary |
|---|---|---|
| 0 Stabilize | a142c84 | Build fixes, timer bugs, repo hygiene, PWA icons, ESLint/Vitest/pytest, CI |
| 1 Physics engine | 46d50c9 | `frontend/src/physics/`: Hohmann/patched conics, ephemeris windows, rocket equation, mission model; 78 Vitest tests; App wired to engine |
| A Audit | a673c83 | AUDIT.md — architecture, backend/API, security, a11y, performance, UX/personas |
| B Plan | a673c83 | PLAN.md — Must/Should/Nice, phased |
| 2 Physics extension | 14c2de8 | Launch-vehicle catalog, stage × launcher model, BVAD life support, per-phase dose, seeded events (mulberry32), recoverable-launch success factors, score/achievements, fixed window IDs, 23 golden cases in `shared/golden_cases.json`, App copy fixes; 152 Vitest tests |
| 3 Backend mirror + API + Vercel | e213721 | `backend/app/physics/` mirrors the JS engine 1:1 (mulberry32 bit-exact, JS `Date`/`%`/`toFixed` semantics in `jscompat.py`); all 23 golden cases match (rel 1e-9, key order, int/float types). FastAPI ≥ 0.115 (0.165.0) / Starlette 1.10.0 / pydantic 2.x: strict `POST /api/mission` (snake_case + camelCase aliases), `GET /api/health`, `/api/vehicles`, `/api/windows`, uniform `{error:{code,message,details}}` envelope (NaN/Infinity → 422, never 500), dev-only CORS. `api/index.py` + `vercel.json` (functions, `/api` rewrite, CSP/HSTS/COOP headers, `sw.js` no-cache), root `requirements.txt`, `.python-version` 3.12, root `pyproject.toml` (ruff lint + format), CI backend job runs ruff + pytest; 147 pytest tests |

| 4 Refactor + a11y + tooling | 8798cc7 | App.jsx 2,630 → 96 lines; state/hooks/model/components split; tokens.css; self-hosted fonts; rAF flight clock; dialog/tabs/live-region a11y; 9 s splash and localhost call removed; Prettier, eslint-plugin-react + jsx-a11y, `--max-warnings 0`; RTL tests (183 total); Vite `/api` proxy + relative API client |
| Scope revision | a74fad8 | PLAN.md §6 after user feedback: design contract, finish gate, fact check, HOW_IT_WORKS |
| Design contract | 9033de1 | docs/DESIGN.md; `npm run screenshots` (Playwright); before/Phase 4 screenshots in docs/screenshots/ |

Preview check after Phase 3: deployment Ready; `npx vercel curl <preview>/api/mission` (POST) returns a feasible mission (nuclear, 2028-12, seed 42: 160.0 d, 4 launches, score 517.2); CSP/HSTS headers served.

## In progress
- Visual-direction mockups (docs/design-mocks/), winner to be picked by Finish-Gate + Brand Guardian.
- Fact-check fixes in both engines + docs/FACT_CHECK.md.

## Notes
- Vercel preview failures since Phase 0 — FIXED. Root cause: Vercel dashboard Root Directory was `frontend`, so `cd frontend` failed; cleared to repo root on 2026-11-20 (by the user/coordinator).

## Next
See PLAN.md (§4 phases + §6 revised scope): 5 UI rewrite on DESIGN.md (hero, app shell, core experience) · 6 compare/share · 7 3D · 8 delight · 9 launch quality · D final review.

## How to resume
```bash
git checkout team-upgrade && git pull
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
cd frontend && npm ci && npm run lint && npm test && npm run build
cd ../backend && .venv/bin/python -m pytest      # create venv: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
```
Screenshots: Playwright Chromium rev 1140 must exist in ~/.cache/ms-playwright; on WSL without root, missing libs (libnss3, libnspr4, libasound2t64) can be unpacked with `apt-get download` + `dpkg-deb -x` and exposed via `LD_LIBRARY_PATH`. Then `npm run build && npx vite preview` and `npm run screenshots -- http://127.0.0.1:4173 ../docs/screenshots/<dir> <prefix>`.

Then pick the first unchecked phase in PLAN.md. After each phase: lint + tests + build + pytest, commit
(`git -c user.name=... -c user.email=... commit`, message ends with the Co-Authored-By line), update this file, `git push origin team-upgrade`.

# Mars Mission Control

Fullstack prototype implementing the design in `mars-mission-brief.md`.

## Stack
- Frontend: React + Vite + Axios
- Backend: Python + FastAPI + Uvicorn

## Run backend
1. `cd backend`
2. `python -m venv venv` (if needed)
3. `source venv/bin/activate`
4. `pip install -r requirements.txt`
5. `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## Run frontend
1. `cd frontend`
2. `npm install` or `yarn install`
3. `npm run dev`
4. Open http://localhost:5173

## API
- `POST /api/mission` with body `{ "crew_size": <2-8>, "year": 2027|2029|2031|2033|2035, "risk": <1-10> }`
- Response has per-rocket metrics scaled to scenario.  

## Next improvements
- Add user selection switching active rocket types and camera
- Persist mission results with DB (SQLite/PostgreSQL)
- Add authentication, advanced telemetry charts
- Add unit tests for backend and frontend

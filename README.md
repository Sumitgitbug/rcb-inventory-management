# Inventory Management

This workspace now contains the old SQLite/Flask backend plus a React/Vite frontend.

## Structure

- `app.py` - Flask backend and SQLite APIs
- `inventory.db` - current database snapshot
- `uploads/` - uploaded invoice files
- `src/` - React dashboard
- `templates/` - legacy Flask template fallback

## Run backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

## Run frontend

```powershell
npm install
npm run dev
```

The React app talks to `http://127.0.0.1:5000` by default. If your backend runs on a different URL, set `VITE_API_BASE_URL` in a `.env` file.

## Build frontend for Flask serving

```powershell
npm run build
python app.py
```

If a `dist/` folder exists, Flask serves the built React app from `/` and `/assets/*`.

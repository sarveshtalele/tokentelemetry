@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  .venv\Scripts\python.exe -m pip install -r requirements.txt
)
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.venv\Scripts\python.exe -m telemetry.reconcile
if not exist "frontend\node_modules" (
  pushd frontend
  call npm install
  popd
)
start "Claude Telemetry Backend" .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend
start "Claude Telemetry UI (React)" cmd /c "cd frontend && npm run dev"
start "Claude Telemetry UI (static fallback)" .venv\Scripts\python.exe -m http.server 8080
timeout /t 3 >nul
start http://localhost:5173

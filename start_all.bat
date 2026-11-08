@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   CYCLONET - LOCAL DEVELOPMENT STACK LAUNCHER
echo ========================================================
echo.

REM --- 1. Check Python & Backend Virtual Environment ---
echo [1/2] Verifying Python Backend Environment...
if not exist "backend\venv\Scripts\activate.bat" (
    echo [WARNING] Backend virtual environment not found at backend\venv.
    echo Checking for system Python...
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] Python was not found on PATH.
        echo Please install Python and run:
        echo   cd backend
        echo   python -m venv venv
        echo   .\venv\Scripts\activate
        echo   pip install -r requirements.txt
        pause
        exit /b 1
    )
    echo System python located. Attempting direct execution...
    set "START_BACKEND=python -m uvicorn app.main:app --reload --port 8000"
) else (
    echo Virtual environment verified.
    set "START_BACKEND=call .\venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
)

REM --- 2. Check Node.js and Frontend ---
echo.
echo [2/2] Verifying Next.js Frontend Environment...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found on PATH. Please install Node.js v18 or v20.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [NOTICE] frontend\node_modules is missing. Running clean dependency install...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Ensuring ports 8000 and 3000 are clear...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>nul

echo Launching services in dedicated consoles...

REM Launch Backend
cd backend
start "CycloNet - Backend API (Port 8000)" cmd /k "%START_BACKEND%"
cd ..

REM Launch Frontend
cd frontend
start "CycloNet - Next.js Web App (Port 3000)" cmd /k "npm run dev"
cd ..

echo.
echo ========================================================
echo   Servers successfully spawned!
echo   - Backend API:    http://127.0.0.1:8000
echo   - Interactive UI: http://localhost:3000
echo   - Health Status:  http://127.0.0.1:8000/health
echo ========================================================
echo.

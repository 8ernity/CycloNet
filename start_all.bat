@echo off
echo Starting Cyclone Tracker Servers...

echo [1/2] Starting Python FastAPI Backend...
cd backend
start "Cyclone Tracker - Backend" cmd /k ".\venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
cd ..

echo [2/2] Starting Next.js Frontend...
cd frontend
start "Cyclone Tracker - Frontend" cmd /k "npm run dev"
cd ..

echo Servers are starting in new windows!
echo Once they are ready, you can view the app at: http://localhost:3000

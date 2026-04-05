@echo off
echo ========================================
echo   AI Word Development Server Starter  
echo ========================================
echo.

echo [1/3] Activating conda environment...
call conda activate ai-word

echo [2/3] Starting Backend Server...
start cmd /k "cd /d %~dp0backend && conda activate ai-word && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [3/3] Starting Frontend Server...
start cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Services Started Successfully!       
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
pause

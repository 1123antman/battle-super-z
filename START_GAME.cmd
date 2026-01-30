@echo off
setlocal
:: Ensure Node.js is in PATH
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0"

echo ==========================================
echo   BATTLE SUPER Z - LAUNCHER
echo ==========================================

echo Starting Server (Window 1)...
start "Battle Super Z Server" cmd /k "npm run server"

echo Starting Client (Window 2)...
:: Using npx vite --open to auto-open browser at correct port
start "Battle Super Z Client" cmd /c "npx vite --open"

echo Game is starting...
echo If the browser does not open, please visit:
echo http://localhost:5173

endlocal

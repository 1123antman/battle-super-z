@echo off
cd /d "%~dp0"
echo ==========================================
echo       Uploading to GitHub...
echo ==========================================
echo.
git push -u origin main
echo.
echo ==========================================
if %errorlevel% neq 0 (
    echo [ERROR] Upload failed. Please check the error message above.
    echo If asking for authentication, please sign in.
) else (
    echo [SUCCESS] Upload completed!
)
echo ==========================================
pause

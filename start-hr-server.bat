@echo off
REM HR Management System - Local Server Launcher (Windows)
REM Double-click this file to start the system on http://localhost:8765

cd /d "%~dp0"

set PORT=8765
set URL=http://localhost:%PORT%/hr-system.html

echo ================================================
echo   HR Management System - Local Server
echo ================================================
echo.
echo   Serving from: %CD%
echo   URL:          %URL%
echo.
echo   Press Ctrl+C in this window to stop the server.
echo ================================================
echo.

start "" "%URL%"

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT%
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    py -m http.server %PORT%
  ) else (
    echo Python not found. Install Python 3 from python.org,
    echo or simply open hr-system.html directly in your browser.
    pause
  )
)

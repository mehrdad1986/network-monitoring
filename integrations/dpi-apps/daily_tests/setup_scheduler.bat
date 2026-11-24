@echo off
REM Windows Task Scheduler setup for daily DPI monitoring
REM Run this script as Administrator to setup daily automatic testing

echo ========================================
echo DPI Daily Monitoring - Task Scheduler Setup
echo ========================================
echo.

REM Get Python path
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python not found in PATH
    echo Please install Python and add it to PATH
    pause
    exit /b 1
)

REM Set paths
set SCRIPT_DIR=D:\kilo\daily_tests
set ORCHESTRATOR=%SCRIPT_DIR%\daily_orchestrator.py
set TASK_NAME=DPI_Daily_Monitoring

echo Installing daily monitoring task...
echo Task Name: %TASK_NAME%
echo Schedule: Daily at 03:00 AM
echo Script: %ORCHESTRATOR%
echo.

REM Delete existing task if exists
schtasks /Query /TN "%TASK_NAME%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Removing existing task...
    schtasks /Delete /TN "%TASK_NAME%" /F
)

REM Create new scheduled task
schtasks /Create ^
    /TN "%TASK_NAME%" ^
    /TR "python \"%ORCHESTRATOR%\"" ^
    /SC DAILY ^
    /ST 03:00 ^
    /RL HIGHEST ^
    /F

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: Task installed successfully!
    echo ========================================
    echo.
    echo The DPI monitoring suite will run daily at 3:00 AM
    echo.
    echo To manually run now: schtasks /Run /TN "%TASK_NAME%"
    echo To disable: schtasks /Change /TN "%TASK_NAME%" /DISABLE
    echo To view logs: Check D:\kilo\reports\daily\
    echo.
) else (
    echo.
    echo ERROR: Failed to create scheduled task
    echo Please run this script as Administrator
    echo.
)

pause

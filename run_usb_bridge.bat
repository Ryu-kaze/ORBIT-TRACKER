@echo off
title ORBIT GPS - USB Serial Cable Bridge
echo ========================================================
echo   ORBIT GPS // Auto USB Cable Bridge for COM3
echo ========================================================
echo.
echo [*] Checking Python and installing pyserial...
python -m pip install pyserial >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Trying Windows py launcher...
    py -m pip install pyserial >nul 2>&1
)

echo [*] Starting bridge on COM3 @ 115200 baud...
echo [*] (Make sure Arduino Serial Monitor is CLOSED so COM3 is free)
echo.

python backend/serial_bridge.py COM3
if %errorlevel% neq 0 (
    py backend/serial_bridge.py COM3
)

pause

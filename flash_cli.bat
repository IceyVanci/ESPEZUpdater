@echo off
setlocal enabledelayedexpansion
title ESPEZUpdater - CLI Flash Tool

rem ============================================================================
rem  flash_cli.bat -- command-line fallback (auto-detects variant and COM port;
rem  parameters are read from manifest.json)
rem
rem  Usage:
rem    flash_cli.bat                auto-pick the first variant with app.bin
rem    flash_cli.bat <variant>      use the given variant
rem    flash_cli.bat --no-erase     keep existing device config (default: erase all)
rem ============================================================================

set "TOOLDIR=%~dp0"
set "ESPTOOL=%TOOLDIR%esptool.exe"
set "FWROOT=%TOOLDIR%firmware"

set "VARIANT="
set "ERASE_ARG=--erase-all"
set "ERASE_MSG=This will ERASE ALL flash (config will be cleared, need to reconfigure)."
for %%A in (%*) do (
    if /i "%%A"=="--no-erase" (
        set "ERASE_ARG="
        set "ERASE_MSG=Keeping existing config (NVS preserved)."
    ) else (
        set "VARIANT=%%A"
    )
)

if not defined VARIANT (
    for /d %%D in ("%FWROOT%\*") do (
        if exist "%%D\app.bin" (
            set "VARIANT=%%~nxD"
            goto :gotvariant
        )
    )
    if exist "%FWROOT%\app.bin" set "VARIANT=."
)
:gotvariant

if "%VARIANT%"=="." (set "FW=%FWROOT%") else (set "FW=%FWROOT%\%VARIANT%")

echo ============================================================
echo   ESPEZUpdater - Firmware Flash (CLI fallback)
echo   Variant: %VARIANT%
echo   %ERASE_MSG%
echo ============================================================
echo.

if not exist "%FW%\app.bin" (
    echo [ERROR] firmware package not found: %FW%\app.bin
    echo         Run build_common.ps1 first, or pass a variant: flash_cli.bat ^<variant^>
    pause
    exit /b 1
)

rem ---- read chip and flash params from manifest.json ----
set "CHIP=esp32c3"
set "FLMODE=dio"
set "FLFREQ=80m"
set "FLSIZE=4MB"
for /f "delims=" %%L in ('powershell -NoProfile -Command "$m=ConvertFrom-Json ([IO.File]::ReadAllText(''%FW%\manifest.json'')); ''CHIP=''+$m.chip; ''FLMODE=''+$m.flash.mode; ''FLFREQ=''+$m.flash.freq; ''FLSIZE=''+$m.flash.size; for($i=0;$i -lt $m.files.Count;$i++){ ''OFF''+$i+''=0x''+(''{0:x}'' -f [int]$m.files[$i].offset) }"') do set "%%L"

echo Detecting %CHIP% serial port...
set "COMPORT="
for /f "delims=" %%P in ('powershell -NoProfile -Command "[System.IO.Ports.SerialPort]::GetPortNames()"') do (
    echo   probing %%P ...
    "%ESPTOOL%" --chip %CHIP% --port %%P --baud 115200 --connect-attempts 2 read-mac >nul 2>&1
    if not errorlevel 1 (
        set "COMPORT=%%P"
        goto :found
    )
)

echo.
echo [ERROR] No %CHIP% found on any COM port.
echo         - Check the USB cable and connection.
echo         - Close any other program using the port, then retry.
pause
exit /b 1

:found
echo.
echo Found %CHIP% on %COMPORT%
echo %ERASE_MSG%
echo Flashing in 3 seconds - do NOT disconnect...
timeout /t 3 /nobreak >nul
"%ESPTOOL%" --chip %CHIP% --port %COMPORT% --baud 921600 --before default-reset --after hard-reset write-flash --flash-mode %FLMODE% --flash-freq %FLFREQ% --flash-size %FLSIZE% %ERASE_ARG% %OFF0% "%FW%\bootloader.bin" %OFF1% "%FW%\partitions.bin" %OFF2% "%FW%\boot_app0.bin" %OFF3% "%FW%\app.bin"
if errorlevel 1 (
    echo.
    echo [ERROR] Flash failed. Reconnect USB and run this script again.
    pause
    exit /b 1
)
echo.
echo ============================================================
echo   Flash OK - device is restarting with the new firmware.
echo   Note: CLI does not provision WiFi; use the web tool "Provision only".
echo ============================================================
pause

@echo off
rem CladisticsPro - abre el servidor local en el puerto 9850.
rem Copyright (C) 2026  Luis Angel Barrera-Guzman. Software libre bajo la GPL v3 o posterior; ver LICENSE.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "server.ps1" -Port 9850

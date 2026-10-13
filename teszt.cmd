@echo off
rem Dupla kattintassal indithato: lefuttatja a DM Screen regresszios tesztjeit.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0teszt.ps1" %*
pause

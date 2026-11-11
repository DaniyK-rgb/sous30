@echo off
rem Sous 30 : lance le serveur local et ouvre le site dans le navigateur.
rem Fermer cette fenetre arrete le site.
title Sous 30
cd /d "%~dp0"
python server.py --ouvrir
if errorlevel 1 (
  echo.
  echo Le serveur n'a pas pu demarrer. Python 3 est-il installe ?
  pause
)

@echo off
title Devanture - lanceur
cd /d "%~dp0"

rem --- Verifie que Python est disponible -------------------------------------
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ERREUR : Python est introuvable dans le PATH.
  echo  Ouvre PowerShell dans ce dossier et lance manuellement :
  echo      python serve.py 3132 devanture
  echo.
  pause
  exit /b 1
)

echo.
echo  Demarrage du serveur Devanture...
echo  Adresse : http://localhost:3132/
echo  Le navigateur va s'ouvrir dans 2 secondes.
echo.

rem --- Lance le serveur dans SA PROPRE fenetre (a garder ouverte) ------------
rem     Fermer cette fenetre (ou Ctrl+C dedans) arrete le serveur.
start "Devanture - SERVEUR (fermer cette fenetre pour arreter)" cmd /k python serve.py 3132 devanture

rem --- Laisse le serveur demarrer puis ouvre le navigateur par defaut --------
timeout /t 2 /nobreak >nul
start "" http://localhost:3132/

exit /b 0

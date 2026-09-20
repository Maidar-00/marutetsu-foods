@echo off
chcp 65001 >nul
title Marutetsu Foods - Website
cd /d "%~dp0"

if not exist node_modules (
  echo 依存パッケージをインストールしています...（初回のみ）
  call npm install
)

echo.
echo ================================================
echo   Marutetsu Foods のサイトを起動しています...
echo   Site : http://localhost:3000
echo   Admin: http://localhost:3000/admin
echo ================================================
echo.

start "" http://localhost:3000
node server.js
pause

@echo off
chcp 65001 >nul
title 博客音乐库自动同步上线
cd /d "%~dp0"

echo ==================================================
echo   伊洛华站点 · 音乐库自动同步工具
echo   依赖: pip install mutagen Pillow
echo ==================================================
echo.

python tools/sync_music.py %*

echo.
echo ==================================================
pause

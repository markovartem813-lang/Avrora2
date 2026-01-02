@echo off
title AVRORA [LITE-CORE v8.9.15-NO-THOUGHTS]
chcp 65001 >nul
color 0d
cls

echo.
echo  [ AVRORA V8.9.15-NO-THOUGHTS ]
echo  ------------------------
echo  [INFO] Инициализация Brain Core...
echo  [INFO] Загрузка личности (HUMANITY: 500%%)...
echo  [INFO] Модуль памяти (history.json): ВОССТАНОВЛЕН (500 MSG)...
echo  [INFO] Протокол защиты ELITE: АКТИВЕН...
echo  [INFO] Voice Control: АКТИВЕН...
echo  [INFO] Social System: PASSIVE MODE (SILENT LOGS)...
echo  [INFO] Anti-Thought Filter: ACTIVE...
echo  [INFO] Command Engine: ULTIMATE (ALL FIXED)...
echo.

:: 1. Проверка Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 4f
    echo  [CRITICAL ERROR] NODE.JS НЕ УСТАНОВЛЕН!
    echo  Скачайте его тут: https://nodejs.org/
    pause
    exit
)

:: 2. Проверка модулей
if not exist node_modules (
    echo  [INFO] Установка нейромодулей...
    call npm install
    cls
    echo  [OK] Готово.
    echo.
)

:: 3. Запуск
:loop
echo  [START] Загрузка личности и базы знаний...
echo  [START] Режим: LITE CORE + GOD PROTECTION...
echo  ------------------------------------------------
node index.js
echo.
echo  ------------------------------------------------
echo  [WARN] Критическая ошибка нейросети. Ребут...
timeout /t 3 >nul
goto loop

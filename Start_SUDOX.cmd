@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 goto node_missing
where npm.cmd >nul 2>&1
if errorlevel 1 goto node_missing

if /i "%~1"=="--check" exit /b 0

call :server_ready
if not errorlevel 1 goto open_browser

echo 正在啟動阿霖的數獨島本機伺服器...
start "SUDOX Local Server" /min cmd.exe /d /c "cd /d ""%~dp0"" && npm.cmd run dev"

for /l %%I in (1,1,15) do (
  timeout /t 1 /nobreak >nul
  call :server_ready
  if not errorlevel 1 goto open_browser
)

echo.
echo 啟動逾時，請確認 4173 連接埠沒有被其他程式占用。
pause
exit /b 1

:open_browser
start "" "http://127.0.0.1:4173/"
exit /b 0

:server_ready
powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4173/' -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:node_missing
echo 找不到 Node.js 或 npm.cmd，請先安裝 Node.js 後再執行。
pause
exit /b 1

@echo off
setlocal
echo ==========================================
echo   Battle Super Z - Local Debug Starter
echo ==========================================
echo.

:: 既存のポートを占有しているプロセスを閉じるなどの処理は行わない（ユーザーに任せる）

echo [1/3] サーバーを起動しています...
start "BSZ-Server" cmd /c "npm run server"

echo [2/3] クライアント (Vite) を起動しています...
start "BSZ-Client" cmd /c "npm run dev"

echo [3/3] ブラウザを準備しています (3秒待機)...
timeout /t 3 /nobreak > nul

:: ローカルマルチプレイ確認用に2つのタブを開く
echo ブラウザで http://localhost:5173 を2つ開きます...
start http://localhost:5173
start http://localhost:5173

echo.
echo 完了しました！
echo サーバーとクライアントのコンソールウィンドウが開いています。
echo 終了する際はそれらのウィンドウを閉じてください。
echo.
pause

@echo off
cd /d "C:\Users\ineti\OneDrive\Desktop\apple-juice-source-files"
echo Starting >> server_out.log
echo PATH is %PATH% >> server_out.log
where node >> server_out.log 2>&1
node -v >> server_out.log 2>&1
if %errorlevel% neq 0 echo Node failed with %errorlevel% >> server_out.log

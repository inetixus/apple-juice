@echo off
cd /d "C:\Users\ineti\OneDrive\Desktop\apple-juice-source-files"
echo "Starting Next.js..." > vbs_out.log
npm run dev >> vbs_out.log 2>&1
echo "Finished with exit code %errorlevel%" >> vbs_out.log

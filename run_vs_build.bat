@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" >nul
where cl.exe
where vswhere
"C:\Users\samue\AppData\Local\nvm\v18.20.1\node-v18.20.1-win-x64\node.exe" --version
"C:\Users\samue\AppData\Local\nvm\v18.20.1\node-v18.20.1-win-x64\npm.cmd" --version
cd /d "C:\Users\samue\Desktop\BEST DATING\server"
"C:\Users\samue\AppData\Local\nvm\v18.20.1\node-v18.20.1-win-x64\node.exe" "C:\Users\samue\AppData\Local\nvm\v18.20.1\node-v18.20.1-win-x64\node_modules\npm\bin\npm-cli.js" rebuild --build-from-source

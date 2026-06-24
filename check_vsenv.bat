@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" >nul
if errorlevel 1 echo VSDEV ERROR %ERRORLEVEL%
where cl.exe
where vswhere
set PATH | findstr /i "VC\Tools\MSVC"
set PATH | findstr /i "Microsoft Visual Studio"

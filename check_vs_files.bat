@echo off
echo SEARCH 2022
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC" (
  dir /s /b "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\cl.exe" 2>nul
  dir /s /b "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\vcvarsall.bat" 2>nul
) else echo MISSING 2022 VC
echo SEARCH 18
if exist "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC" (
  dir /s /b "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\cl.exe" 2>nul
  dir /s /b "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\vcvarsall.bat" 2>nul
) else echo MISSING 18 VC
echo --- VSWHERE ---
"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -all -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath,installationVersion,instanceId,productId,productPath
"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" -all -products * -requires Microsoft.VisualStudio.Workload.NativeDesktop -property installationPath,installationVersion,instanceId,productId,productPath

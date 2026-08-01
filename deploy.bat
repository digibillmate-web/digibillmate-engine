@echo off
setlocal

echo ================================================
echo  DigiBillMate deploy
echo ================================================
echo.

rem --- Refuse to run with uncommitted changes -----------------------
rem Deliberately does not auto-commit: a script silently bundling
rem whatever happens to be in the working tree under a generic message
rem is how unrelated changes end up deployed together by accident.
git status --porcelain > "%TEMP%\dbm_status.txt"
for %%A in ("%TEMP%\dbm_status.txt") do set DBM_STATUS_SIZE=%%~zA
del "%TEMP%\dbm_status.txt"

if not "%DBM_STATUS_SIZE%"=="0" (
  echo You have uncommitted changes:
  echo.
  git status --short
  echo.
  echo Commit them first ^(git add / git commit^), then run this script again.
  pause
  exit /b 1
)

echo [1/2] Pushing to origin/main...
echo       This triggers the site-builder Cloudflare Pages build automatically.
echo.
git push origin main
if errorlevel 1 (
  echo.
  echo Push failed - stopping. Check the error above.
  pause
  exit /b 1
)

echo.
echo [2/2] Building and deploying admin-tool to Cloudflare Workers...
echo.
pushd admin-tool
call npm run cf:deploy
set DBM_DEPLOY_RESULT=%errorlevel%
popd

if not "%DBM_DEPLOY_RESULT%"=="0" (
  echo.
  echo admin-tool deploy failed - check the error above.
  pause
  exit /b 1
)

echo.
echo ================================================
echo  Done.
echo    site-builder: check the Cloudflare Pages dashboard for build status
echo    admin-tool:   deployed to https://websites.digibillmate.com
echo ================================================
pause

#!/bin/sh
set -eu

grep -q 'id="auto-update-enabled"' index.html
grep -q 'id="update-pill"' index.html
grep -q "var AUTO_UPDATE_PREF = 'auto_update_enabled'" index.html
grep -q "var UPDATE_API_URL = 'https://api.github.com/repos/'" index.html
grep -q 'function checkForUpdates' index.html
grep -q 'function predownloadUpdateAsset' index.html
grep -q "runBackend(\\['download-update'" index.html
grep -q "runBackend(\\['install-update'" index.html
grep -q 'function initAutoUpdateSettings' index.html
grep -q 'initAutoUpdateSettings();' index.html

grep -q '^  download-update URL TAG ASSET' scripts/priorities-backend.sh
grep -q '^  install-update TAG ASSET' scripts/priorities-backend.sh
grep -q 'validate_update_url' scripts/priorities-backend.sh
grep -q 'cached_update_path' scripts/priorities-backend.sh
grep -q 'schedule_macos_update_install' scripts/priorities-backend.sh
grep -q 'schedule_linux_update_install' scripts/priorities-backend.sh

grep -q '.update-pill' style.css
grep -q 'var(--theme_blue' style.css

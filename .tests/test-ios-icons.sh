#!/bin/sh
set -eu

icon_dir=assets/icons/ios/AppIcon.appiconset
test -f "$icon_dir/Contents.json"

for icon_file in \
  icon-20@2x.png icon-20@3x.png icon-29@2x.png icon-29@3x.png \
  icon-40@2x.png icon-40@3x.png icon-60@2x.png icon-60@3x.png \
  icon-20@1x-ipad.png icon-20@2x-ipad.png icon-29@1x-ipad.png \
  icon-29@2x-ipad.png icon-40@1x-ipad.png icon-40@2x-ipad.png \
  icon-76@1x-ipad.png icon-76@2x-ipad.png icon-83.5@2x-ipad.png \
  icon-1024.png
do
  test -f "$icon_dir/$icon_file"
done

if command -v sips >/dev/null 2>&1; then
  for icon_file in "$icon_dir"/*.png; do
    sips -g hasAlpha "$icon_file" 2>/dev/null | grep -q 'hasAlpha: no'
  done
fi

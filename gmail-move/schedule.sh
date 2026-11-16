#!/bin/zsh
# (macOS) Install (default) or remove (--remove) a daily launchd job. Usage: [CONFIG_REPO=...] ./schedule.sh [HH] [--remove]
HERE="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.usefulscripts.gmail-move.plist"
if [[ "$1" == "--remove" || "$2" == "--remove" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null; rm -f "$PLIST"; echo "removed"; exit 0
fi
HOUR="${1:-3}"
chmod +x "$HERE/run_auto.sh"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.usefulscripts.gmail-move</string>
<key>ProgramArguments</key><array><string>$HERE/run_auto.sh</string></array>
<key>EnvironmentVariables</key><dict><key>CONFIG_REPO</key><string>${CONFIG_REPO:-}</string><key>SELF_UPDATE</key><string>${SELF_UPDATE:-}</string></dict>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST" && echo "scheduled daily at ${HOUR}:00 (runs on wake if the Mac was asleep)"

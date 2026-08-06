#!/usr/bin/env bash
# Screen captures for the manual, taken the same way every time.
#
#     docs/manual/capture.sh [base-url]
#
# Headless Chrome rather than a browser-automation dependency: the binary is
# already on this machine, and the manual is the only thing that needs it.
#
# TWO THINGS THAT COST AN HOUR, both recorded here so they do not cost it again.
#
# 1. THE USER AGENT MATTERS. Without one, the NAS in front of the staging host
#    answers with a Synology "page not found" in Danish rather than the site,
#    and the capture is of that. Chrome's own headless UA string is what it
#    turns away.
#
# 2. CAPTURE THE EDITOR FROM STAGING, NEVER FROM localhost. On localhost
#    Sveltia offers a "Work with Local Repository" button that exists only
#    there. A manual showing John a button he will never see is worse than no
#    picture at all.
#
# The signed-in screens are NOT here and cannot be: they need a GitHub session,
# and this script has none. Take those by hand, in a signed-in editor, at the
# same 1100px width, and drop them in images/ with the numbering below.
set -euo pipefail

BASE="${1:-https://gosscounselling-co-uk.stage.denfrievilje.dk}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(cd "$(dirname "$0")" && pwd)/images"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

shot() {
  local name="$1" path="$2" height="${3:-620}"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --user-agent="$UA" \
    --virtual-time-budget=6000 --window-size="1100,$height" \
    --screenshot="$OUT/$name" "$BASE$path" >/dev/null 2>&1
  echo "  $name"
}

mkdir -p "$OUT"
echo "capturing from $BASE"
shot 01-sign-in.png /admin/ 620
echo "done. The signed-in editor screens are taken by hand — see the note above."

#!/usr/bin/env bash
# Screen captures for the manual, taken the same way every time.
#
#     docs/manual/capture.sh public          the screens anyone can see
#     docs/manual/capture.sh login           sign in once, by hand, in a real window
#     docs/manual/capture.sh editor          the signed-in editor screens
#
# Headless Chrome rather than a browser-automation dependency: the binary is
# already on this machine, and the manual is the only thing that needs it.
#
# THE SIGNED-IN SCREENS ARE AUTOMATABLE, and an earlier version of this file
# claimed they were not. They are, for two reasons:
#
#   1. Chrome keeps its session in a PROFILE DIRECTORY. Point it at one of our
#      own with --user-data-dir, sign in there once with `capture.sh login`,
#      and every headless run afterwards is signed in. The profile lives
#      outside the repo (see PROFILE below) — it holds a GitHub token.
#   2. Sveltia routes by URL HASH, so every screen has an address:
#      `#/collections/home` is the list, `#/collections/home/entries/hero` is
#      an entry. Nothing needs clicking, which is what made this look like it
#      needed a driver.
#
# TWO THINGS THAT COST AN HOUR, both recorded so they do not cost it again.
#
#   THE USER AGENT MATTERS. Without one, the NAS in front of the staging host
#   answers with a Synology "page not found" in Danish rather than the site,
#   and you screenshot that.
#
#   CAPTURE THE EDITOR FROM STAGING, NEVER FROM localhost. On localhost
#   Sveltia offers a "Work with Local Repository" button that exists only
#   there. A manual showing John a button he will never see is worse than no
#   picture at all.
set -euo pipefail

BASE="${BASE:-https://gosscounselling-co-uk.stage.denfrievilje.dk}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/images"
# Outside the repo on purpose: this directory holds a signed-in GitHub session.
PROFILE="${PROFILE:-$HOME/.cache/gosscounselling-manual-chrome}"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

shot() { # name path height
  local name="$1" path="$2" height="${3:-820}"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --user-agent="$UA" \
    --user-data-dir="$PROFILE" --virtual-time-budget=8000 \
    --window-size="1100,$height" \
    --screenshot="$OUT/$name" "$BASE$path" >/dev/null 2>&1
  echo "  $name"
}

mkdir -p "$OUT"

case "${1:-editor}" in
  public)
    echo "capturing the public screens from $BASE"
    shot 01-sign-in.png /admin/ 620
    ;;

  login)
    echo "Opening a real Chrome window on the profile the captures use."
    echo "Sign in to the editor, then close the window. Nothing here types anything."
    echo "  profile: $PROFILE"
    mkdir -p "$PROFILE"
    "$CHROME" --user-data-dir="$PROFILE" --new-window "$BASE/admin/"
    ;;

  editor)
    if [ ! -d "$PROFILE" ]; then
      echo "No capture profile yet. Run:  $0 login" >&2
      exit 1
    fi
    echo "capturing the signed-in editor from $BASE"
    # Sveltia's own hash routes. Nothing is clicked.
    shot 02-collections.png "/admin/#/collections/home" 820
    shot 03-entry.png "/admin/#/collections/home/entries/services" 820
    shot 05-picture-field.png "/admin/#/collections/home/entries/hero" 980
    # 04 is the Save button, which is a corner of 03 rather than a screen of
    # its own — cropped here so it cannot drift from the shot it came from.
    node -e '
      const sharp = require("sharp");
      const src = process.argv[1], dst = process.argv[2];
      sharp(src).metadata().then((m) => {
        const w = Math.round(m.width * 0.30), h = Math.round(m.height * 0.085);
        return sharp(src).extract({ left: m.width - w, top: 0, width: w, height: h }).toFile(dst);
      }).then(() => console.log("  04-save-button.png (cropped from 03)"));
    ' "$OUT/03-entry.png" "$OUT/04-save-button.png"

    # A signed-out capture is the failure this whole rig exists to avoid, and
    # it looks like a success: a real png of a sign-in screen. Refuse it.
    for f in 02-collections.png 03-entry.png; do
      if node -e '
        const sharp = require("sharp");
        sharp(process.argv[1]).stats().then((s) => {
          // The sign-in screen is near-uniform pale grey; the editor is not.
          const flat = s.channels.every((c) => c.stdev < 40);
          process.exit(flat ? 1 : 0);
        }).catch(() => process.exit(1));
      ' "$OUT/$f"; then :; else
        echo "  !! $f looks like the sign-in screen — the profile is signed out. Run: $0 login" >&2
        exit 1
      fi
    done
    ;;

  *)
    echo "usage: $0 [public|login|editor]" >&2
    exit 1
    ;;
esac
echo "done."

#!/usr/bin/env bash
# Screen captures for the manual, taken the same way every time.
#
#     docs/manual/capture.sh site            the site itself, for the front page
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

# The profile Chrome is actually pointed at. For signed-in captures this is a
# COPY of $PROFILE — Chrome refuses to open a profile another instance holds
# ("Failed to create a ProcessSingleton ... Aborting now to avoid profile
# corruption"), and the window you signed in with is exactly such an instance.
# Working on a copy means the captures do not care whether it is still open,
# and cannot corrupt the profile that holds the session.
USER_DIR="$PROFILE"

shot() { # name path height
  local name="$1" path="$2" height="${3:-820}"
  if ! "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --user-agent="$UA" \
    --user-data-dir="$USER_DIR" --virtual-time-budget=8000 \
    --window-size="1100,$height" \
    --screenshot="$OUT/$name" "$BASE$path" 2>"$OUT/.chrome.log"; then
    echo "  !! chrome failed on $name:" >&2
    tail -3 "$OUT/.chrome.log" >&2
    rm -f "$OUT/.chrome.log"
    exit 1
  fi
  # Chrome can exit 0 having written nothing at all.
  if [ ! -s "$OUT/$name" ]; then
    echo "  !! chrome exited cleanly and wrote no $name" >&2
    tail -3 "$OUT/.chrome.log" >&2
    rm -f "$OUT/.chrome.log"
    exit 1
  fi
  rm -f "$OUT/.chrome.log"
  echo "  $name"
}

mkdir -p "$OUT"

case "${1:-editor}" in
  public)
    echo "capturing the public screens from $BASE"
    shot 01-sign-in.png /admin/ 620
    ;;

  site)
    # The site itself, for the front page of the manual. Staging, not
    # production: production still carries the old site.
    echo "capturing the site from $BASE"
    shot 00-homepage.png / 900
    ;;

  login)
    echo "Opening a real Chrome window on the profile the captures use."
    echo "Sign in to the editor, then close the window. Nothing here types anything."
    echo "  profile: $PROFILE"
    mkdir -p "$PROFILE"
    "$CHROME" --user-data-dir="$PROFILE" --new-window "$BASE/admin/"
    ;;

  editor)
    # Delegated, because this one cannot be done with a screenshot flag. See
    # capture-editor.mjs: Sveltia is a single-page app that fetches the site
    # from GitHub after load, so `--screenshot` photographs its "Loading Site
    # Data…" splash, and neither --virtual-time-budget nor --timeout waits for
    # real network. It drives Chrome over the DevTools protocol and polls the
    # page for the text it expects before opening the shutter.
    #
    # An earlier version of this file guarded the result by measuring the
    # image's variance, on the theory that a splash is flatter than the editor.
    # It is not: the editor is a white form at stdev 10-23 and the splash
    # measured 6.8-29, so that test would have thrown away every good capture.
    # Polling for known text is exact and the variance test is gone.
    node "$HERE/capture-editor.mjs"
    node -e '
      const sharp = require("sharp");
      const OUT = process.argv[1];
      sharp(OUT + "/03-entry.png").metadata().then((m) =>
        sharp(OUT + "/03-entry.png")
          .extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * 0.075) })
          .toFile(OUT + "/04-save-button.png")
      ).then(() => console.log("  04-save-button.png (the entry top bar, cropped from 03)"));
    ' "$OUT"
    ;;

  *)
    echo "usage: $0 [site|public|login|editor]" >&2
    exit 1
    ;;
esac
echo "done."

# make-pictures.sh: makes the pictures of the portfolio, their captions, the gallery and the manifest,
# and then checks the whole folder. Use it inside the project folder, as often as you like:
#   bash portfolio/tools/make-pictures.sh
#
# What it does, in six steps:
#   1. looks for Google Chrome (or Chromium, Brave, Edge) on your computer; if yours is somewhere else,
#      start this script as   CHROME_PATH="/path/to/browser" bash portfolio/tools/make-pictures.sh
#   2. finds your site on http://localhost:3000, or builds it (npm run build) and starts it on port 3217
#      (set PICTURES_PORT=3300, for example, to use another port)
#   3. takes the pictures of the site and draws the architecture diagram
#   4. runs the tests (npm test) and makes a picture of the end of their output
#   5. writes manifest.json, screenshot-captions.md, gallery.html and problems/picture-problems.md
#   6. checks the whole portfolio folder
# It saves no post and changes no file of the site. The pictures are made again on every run.
# Files outside portfolio/: npm run build writes its usual output into .next/, and npm test may write
# its usual cache. Both are the normal output of those commands.

TOOLS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$TOOLS/../.." && pwd)"
cd "$ROOT" || { echo "Cannot enter the project folder: $ROOT"; exit 1; }
if grep -q '"name": "neighbor-node"' package.json 2>/dev/null; then
  :
else
  echo "This is not the neighbor-node project folder: $ROOT"
  exit 1
fi
if command -v node > /dev/null 2>&1; then
  :
else
  echo "Node.js was not found, so the pictures cannot be made."
  exit 1
fi

WORK="portfolio/.work"
PORT="${PICTURES_PORT:-3217}"
mkdir -p "$WORK" portfolio/screenshots portfolio/problems
: > "$WORK/problems.txt"
node "$TOOLS/shots.mjs" reset
SERVER_PID=""

note() {
  echo "$1" >> "$WORK/problems.txt"
  echo "  note: $1"
}

# Does a Neighbor Node site answer at this address?
site_answers() {
  node -e 'fetch(process.argv[1]).then(function (r) { return r.text(); }).then(function (t) { process.exit(t.indexOf("Neighbor Node") >= 0 ? 0 : 1); }).catch(function () { process.exit(1); })' "$1"
}

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2> /dev/null
    wait "$SERVER_PID" 2> /dev/null
    SERVER_PID=""
  fi
}
# Chrome, if it still runs with the profile of this run (after Ctrl+C, for example), is stopped.
stop_chrome() {
  ps -eo pid,args | grep "portfolio/.work/chrome-profile" | grep -v grep | awk '{print $1}' | xargs kill 2> /dev/null
  waited=0
  while [ "$waited" -lt 5 ]; do
    if ps -eo args | grep "portfolio/.work/chrome-profile" | grep -v grep > /dev/null; then
      sleep 1
      waited=$((waited + 1))
    else
      break
    fi
  done
}

# The work folder holds only temporary files of this run.
remove_work() {
  case "$ROOT/$WORK" in
    */portfolio/.work) node -e 'require("fs").rmSync(process.argv[1], { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })' "$ROOT/$WORK" ;;
  esac
}

clean_up() {
  stop_server
  stop_chrome
  remove_work
}
trap clean_up EXIT
trap 'echo; echo "Stopped."; exit 130' INT TERM

echo "Step 1 of 6: looking for a browser"
CHROME_HINT="${CHROME_PATH:-}"
CHROME_OUT="$(node "$TOOLS/browser.mjs" "$CHROME_HINT" 2>&1)"
CHROME_RC=$?
BASE=""
if [ "$CHROME_RC" -eq 0 ]; then
  echo "  found: $CHROME_OUT"
else
  echo "  $CHROME_OUT"
  note "No Chrome, Chromium, Brave or Edge was found, so no pictures were made. Install Google Chrome, then run: bash portfolio/tools/make-pictures.sh"
fi

if [ "$CHROME_RC" -eq 0 ]; then
  echo "Step 2 of 6: finding the site"
  if site_answers "http://localhost:3000"; then
    BASE="http://localhost:3000"
    echo "  using the site that already runs at $BASE"
  elif site_answers "http://localhost:$PORT"; then
    BASE="http://localhost:$PORT"
    echo "  using the site that already runs at $BASE"
  elif [ -x node_modules/.bin/next ]; then
    MODE="start"
    echo "  building the site with npm run build (this takes a minute or two) ..."
    if npm run build > "$WORK/build.log" 2>&1; then
      echo "  the build is done"
    else
      MODE="dev"
      note "npm run build did not finish, so the pictures were taken from the development server. The end of the build output: $(tail -n 8 "$WORK/build.log" | tr '\n' ' ')"
    fi
    if [ "$MODE" = "start" ]; then
      ./node_modules/.bin/next start -p "$PORT" > "$WORK/server.log" 2>&1 &
    else
      ./node_modules/.bin/next dev -p "$PORT" > "$WORK/server.log" 2>&1 &
    fi
    SERVER_PID="$(jobs -p | tail -n 1)"
    echo "  starting the site on port $PORT ..."
    for TRY in $(seq 1 120); do
      if site_answers "http://localhost:$PORT"; then
        BASE="http://localhost:$PORT"
        break
      fi
      if kill -0 "$SERVER_PID" 2> /dev/null; then
        sleep 1
      else
        break
      fi
    done
    if [ -z "$BASE" ]; then
      note "The site did not start on port $PORT. The end of its log: $(tail -n 8 "$WORK/server.log" | tr '\n' ' ')"
    fi
  else
    note "The folder node_modules/.bin/next is not there, so the site cannot be started. Run the install step of your project first, then run: bash portfolio/tools/make-pictures.sh"
  fi
fi

if [ -n "$BASE" ]; then
  echo "Step 3 of 6: taking the pictures of $BASE"
  node "$TOOLS/shots.mjs" site --base "$BASE" --chrome "$CHROME_HINT"
  SHOTS_RC=$?
  if [ "$SHOTS_RC" -ne 0 ]; then
    note "The picture tool stopped with code $SHOTS_RC."
  fi
  stop_server
else
  echo "Step 3 of 6: no pictures of the site (the site is not running)"
fi

if [ "$CHROME_RC" -eq 0 ]; then
  echo "Step 4 of 6: running the tests (this can take a few minutes)"
  NO_COLOR=1 FORCE_COLOR=0 CI=1 npm test > "$WORK/tests.txt" 2>&1
  echo "$?" > "$WORK/tests.code"
  echo "  npm test finished with exit code $(cat "$WORK/tests.code")"
  node "$TOOLS/shots.mjs" tests --chrome "$CHROME_HINT"
else
  echo "Step 4 of 6: skipped (no browser)"
fi

echo "Step 5 of 6: writing the manifest, the captions and the gallery"
node "$TOOLS/build-gallery.mjs"

echo "Step 6 of 6: checking the whole folder"
bash "$TOOLS/check-portfolio.sh"
CHECK_RC=$?

remove_work

echo
if [ "$CHECK_RC" -eq 0 ]; then
  echo "Everything was made and the check passed."
else
  echo "The check found things to fix. Read the FAIL lines above and portfolio/problems/picture-problems.md."
fi
echo "Open the pictures:  open portfolio/gallery.html"
echo "Captions and alt texts:  portfolio/screenshot-captions.md"
exit "$CHECK_RC"

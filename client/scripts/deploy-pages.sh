#!/usr/bin/env bash
# Builds the app for GitHub Pages and publishes it to the repo's gh-pages branch.
# Run from anywhere:  npm run deploy   (inside client/)
# Live at: https://andrewjounkim.github.io/eyestrain-monitor/
set -euo pipefail

cd "$(dirname "$0")/.."            # the client/ folder
REMOTE="$(git remote get-url origin)"
NAME="$(git config user.name)"
EMAIL="$(git config user.email)"

# Pages serves project sites from /<repo-name>/, so build with that base path.
BASE_PATH=/eyestrain-monitor/ npx vite build --outDir dist-pages --emptyOutDir

# .nojekyll tells Pages to serve the files as-is (no Jekyll processing).
touch dist-pages/.nojekyll

# Publish the built files as the only commit on gh-pages (replacing the previous deploy).
cd dist-pages
git init -q -b gh-pages
git add -A
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Deployed. GitHub Pages usually updates within a minute: https://andrewjounkim.github.io/eyestrain-monitor/"

#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

PROJECT="${HOME}/WaterPrint"
REPO="https://github.com/outsidegem/waterprint.git"

if [ -e "$PROJECT" ]; then
  echo "Refusing to overwrite existing $PROJECT"
  exit 1
fi

pkg update -y
pkg install -y git nodejs

git clone "$REPO" "$PROJECT"
cd "$PROJECT"

npm install
npm run check
npm run security

echo
echo "WaterPrint workspace ready: $PROJECT"
echo "Run: cd ~/WaterPrint && npm run check"

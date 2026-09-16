#!/usr/bin/env bash
#
# Re-syncs the vendored snapshot of the Angular project's static profile data.
#
# The seed must run in CI and in a Docker build, where the Angular repository is not
# available - so the JSON is vendored into prisma/data/ and committed. This script refreshes
# that snapshot from a local checkout of the frontend.
#
# Usage:  ./scripts/sync-frontend-data.sh [path-to-angular-repo]
set -euo pipefail

ANGULAR_REPO="${1:-../myProfile}"
SRC="${ANGULAR_REPO}/public/assets/data"
DEST="$(cd "$(dirname "$0")/.." && pwd)/prisma/data"

if [ ! -d "$SRC" ]; then
  echo "error: ${SRC} not found." >&2
  echo "Pass the Angular repo path: ./scripts/sync-frontend-data.sh /path/to/myProfile" >&2
  exit 1
fi

mkdir -p "$DEST"
for f in profile contact experience projects achievements courses timeline management skills; do
  if [ ! -f "${SRC}/${f}.json" ]; then
    echo "error: missing ${SRC}/${f}.json" >&2
    exit 1
  fi
  cp "${SRC}/${f}.json" "${DEST}/${f}.json"
  echo "  synced ${f}.json"
done

echo "Snapshot updated in prisma/data/. Review the diff, then re-run: yarn db:seed"

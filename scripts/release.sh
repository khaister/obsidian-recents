#!/bin/sh
set -eu

# Obsidian requires three numeric version components, no v prefix, and release
# attachments (main.js, manifest.json, styles.css) that match the tagged source.
# main.js is built from the tag in a throwaway worktree, never from the working tree.

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [OPTIONS]

Bump manifest.json and versions.json, commit, tag, push main and the tag, and
publish a release with main.js, manifest.json and styles.css attached. Versions use YYYY.MMDD.N, starting
at 1 each day, with leading zeroes removed from MMDD.

Options:
  --version <version>  Use an explicit x.y.z version, without a v prefix.
  --no-bump            Tag the current manifest version without a bump commit.
  --no-release         Push the version and tag without publishing a release.
  --release-only [tag] Publish an existing local tag (default: latest version).
  --dry-run            Print the version using local tags; make no changes.
  -h, --help           Show this help.

Makefile: make release ARGS="--version 2026.1118.1"
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

VERSION=""
RELEASE_TAG=""
BUMP=1
CREATE_RELEASE=1
RELEASE_ONLY=0
DRY_RUN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "--version requires a version."
      VERSION="$2"
      shift 2
      ;;
    --no-bump) BUMP=0; shift ;;
    --no-release) CREATE_RELEASE=0; shift ;;
    --release-only)
      RELEASE_ONLY=1
      if [ "$#" -ge 2 ] && [ "${2#-}" = "$2" ]; then
        RELEASE_TAG="$2"
        shift 2
      else
        shift
      fi
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1. See --help." ;;
  esac
done

[ "$RELEASE_ONLY" -eq 0 ] || [ "$CREATE_RELEASE" -eq 1 ] || fail "--release-only and --no-release are contradictory."
[ "$RELEASE_ONLY" -eq 0 ] || [ -z "$VERSION" ] || fail "Pass the tag after --release-only instead of using --version."

command -v git >/dev/null 2>&1 || fail "git is required."
command -v python3 >/dev/null 2>&1 || fail "python3 is required."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required to build main.js."
REPO_DIR=$(CDPATH= cd "$(dirname "$0")/.." && pwd)
cd "$REPO_DIR"

if [ "$DRY_RUN" -eq 0 ]; then
  if [ "$RELEASE_ONLY" -eq 0 ]; then
    [ "$(git branch --show-current)" = "main" ] || fail "Release must be run from main."
    [ -z "$(git status --porcelain)" ] || fail "Working tree is not clean. Commit changes before releasing."
  fi
  if [ "$CREATE_RELEASE" -eq 1 ]; then
    command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) is required."
    gh auth status >/dev/null 2>&1 || fail "Authenticate with gh auth login before releasing."
  fi
  git fetch --tags origin
fi

if [ "$RELEASE_ONLY" -eq 1 ]; then
  if [ -z "$RELEASE_TAG" ]; then
    RELEASE_TAG=$(git tag --sort=-version:refname | sed -n '1p')
  fi
  [ -n "$RELEASE_TAG" ] || fail "No tags found to release."
  TAG="$RELEASE_TAG"
  git rev-parse --verify "refs/tags/$TAG^{commit}" >/dev/null 2>&1 || fail "Tag not found locally: $TAG"
  MANIFEST=$(git show "$TAG:manifest.json")
else
  MANIFEST=$(cat manifest.json)
  CURRENT_VERSION=$(printf '%s' "$MANIFEST" | python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])')
  if [ -n "$VERSION" ]; then
    TAG="$VERSION"
  elif [ "$BUMP" -eq 0 ]; then
    TAG="$CURRENT_VERSION"
  else
    TAG_PREFIX="$(date +%Y).$(date +%m%d | sed 's/^0*//')"
    LAST_NUMBER=$(
      { git tag -l "$TAG_PREFIX.*"; printf '%s\n' "$CURRENT_VERSION"; } |
        awk -F. -v prefix="$TAG_PREFIX" 'NF == 3 && $1 "." $2 == prefix && $3 ~ /^[0-9]+$/ && $3 > max { max = $3 } END { print max + 0 }'
    )
    TAG="$TAG_PREFIX.$((LAST_NUMBER + 1))"
  fi
fi

# Validate before changing the manifest, index or tags.
printf '%s' "$MANIFEST" | python3 -c '
import json, re, sys
tag, bump = sys.argv[1:]
if not re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", tag):
    sys.exit("Error: version must be x.y.z with no v prefix or leading zeroes.")
current = json.load(sys.stdin)["version"]
if bump == "1":
    if tuple(map(int, tag.split("."))) <= tuple(map(int, current.split("."))):
        sys.exit("Error: new version must be greater than the current manifest version.")
elif tag != current:
    sys.exit("Error: tag must exactly match the version in its manifest.json.")
' "$TAG" "$((BUMP * (1 - RELEASE_ONLY)))"

if [ "$RELEASE_ONLY" -eq 0 ] && git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  fail "Tag $TAG already exists."
fi

if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s\n' "$TAG"
  exit 0
fi

if [ "$RELEASE_ONLY" -eq 0 ]; then
  [ -s styles.css ] || fail "styles.css is missing or empty."
  if [ "$BUMP" -eq 1 ]; then
    python3 - "$TAG" <<'PY'
import json, sys
from pathlib import Path
path = Path("manifest.json")
manifest = json.loads(path.read_text())
manifest["version"] = sys.argv[1]
path.write_text(json.dumps(manifest, indent=2) + "\n")
versions_path = Path("versions.json")
versions = json.loads(versions_path.read_text())
versions[sys.argv[1]] = manifest["minAppVersion"]
versions_path.write_text(json.dumps(versions, indent=2) + "\n")
PY
    git add manifest.json versions.json
    git commit -m "chore(release): bump to $TAG"
  fi
  git tag -a "$TAG" -m "Release $TAG"
  git push --atomic origin main "refs/tags/$TAG"
else
  git push origin "refs/tags/$TAG"
fi

if [ "$CREATE_RELEASE" -eq 1 ]; then
  # Build from the tag in a throwaway worktree, including when retrying an
  # older release, so the attachments always match the tagged source.
  BUILD_DIR=$(mktemp -d)
  trap 'git worktree remove --force "$BUILD_DIR" >/dev/null 2>&1 || true; rm -rf "$BUILD_DIR"' EXIT
  trap 'exit 1' HUP INT TERM
  git worktree add --detach "$BUILD_DIR" "refs/tags/$TAG" >/dev/null
  (cd "$BUILD_DIR" && pnpm install --frozen-lockfile && pnpm build) || fail "Build failed for tag $TAG."
  [ -s "$BUILD_DIR/main.js" ] || fail "Built main.js is empty."
  [ -s "$BUILD_DIR/styles.css" ] || fail "Tagged styles.css is empty."
  gh release create "$TAG" "$BUILD_DIR/main.js" "$BUILD_DIR/manifest.json" "$BUILD_DIR/styles.css" \
    --verify-tag --title "$TAG" --generate-notes
  printf 'GitHub release created: %s\n' "$TAG"
fi

printf 'Created and pushed tag: %s\n' "$TAG"

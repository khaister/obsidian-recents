#!/bin/sh
set -eu

# Obsidian requires three numeric version components, no v prefix, and release
# attachments (main.js, manifest.json, styles.css) that match the tagged source.
# main.js is built from the tag in a throwaway worktree, never from the working tree.
#
# Alpha and beta releases add a -alpha.N or -beta.N suffix, which BRAT installs.
# Their version bump is committed only on the tag, never on main, because the
# community plugin directory reads manifest.json from the default branch.

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [OPTIONS]

Bump manifest.json and versions.json, commit, tag, push main and the tag, and
publish a release with main.js, manifest.json and styles.css attached. Versions use YYYY.MMDD.N, starting
at 1 each day, with leading zeroes removed from MMDD.

Options:
  --alpha              Publish an alpha pre-release, YYYY.MMDD.N-alpha.K.
  --beta               Publish a beta pre-release, YYYY.MMDD.N-beta.K.
  --version <version>  Use an explicit x.y.z or x.y.z-alpha.K / -beta.K version, without a v prefix.
  --no-bump            Tag the current manifest version without a bump commit.
  --no-release         Push the version and tag without publishing a release.
  --release-only [tag] Publish an existing local tag (default: latest version).
  --dry-run            Print the version using local tags; make no changes.
  -h, --help           Show this help.

Pre-releases target the next stable version and count up K: the first alpha
after 2026.1122.1 is 2026.1122.2-alpha.1, then -alpha.2, then -beta.1. A
pre-release is tagged and published but never changes main, and its GitHub
release is marked as a pre-release.

Makefile: make release ARGS="--version 2026.1118.1"
          make release ARGS="--beta"
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

VERSION=""
PRE=""
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
    --alpha|--beta)
      [ -z "$PRE" ] || fail "Use only one of --alpha and --beta."
      PRE="${1#--}"
      shift
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
[ -z "$PRE" ] || [ -z "$VERSION" ] || fail "--alpha and --beta pick the version; drop --version, or put the suffix in it."
[ -z "$PRE" ] || [ "$RELEASE_ONLY" -eq 0 ] || fail "--release-only takes the tag as it is; drop --alpha or --beta."
[ -z "$PRE" ] || [ "$BUMP" -eq 1 ] || fail "A pre-release always gets its own version; drop --no-bump."

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
    # Stable tags only: a pre-release tag has a fourth dot-separated part.
    LAST_NUMBER=$(
      { git tag -l "$TAG_PREFIX.*"; printf '%s\n' "$CURRENT_VERSION"; } |
        awk -F. -v prefix="$TAG_PREFIX" 'NF == 3 && $1 "." $2 == prefix && $3 ~ /^[0-9]+$/ && $3 > max { max = $3 } END { print max + 0 }'
    )
    TAG="$TAG_PREFIX.$((LAST_NUMBER + 1))"
    if [ -n "$PRE" ]; then
      if [ "$PRE" = "alpha" ] && [ -n "$(git tag -l "$TAG-beta.*")" ]; then
        fail "$TAG already has a beta. Use --beta, or release $TAG first."
      fi
      LAST_PRE=$(
        git tag -l "$TAG-$PRE.*" |
          awk -F. '$NF ~ /^[0-9]+$/ && $NF > max { max = $NF } END { print max + 0 }'
      )
      TAG="$TAG-$PRE.$((LAST_PRE + 1))"
    fi
  fi
fi

case "$TAG" in
  *-alpha.*|*-beta.*) IS_PRE=1 ;;
  *) IS_PRE=0 ;;
esac

# Validate before changing the manifest, index or tags.
printf '%s' "$MANIFEST" | python3 -c '
import json, re, sys
tag, bump = sys.argv[1:]
NUM = r"(?:0|[1-9][0-9]*)"
PATTERN = rf"({NUM})\.({NUM})\.({NUM})(?:-(alpha|beta)\.([1-9][0-9]*))?"

def key(version):
    m = re.fullmatch(PATTERN, version)
    if not m:
        return None
    major, minor, patch, pre, n = m.groups()
    # A pre-release sorts before its stable version, and alpha before beta.
    rank = (0, 0 if pre == "alpha" else 1, int(n)) if pre else (1, 0, 0)
    return (int(major), int(minor), int(patch)) + rank

if key(tag) is None:
    sys.exit("Error: version must be x.y.z or x.y.z-alpha.N / x.y.z-beta.N, with no v prefix or leading zeroes.")
current = json.load(sys.stdin)["version"]
if bump == "1":
    if key(current) is not None and key(tag) <= key(current):
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

bump_files() {
  # Write the bumped manifest.json and versions.json into directory $1.
  python3 - "$TAG" "$1" <<'PY'
import json, sys
from pathlib import Path
tag, out = sys.argv[1], Path(sys.argv[2])
manifest = json.loads(Path("manifest.json").read_text())
manifest["version"] = tag
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
versions = json.loads(Path("versions.json").read_text())
versions[tag] = manifest["minAppVersion"]
(out / "versions.json").write_text(json.dumps(versions, indent=2) + "\n")
PY
}

if [ "$RELEASE_ONLY" -eq 0 ] && [ "$IS_PRE" -eq 1 ]; then
  [ -s styles.css ] || fail "styles.css is missing or empty."
  # Commit the bump on top of main without moving main, then tag that commit.
  STAGE_DIR=$(mktemp -d)
  STAGE_INDEX="$STAGE_DIR/index"
  bump_files "$STAGE_DIR"
  GIT_INDEX_FILE="$STAGE_INDEX" git read-tree HEAD
  for f in manifest.json versions.json; do
    blob=$(git hash-object -w "$STAGE_DIR/$f")
    GIT_INDEX_FILE="$STAGE_INDEX" git update-index --cacheinfo "100644,$blob,$f"
  done
  tree=$(GIT_INDEX_FILE="$STAGE_INDEX" git write-tree)
  commit=$(git commit-tree "$tree" -p HEAD -m "chore(release): $TAG")
  rm -rf "$STAGE_DIR"
  git tag -a "$TAG" "$commit" -m "Pre-release $TAG"
  git push origin "refs/tags/$TAG"
elif [ "$RELEASE_ONLY" -eq 0 ]; then
  [ -s styles.css ] || fail "styles.css is missing or empty."
  if [ "$BUMP" -eq 1 ]; then
    bump_files .
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
  set -- --verify-tag --title "$TAG" --generate-notes
  [ "$IS_PRE" -eq 0 ] || set -- "$@" --prerelease
  gh release create "$TAG" "$BUILD_DIR/main.js" "$BUILD_DIR/manifest.json" "$BUILD_DIR/styles.css" "$@"
  printf 'GitHub release created: %s\n' "$TAG"
fi

printf 'Created and pushed tag: %s\n' "$TAG"

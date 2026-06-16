#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

APP_NAME="${APP_NAME:-Quest Keeper AI}"
MCP_BIN_DIR="${MCP_BIN_DIR:-$HOME/Repositories/mnehmos.rpg.mcp/bin}"
MCP_SERVER_SRC="${MCP_SERVER_SRC:-$MCP_BIN_DIR/rpg-mcp-macos-arm64}"
SQLITE_NODE_SRC="${SQLITE_NODE_SRC:-$MCP_BIN_DIR/better_sqlite3-macos-arm64.node}"

TAURI_CONFIG="$REPO_DIR/src-tauri/tauri.conf.json"
SIDECAR_TARGET="$REPO_DIR/src-tauri/rpg-mcp-server-aarch64-apple-darwin"
SQLITE_TARGET="$REPO_DIR/src-tauri/better_sqlite3.node"
SQLITE_BINARY_TARGET="$REPO_DIR/src-tauri/binaries/better_sqlite3.node"
APP="$REPO_DIR/src-tauri/target/release/bundle/macos/$APP_NAME.app"
DESKTOP_APP="${DESKTOP_APP:-$HOME/Desktop/$APP_NAME.app}"
APP_SUPPORT_DIR="${APP_SUPPORT_DIR:-$HOME/Library/Application Support/com.questkeeper.ai}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "Required file not found: $1"
}

require_executable() {
  [[ -x "$1" ]] || fail "Required executable not found: $1"
}

ensure_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This build script must run on macOS."
}

ensure_resource_path() {
  log "Checking Tauri resource path"
  require_file "$TAURI_CONFIG"

  TAURI_CONFIG_PATH="$TAURI_CONFIG" node --input-type=commonjs <<'NODE'
const fs = require("fs");

const configPath = process.env.TAURI_CONFIG_PATH;
const desiredResource = "binaries/better_sqlite3.node";
const legacyResource = "better_sqlite3.node";
const original = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(original);

config.bundle ??= {};
const resourcesWasArray = Array.isArray(config.bundle.resources);
const currentResources = resourcesWasArray ? config.bundle.resources : [];
const nextResources = [];
let changed = !resourcesWasArray;

for (const resource of currentResources) {
  if (resource === legacyResource || resource === desiredResource) {
    if (!nextResources.includes(desiredResource)) {
      nextResources.push(desiredResource);
    }
    if (resource === legacyResource) {
      changed = true;
    }
  } else {
    nextResources.push(resource);
  }
}

if (!nextResources.includes(desiredResource)) {
  nextResources.push(desiredResource);
  changed = true;
}

if (
  nextResources.length !== currentResources.length ||
  nextResources.some((resource, index) => resource !== currentResources[index])
) {
  changed = true;
}

if (changed) {
  config.bundle.resources = nextResources;
  const next = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(configPath, next);
  console.log(`Updated resources to include ${desiredResource}`);
} else {
  console.log(`Resources already include ${desiredResource}`);
}
NODE
}

copy_mcp_artifacts() {
  log "Copying MCP artifacts"
  require_file "$MCP_SERVER_SRC"
  require_file "$SQLITE_NODE_SRC"

  mkdir -p "$REPO_DIR/src-tauri/binaries"
  cp "$MCP_SERVER_SRC" "$SIDECAR_TARGET"
  chmod 755 "$SIDECAR_TARGET"

  cp "$SQLITE_NODE_SRC" "$SQLITE_TARGET"
  cp "$SQLITE_NODE_SRC" "$SQLITE_BINARY_TARGET"
  chmod 644 "$SQLITE_TARGET" "$SQLITE_BINARY_TARGET"
}

ensure_tauri_cli() {
  log "Checking local Tauri CLI"

  if [[ ! -x "$REPO_DIR/node_modules/.bin/tauri" ]]; then
    log "Local Tauri CLI not found; running npm ci"
    (cd "$REPO_DIR" && npm ci)
  fi

  require_executable "$REPO_DIR/node_modules/.bin/tauri"
}

build_app() {
  log "Building macOS app bundle"
  (cd "$REPO_DIR" && npm run tauri -- build --bundles app)
  [[ -d "$APP" ]] || fail "Built app was not found: $APP"
}

copy_runtime_native_module() {
  log "Copying native module into app runtime directory"
  require_file "$SQLITE_BINARY_TARGET"
  [[ -d "$APP/Contents/MacOS" ]] || fail "App MacOS directory was not found: $APP/Contents/MacOS"

  cp "$SQLITE_BINARY_TARGET" "$APP/Contents/MacOS/better_sqlite3.node"
  chmod 644 "$APP/Contents/MacOS/better_sqlite3.node"
}

sign_app() {
  log "Ad-hoc signing app bundle"
  require_file "$APP/Contents/MacOS/better_sqlite3.node"
  require_executable "$APP/Contents/MacOS/rpg-mcp-server"
  require_executable "$APP/Contents/MacOS/temp_init"

  codesign --force --sign - --timestamp=none "$APP/Contents/MacOS/better_sqlite3.node"
  codesign --force --sign - --timestamp=none "$APP/Contents/MacOS/rpg-mcp-server"
  codesign --force --sign - --timestamp=none "$APP/Contents/MacOS/temp_init"
  codesign --force --sign - --timestamp=none "$APP"
}

replace_desktop_app() {
  log "Replacing Desktop app copy"

  osascript -e "quit app \"$APP_NAME\"" 2>/dev/null || true
  sleep 1
  rm -rf "$DESKTOP_APP"
  ditto "$APP" "$DESKTOP_APP"
}

verify_codesign() {
  log "Verifying Desktop app signature"
  codesign --verify --deep --strict --verbose=2 "$DESKTOP_APP"
}

smoke_test_mcp() {
  log "Running MCP smoke test"

  local app_bin="$DESKTOP_APP/Contents/MacOS/rpg-mcp-server"
  local smoke_stdout
  local smoke_stderr
  smoke_stdout="$(mktemp)"
  smoke_stderr="$(mktemp)"

  cleanup_smoke_files() {
    rm -f "$smoke_stdout" "$smoke_stderr"
  }
  trap cleanup_smoke_files RETURN

  require_executable "$app_bin"
  mkdir -p "$APP_SUPPORT_DIR"

  (
    cd "$APP_SUPPORT_DIR"
    "$app_bin" >"$smoke_stdout" 2>"$smoke_stderr" <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}
EOF
  )

  log "Smoke test stderr"
  sed 's/^/[stderr] /' "$smoke_stderr"

  log "Smoke test stdout"
  sed 's/^/[stdout] /' "$smoke_stdout"

  grep -q '\[SQLite\] Found native module' "$smoke_stderr" \
    || fail 'Smoke test did not report "[SQLite] Found native module" on stderr.'
  grep -Eq '"name"[[:space:]]*:[[:space:]]*"rpg-mcp"' "$smoke_stdout" \
    || fail 'Smoke test stdout did not contain serverInfo.name "rpg-mcp".'
}

main() {
  ensure_macos
  ensure_resource_path
  copy_mcp_artifacts
  ensure_tauri_cli
  build_app
  copy_runtime_native_module
  sign_app
  replace_desktop_app
  verify_codesign
  smoke_test_mcp

  log "Done: $DESKTOP_APP"
}

main "$@"

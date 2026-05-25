#!/usr/bin/env bash
# Builds the DITA Architect macOS app:
#   1. npm run build  — Vite web app → dist/
#   2. swiftc        — compiles the WKWebView shell
#   3. assembles     — DITA Architect.app in the repo root
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCES="$SCRIPT_DIR/Sources/DITAArchitect"
APP="$PROJECT_ROOT/DITA Architect.app"

echo "→ Building web app…"
cd "$PROJECT_ROOT"
npm run build

echo "→ Compiling Swift…"
swiftc \
  "$SOURCES/main.swift" \
  "$SOURCES/AppDelegate.swift" \
  "$SOURCES/WebViewController.swift" \
  "$SOURCES/DITASchemeHandler.swift" \
  "$SOURCES/JSBridge.swift" \
  "$SOURCES/HttpServer.swift" \
  -framework AppKit \
  -framework WebKit \
  -framework Network \
  -target arm64-apple-macosx13.0 \
  -O \
  -o "$SCRIPT_DIR/DITAArchitect"

echo "→ Assembling .app bundle…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cp "$SCRIPT_DIR/DITAArchitect"                      "$APP/Contents/MacOS/DITAArchitect"
cp "$SOURCES/Info.plist"                            "$APP/Contents/Info.plist"
cp -r "$PROJECT_ROOT/dist"                          "$APP/Contents/Resources/dist"
cp "$PROJECT_ROOT/assets/dita-architect-icon.icns"  "$APP/Contents/Resources/dita-architect-icon.icns"

rm "$SCRIPT_DIR/DITAArchitect"

echo "✅  $APP"
echo "    open '$APP'"

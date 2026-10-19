#!/bin/sh
# Runs ios/Tests on macOS with plain xctest. ios/Core imports only Foundation.
set -e
cd "$(dirname "$0")/../../ios"
OUT="${TMPDIR:-/tmp}/AdaptiveStatusBarCoreTests.xctest"
PLAT="$(xcrun --show-sdk-platform-path)"
rm -rf "$OUT" && mkdir -p "$OUT/Contents/MacOS"
xcrun swiftc -O -parse-as-library -emit-library -module-name AdaptiveStatusBarCoreTests \
  -o "$OUT/Contents/MacOS/AdaptiveStatusBarCoreTests" Core/*.swift Tests/*.swift \
  -F "$PLAT/Developer/Library/Frameworks" -I "$PLAT/Developer/usr/lib" -L "$PLAT/Developer/usr/lib" \
  -framework XCTest -Xlinker -rpath -Xlinker "$PLAT/Developer/Library/Frameworks" \
  -Xlinker -rpath -Xlinker "$PLAT/Developer/usr/lib"
xcrun xctest "$OUT"

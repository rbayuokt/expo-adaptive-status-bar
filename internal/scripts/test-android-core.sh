#!/bin/sh
# Runs the Kotlin core tests on the JVM, no emulator or Expo prebuild.
set -e
cd "$(dirname "$0")/../../android/core-tests"
./gradlew test -q --console=plain
echo "Kotlin core tests passed"

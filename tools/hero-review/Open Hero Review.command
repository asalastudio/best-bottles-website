#!/bin/zsh
cd "$(dirname "$0")/../.." || exit 1
node tools/hero-review/server.cjs

#!/usr/bin/env bash
set -euo pipefail

REPO="${PEEK_REPO:-https://github.com/iammayron/peek}"
PREFIX="${PEEK_PREFIX:-}"

need() {
  command -v "$1" >/dev/null 2>&1
}

if ! need go && [[ -z "${PEEK_BIN:-}" ]]; then
  echo "Peek: need Go to build from source (or set PEEK_BIN)." >&2
  echo "  brew install go" >&2
  exit 1
fi

workdir="$(mktemp -d)"
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

if [[ -n "${PEEK_BIN:-}" ]]; then
  bin="$PEEK_BIN"
elif [[ -f "$(pwd)/cmd/peek/main.go" ]]; then
  echo "Building Peek from $(pwd)…"
  mkdir -p bin
  go build -o bin/peek ./cmd/peek
  bin="$(pwd)/bin/peek"
else
  echo "Cloning $REPO…"
  git clone --depth 1 "$REPO" "$workdir/src"
  (cd "$workdir/src" && go build -o peek ./cmd/peek)
  bin="$workdir/src/peek"
fi

"$bin" install

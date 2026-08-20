#!/usr/bin/env bash
set -euo pipefail

REPO="${INSPECTAI_REPO:-https://github.com/iammayron/inspectai}"
PREFIX="${INSPECTAI_PREFIX:-}"

need() {
  command -v "$1" >/dev/null 2>&1
}

if ! need go && [[ -z "${INSPECTAI_BIN:-}" ]]; then
  echo "InspectAI: need Go to build from source (or set INSPECTAI_BIN)." >&2
  echo "  brew install go" >&2
  exit 1
fi

workdir="$(mktemp -d)"
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

if [[ -n "${INSPECTAI_BIN:-}" ]]; then
  bin="$INSPECTAI_BIN"
elif [[ -f "$(pwd)/cmd/inspectai/main.go" ]]; then
  echo "Building InspectAI from $(pwd)…"
  mkdir -p bin
  go build -o bin/inspectai ./cmd/inspectai
  bin="$(pwd)/bin/inspectai"
else
  echo "Cloning $REPO…"
  git clone --depth 1 "$REPO" "$workdir/src"
  (cd "$workdir/src" && go build -o inspectai ./cmd/inspectai)
  bin="$workdir/src/inspectai"
fi

"$bin" install

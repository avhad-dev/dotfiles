#!/usr/bin/env bash
# Run Gemini 3.1 Pro through the pinned Antigravity CLI.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")" && pwd -P)"
dotfiles_dir="$(cd -- "$script_dir/../../../.." && pwd -P)"

exec nix develop "$dotfiles_dir" --command agy \
  --print \
  --model gemini-3.1-pro-high \
  --effort high \
  "$@"

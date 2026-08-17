#!/usr/bin/env bash
# Run Gemini 3.1 Pro through the pinned Antigravity CLI.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")" && pwd -P)"
dotfiles_dir="$(cd -- "$script_dir/../../../.." && pwd -P)"
session_dir="$HOME/.agents/sessions"
mkdir -p -- "$session_dir"
log_file="$(mktemp "$session_dir/agy-XXXXXXXX.log")"

exec nix develop "$dotfiles_dir" --command agy \
  --model gemini-3.1-pro-high \
  --effort high \
  --log-file "$log_file" \
  "$@"

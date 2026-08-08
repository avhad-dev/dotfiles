#!/usr/bin/env bash
# Run an isolated GPT-5.6 Sol review through the pinned Pi CLI.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")" && pwd -P)"
dotfiles_dir="$(cd -- "$script_dir/../../../.." && pwd -P)"

exec nix develop "$dotfiles_dir" --command \
  "$dotfiles_dir/node_modules/.bin/pi" \
  --model openai-codex/gpt-5.6-sol \
  --thinking high \
  --no-session \
  "$@"

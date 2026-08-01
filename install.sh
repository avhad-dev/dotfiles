#!/usr/bin/env bash

set -euo pipefail

dotfiles_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ln -sfn "$dotfiles_dir/zsh/.zshrc" "$HOME/.zshrc"

mkdir -p "$HOME/.pi/agent"
ln -sfn "$dotfiles_dir/pi/AGENTS.md" "$HOME/.pi/agent/AGENTS.md"

#!/usr/bin/env bash

set -euo pipefail

dotfiles_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ln -sfn "$dotfiles_dir/zsh/.zshrc" "$HOME/.zshrc"
ln -sfn "$dotfiles_dir/tmux/.tmux.conf" "$HOME/.tmux.conf"

mkdir -p "$HOME/.pi/agent"
ln -sfn "$dotfiles_dir/pi/AGENTS.md" "$HOME/.pi/agent/AGENTS.md"
ln -sfnT "$dotfiles_dir/pi/extensions" "$HOME/.pi/agent/extensions"
ln -sfnT "$dotfiles_dir/pi/skills" "$HOME/.pi/agent/skills"

#!/usr/bin/env bash

set -euo pipefail

dotfiles_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ln -sfn "$dotfiles_dir/zsh/.zshrc" "$HOME/.zshrc"

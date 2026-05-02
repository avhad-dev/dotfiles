#!/bin/sh

set -eu

DOTFILES_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SOURCE_ZSHRC="$DOTFILES_DIR/zshrc"
TARGET_ZSHRC="$HOME/.zshrc"

if [ ! -f "$SOURCE_ZSHRC" ]; then
  printf 'Missing source file: %s\n' "$SOURCE_ZSHRC" >&2
  exit 1
fi

if [ -L "$TARGET_ZSHRC" ]; then
  current_target=$(readlink "$TARGET_ZSHRC")
  if [ "$current_target" = "$SOURCE_ZSHRC" ]; then
    printf 'Already linked: %s -> %s\n' "$TARGET_ZSHRC" "$SOURCE_ZSHRC"
    exit 0
  fi

  printf 'Refusing to replace existing symlink: %s -> %s\n' "$TARGET_ZSHRC" "$current_target" >&2
  exit 1
fi

if [ -e "$TARGET_ZSHRC" ]; then
  printf 'Refusing to replace existing file: %s\n' "$TARGET_ZSHRC" >&2
  printf 'Move it aside, then rerun this script.\n' >&2
  exit 1
fi

ln -s "$SOURCE_ZSHRC" "$TARGET_ZSHRC"
printf 'Linked: %s -> %s\n' "$TARGET_ZSHRC" "$SOURCE_ZSHRC"

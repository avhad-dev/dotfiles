export EDITOR="nvim"
export VISUAL="nvim"

# Resolve the repository location from this managed file, even when it is
# linked from a checkout outside the default home-directory location.
DOTFILES_DIR="${${(%):-%N}:A:h:h}"

agy() {
  nix develop "$DOTFILES_DIR" --command agy "$@"
}

codex() {
  nix develop "$DOTFILES_DIR" --command \
    "$DOTFILES_DIR/node_modules/.bin/codex" "$@"
}

pi() {
  nix develop "$DOTFILES_DIR" --command \
    "$DOTFILES_DIR/node_modules/.bin/pi" \
    --skill "$DOTFILES_DIR/pi/skills/change-walkthrough" \
    "$@"
}

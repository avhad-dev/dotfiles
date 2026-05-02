# Root Zsh entrypoint. Keep this file stable for install-time linking.

readonly DOTFILES_DIR="${${(%):-%x}:A:h}"

for zsh_config in "$DOTFILES_DIR"/zsh/conf.d/*.zsh(N); do
  source "$zsh_config"
done

unset zsh_config

# Shared interactive shell behavior.

setopt auto_cd
setopt auto_pushd
setopt extended_glob
setopt hist_ignore_all_dups
setopt hist_reduce_blanks
setopt inc_append_history
setopt interactive_comments
setopt share_history

HISTFILE="${ZDOTDIR:-$HOME}/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000

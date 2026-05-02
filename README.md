# dotfiles

Personal source of truth for dotfile configuration across macOS and NixOS.

This repository is intentionally small, explicit, and reviewable. It holds the
configuration I want to keep portable between machines, with Zsh as the primary
shell and first-class configuration for tmux, Neovim, and Zsh.

## Goals

- Keep macOS and NixOS configuration in one place.
- Make shell, editor, and terminal behavior reproducible.
- Keep files focused on one responsibility each.
- Load configuration in deterministic numeric order.
- Keep every commit small enough to review quickly.
- Never commit secrets.

## Layout

The repository should stay organized by tool or platform. A typical layout is:

```text
.
├── AGENTS.md
├── README.md
├── nixos/
├── macos/
├── tmux/
├── nvim/
└── zsh/
    └── conf.d/
```

Tool directories should contain small files named with a numeric prefix and a
short task description:

```text
zsh/conf.d/
├── 001-path.zsh
├── 002-options.zsh
├── 003-completion.zsh
└── 008-secrets.zsh.example
```

Use the `001-task` naming pattern for ordered configuration fragments. The
number controls load order; the task name explains the file's responsibility.
Keep numbering simple and sequential unless inserting a file between existing
fragments would make a gap useful.

## Setup Notes

The root `zshrc` sets `DOTFILES_DIR` to `$HOME/github/dotfiles`. If you clone
this repository somewhere else, review that value before linking or sourcing
the Zsh entrypoint.

## Secrets

Secrets do not belong in this repository.

Private tokens, keys, credentials, hostnames, and machine-local values should
live in ignored files. Prefer explicit private include points such as:

```text
zsh/conf.d/008-secrets.zsh
tmux/secrets.conf
nvim/secrets.lua
```

Every ignored secrets file should have a committed example next to it. For
example, `zsh/conf.d/008-secrets.zsh` should have
`zsh/conf.d/008-secrets.zsh.example` with placeholder values only.

## Commit Style

Commits should be minimal and easy to review.

- Make one behavioral change per commit.
- Avoid mixing formatting, renames, and logic changes.
- Keep generated or machine-specific churn out of commits.
- Explain surprising choices in commit messages or adjacent documentation.

## Platforms

This repo currently targets:

- macOS
- NixOS

Platform-specific configuration should live under a platform directory unless a
tool-specific directory already provides a cleaner boundary. Shared behavior
should be kept shared by default, with platform-specific overrides layered after
it.

## License

This repository is released under the terms in [LICENSE](LICENSE).

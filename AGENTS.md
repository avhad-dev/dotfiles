# Agent Instructions

This repository is the source of truth for personal dotfile configuration across
macOS and NixOS. Treat changes as durable configuration, not disposable setup.

## Scope

Primary configuration areas:

- Zsh as the primary shell.
- tmux configuration.
- Neovim configuration.
- macOS-specific configuration.
- NixOS-specific configuration.

Keep edits tightly scoped to the requested tool, platform, or behavior.

## File Design

Files should have minimal responsibilities.

Use ordered filenames in the `001-task` style:

```text
001-path.zsh
002-options.zsh
003-completion.zsh
008-secrets.zsh.example
```

Use simple sequential ordering by default. The numeric prefix defines load
order; the task name should describe the file's single responsibility.

## Secrets

Never commit secrets.

Do not add tokens, keys, credentials, private hostnames, personal email routing,
or machine-local private values to tracked files. If a change needs a private
value, add or document an ignored include file instead.

When adding a new private include point, make sure `.gitignore` excludes the
private file before referencing it from tracked configuration.

Every ignored secrets file should have a committed `.example` file beside it
with placeholder values only. For example, `zsh/conf.d/008-secrets.zsh` should
have `zsh/conf.d/008-secrets.zsh.example`.

## Platform Handling

The active platforms are macOS and NixOS.

Prefer shared configuration when behavior is genuinely portable. Put
platform-specific behavior in `macos/` or `nixos/`, or behind a focused
platform-specific fragment when that matches the surrounding layout.

Tool configuration should live under tool-specific directories such as
`zsh/conf.d/`, `tmux/`, and `nvim/`.

Avoid assuming Linux behavior applies to macOS, or macOS behavior applies to
NixOS.

## Change Discipline

All commits should be minimal and easily reviewable.

Commit messages should use a simple conventional prefix: `chore:`, `feat:`, or
`docs:`.

When editing:

- Make the smallest coherent change.
- Avoid unrelated refactors.
- Avoid formatting churn unless formatting is the requested change.
- Do not rename files unless the rename is part of the requested behavior.
- Preserve existing user edits and never revert unrelated local changes.

If a change introduces a new ordering dependency, make the filename order and
file contents reflect that dependency clearly.

Do not push directly to a remote branch unless explicitly instructed. Prefer a
GitHub pull request for remote review when the user asks for remote submission
or review.

Creating a local commit does not imply that a pull request should be created.
Create a pull request only when asked. The pull request should have a concise
title, a clear summary of the change, and any validation that was run.

## Validation

Prefer lightweight validation that matches the changed files.

Examples:

- For Zsh changes, run `zsh -n` on edited `.zsh` files when possible.
- For tmux changes, validate syntax with tmux if available.
- For Neovim Lua changes, use the repository's existing formatter or checks if
  one exists.
- For NixOS changes, prefer `nix flake check` or the repo's established Nix
  validation command if present.

If validation cannot be run because a tool is unavailable, report that clearly.

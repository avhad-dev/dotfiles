# Dotfiles

This repository provides a small, reproducible coding-harness environment for
the unprivileged `kuro` account on NixOS ARM64. System administration belongs
in the NixOS configuration repository; project-specific tools belong in
project flakes.

## Contents

- `flake.nix` and `flake.lock` provide Node.js 22, Git, and the Antigravity
  CLI in a reproducible development shell.
- `package.json` and `package-lock.json` pin the Codex and Pi coding-agent
  CLIs.
- `zsh/.zshrc` exposes `agy`, `codex`, and `pi` functions that run local CLIs
  through `nix develop`.
- `install.sh` links the managed Zsh configuration to `~/.zshrc` and the Pi
  instructions, extensions, and skills into `~/.pi/agent/`.

## Setup

From any checkout location, install the pinned CLI dependencies and then link
the Zsh configuration:

```sh
nix develop --command npm ci
./install.sh
```

Open a new Zsh session, then use `agy`, `codex`, or `pi`. The launchers locate
the repository from the managed `.zshrc` symlink, so the checkout need not live
at a particular path.

Pi includes a `subagent` extension and matching `/skill:subagents` skill. Ask Pi
to use one or more subagents and specify roles, models, thinking levels, and
needed tools; each agent runs as an isolated ephemeral Pi process. Subagents
are read-only by default (`read`, `grep`, `find`, and `ls`). Because child
processes disable extensions, a custom provider registered only by a parent Pi
extension is unavailable to subagents; select a provider available from Pi's
built-in catalogue or configuration instead. While subagents run, open the
read-only observer with `/subagents` or Ctrl+Shift+S. Tab switches between
agents; the live activity stays in the TUI and is not added to the parent
model's context.

Validate changes with:

```sh
nix flake check --no-build
zsh -n zsh/.zshrc
bash -n install.sh
```

No credentials, API keys, or private keys belong in this repository.

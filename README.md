# Dotfiles

This repository provides a small, reproducible coding-harness environment for
the unprivileged `kuro` account on NixOS ARM64. System administration belongs
in the NixOS configuration repository; project-specific tools belong in
project flakes.

## Contents

- `flake.nix` and `flake.lock` provide Node.js 22 and Git in a reproducible
  development shell.
- `package.json` and `package-lock.json` pin the Codex and Pi coding-agent
  CLIs.
- `zsh/.zshrc` exposes `codex` and `pi` functions that run local CLIs through
  `nix develop`.
- `install.sh` links the managed Zsh configuration to `~/.zshrc`.

## Setup

From any checkout location, install the pinned CLI dependencies and then link
the Zsh configuration:

```sh
nix develop --command npm ci
./install.sh
```

Open a new Zsh session, then use `codex` or `pi`. The launchers locate the
repository from the managed `.zshrc` symlink, so the checkout need not live at
a particular path.

Validate changes with:

```sh
nix flake check --no-build
zsh -n zsh/.zshrc
bash -n install.sh
```

No credentials, API keys, or private keys belong in this repository.

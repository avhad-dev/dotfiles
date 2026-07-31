# Repository guidance

## Philosophy

Keep this repository small and reproducible. It defines only the shared
coding-harness entry points for the unprivileged `kuro` account. Do not add
global programming SDKs, agent sandboxes, credentials, or machine-specific
configuration here; use project flakes for project tooling and the NixOS
configuration repository for system policy.

## Change rules

- Preserve pinned npm and Nix inputs. Update their lockfiles with the matching
  manifest change.
- Keep the `codex` and `pi` launchers running the repository-local binaries
  through `nix develop` and keep their path resolution checkout-independent.
- Document `nix develop --command npm ci` whenever the dependency bootstrap
  changes.
- Do not commit `.env` files, API keys, SSH keys, tokens, or `node_modules`.
- Validate with `nix flake check --no-build`, `zsh -n zsh/.zshrc`, and
  `bash -n install.sh` when relevant.

## Git history

Use lowercase Conventional Commit subjects. Make each commit independently
reviewable and scoped to one feature or maintenance action. Examples:

```text
feat: add coding agent shell launchers
chore: lock Nix development shell
docs: document harness workflow
```

Use a short bullet-point body when a change needs context. Never include
secrets, private machine data, or credentials in commits.

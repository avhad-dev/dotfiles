---
name: change-walkthrough
description: Explain and review a Git change as logical behavior slices. Use when the user asks to understand, walk through, or review staged or unstaged working-tree changes, untracked files, a commit, or a commit range. Explain behavior first, then report only evidence-backed findings.
---

# Change Walkthrough

Review changes in two passes: establish the behavioral story, then challenge
that story with concrete failure scenarios. Do not modify the repository.

## Resolve scope

Read applicable repository instructions first. Honor an explicit scope:
staged, unstaged, working tree, commit, or range. Otherwise, review all local
changes when present; if the tree is clean, review `HEAD`. Announce the scope
before analysis.

For local changes, inspect staged and unstaged diffs separately and list
untracked files. Use the combined `HEAD`-to-worktree diff to explain the final
behavior, but state what is and is not staged. Resolve revision names to
immutable commit IDs. For a merge commit, use its first-parent delta unless the
user selects another parent, and disclose that choice. Recheck status at the
end and mark the report stale if the worktree changed.

Use Git with `--no-ext-diff`, `--no-textconv`, rename detection, quoted
revision arguments, and `--` before paths. Do not inspect ignored secret
material.

## Build the walkthrough

Inventory every changed path by role: runtime code, API or schema,
configuration, tests, dependencies, generated artifacts, or documentation.
Infer the intended outcome from the user’s context, commit message, names,
tests, and nearby code; clearly label inference.

Group changes into logical slices rather than walking files in diff order. For
each slice, explain:

- before and after behavior;
- entry point, callers, and data or control flow;
- validation, state changes, and side effects;
- relevant errors, retries, concurrency, authorization, and compatibility;
- changed files and supporting tests.

Use targeted searches and file reads for callers, contracts, tests, and
parallel implementations. In deep mode, use focused history or blame only to
resolve a specific uncertainty.

## Review the story

After the walkthrough, look for ways the described behavior can fail. Report a
finding only when it has all of the following:

- a reachable input, state, or execution path;
- an undesirable observable outcome or violated contract;
- a precise affected location; and
- direct code, test, type, contract, or command evidence.

Verify baseline behavior before calling something a regression. Put uncertain
interpretations in open questions, not findings. Deduplicate symptoms under a
shared root cause. Omit style nits and speculative hardening. Do not report an
unrelated pre-existing issue unless this change exposes or worsens it.

Use P0 for broadly catastrophic issues, P1 for likely serious breakage, and P2
for bounded concrete defects. Include only high- or medium-confidence findings.

## Modes

Default to `standard`. Accept a depth mode of `minimal`, `standard`, `deep`, or
`guided`; `guided` presents the logical map, then proceeds one slice at a time.
Accept `risk`, `tests`, and `security` as composable focus overlays. Focus
changes emphasis, not the evidence threshold.

## Safety and validation

Do not modify, stage, commit, download, or create files. Do not install
dependencies, access the network, start services, execute migrations, or run
changed or untrusted hooks. Run existing targeted checks only when clearly safe;
otherwise suggest the exact command. State inspection limits for binary,
generated, vendored, submodule, or oversized changes.

## Output

Return sections in this order:

1. Scope
2. Intended outcome
3. Logical change map
4. Walkthrough of each logical slice
5. Cross-cutting effects: contracts, schema, configuration, compatibility, deployment, and rollback
6. Validation performed, suggested, and missing
7. Evidence-backed findings, or `No evidence-backed findings`
8. Open questions requiring user or architectural judgment

Each finding includes its priority, title, evidence location, trigger, impact,
causal explanation, smallest useful fix or test, and confidence.

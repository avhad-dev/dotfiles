---
name: sol-gemini-orchestration
description: "Have GPT-5.6 Sol supervise sequential Gemini 3.1 Pro headless agents for a requested coding change: plan, verify, implement, review, remediate, and test. Use when the user asks to delegate implementation to Gemini but wants Sol to retain control and independently verify each gate."
---

# Sol-supervised Gemini workflow

Use this workflow only for a concrete coding task the user has authorized. The
current Pi agent is the controller and must be GPT-5.6 Sol at high thinking.
If it is not, tell the user to start Pi with:

```sh
pi --model openai-codex/gpt-5.6-sol --thinking high
```

Gemini is an untrusted worker. Sol owns scope, decides whether a gate passes,
reviews every Gemini-produced change, and reports the final result. Never let
Gemini self-certify a plan, code review, or test result.

## Setup and safety

1. Read all applicable repository instructions and inspect `git status` before
delegation. Record pre-existing modified and untracked paths. Preserve them.
If the requested work overlaps them, ask the user before delegating edits.
2. Resolve the task into explicit acceptance criteria, expected tests, and an
allowed file scope. Do this yourself; do not ask Gemini to infer authority.
3. Keep prompts, plans, and reviews outside the repository:

   ```sh
   SKILL_DIR="$HOME/.pi/agent/skills/sol-gemini-orchestration"
   RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sol-gemini.XXXXXX")"
   ```

   Write the task and acceptance criteria to `$RUN_DIR/task.md`. Keep this
directory on failure for diagnosis. Remove it only after a successful final
report or when the user requests cleanup.
4. Run agents **sequentially**. They share the checkout, so never run Gemini
workers or reviewers concurrently. Use a bounded outer `timeout` for every
headless command. Do not commit, push, reset, stash, or discard changes.
5. The helper scripts use the pinned local CLIs and preserve each run's logs
outside the repository in `~/.agents/sessions/`:
   - `$SKILL_DIR/scripts/agy-headless.sh` always selects Gemini 3.1 Pro, high,
     and creates a unique `mktemp` log file there.
   - `$SKILL_DIR/scripts/sol-headless.sh` always selects GPT-5.6 Sol, high,
     and has Pi persist its UUID-named JSONL session there.
   Do not remove these logs during cleanup; inspect them when a headless run
   fails.

For a Gemini run that may edit the checkout, pass
`--mode accept-edits --dangerously-skip-permissions` explicitly. That flag is
acceptable only after Sol has approved the plan and the user has authorized the
change. Planning and review runs must not receive it.

## Required gates

### 1. Gemini plan

Ask Gemini for a plan only. Use `--mode plan`, prohibit repository writes, and
capture its response in `$RUN_DIR/plan.md`:

```sh
timeout 20m "$SKILL_DIR/scripts/agy-headless.sh" \
  --mode plan --print-timeout 15m \
  --prompt "Read $RUN_DIR/task.md and the repository instructions. Produce an actionable, minimal plan with files, interfaces, error cases, tests, and verification. Do not edit the repository." \
  >"$RUN_DIR/plan.md" 2>&1
```

Read the plan. Reject a plan that expands scope, relies on unverified behavior,
or omits required failure/test behavior.

### 2. Independent Sol plan review

Have a fresh, read-only Sol session review the task, repository, and plan.
Require the exact final token `VERIFIED` only when there are no blocking
issues; otherwise require a concise numbered blocker list.

```sh
timeout 20m "$SKILL_DIR/scripts/sol-headless.sh" \
  --tools read,grep,find,ls \
  --print "Read $RUN_DIR/task.md, $RUN_DIR/plan.md, and all applicable repository instructions. Review the plan for correctness, scope, compatibility, error handling, concurrency, and testability. Do not edit files. Reply exactly VERIFIED if and only if no blocking issue remains; otherwise list only numbered blockers with required corrections." \
  >"$RUN_DIR/plan-review-1.md" 2>&1
```

If the result is not exactly `VERIFIED`, give Gemini the plan and Sol's review,
again in `--mode plan`, and replace `plan.md` with its revised response. Repeat
the Sol review at most twice. If Sol still does not return `VERIFIED`, stop and
report the blockers to the user. **Do not implement from an unverified plan.**

### 3. Gemini implementation

After a verified plan, ask Gemini to implement only the approved scope. Its
prompt must name the task file and plan, require preservation of pre-existing
work, prohibit commits/pushes and unrelated files, and require it to run the
project's prescribed tests. Capture the response in
`$RUN_DIR/implementation.md`:

```sh
timeout 30m "$SKILL_DIR/scripts/agy-headless.sh" \
  --mode accept-edits --dangerously-skip-permissions --print-timeout 25m \
  --prompt "Implement only the verified plan at $RUN_DIR/plan.md for the task at $RUN_DIR/task.md. Read repository instructions first. Preserve pre-existing work, do not commit or push, add focused tests, and run the prescribed checks. Summarize changed paths and exact command results." \
  >"$RUN_DIR/implementation.md" 2>&1
```

Sol must inspect the actual diff and test changes; Gemini's summary is not
evidence.

### 4. Independent Sol code review and remediation

Run a fresh read-only Sol review against the actual worktree. Allow `bash` only
for bounded, non-mutating inspection commands; the reviewer must not edit or
run build commands that write outputs.

```sh
timeout 20m "$SKILL_DIR/scripts/sol-headless.sh" \
  --tools read,grep,find,ls,bash \
  --print "Review the current worktree against $RUN_DIR/task.md and $RUN_DIR/plan.md. Read repository instructions and inspect the actual diff and tests. Do not edit files or run mutating checks. Reply exactly VERIFIED if there are no material findings; otherwise report only numbered, evidence-backed findings with file locations and required fixes." \
  >"$RUN_DIR/code-review-1.md" 2>&1
```

For findings, give Gemini only the numbered findings and authorize it to fix
only those issues plus tests directly needed to prove them. Re-review with a
fresh Sol session. Permit at most two remediation rounds; fail closed and
report unresolved findings rather than declaring success.

### 5. Gemini test pass and Sol final verification

Once code review is `VERIFIED`, ask Gemini to run the repository-prescribed
checks and report exact commands and results. It must not make further code
changes in this stage. Sol then independently runs the same relevant checks
when safe, inspects `git diff --check` and final status, and confirms the final
diff remains within the approved scope. Report command output accurately.

Do not claim completion if a headless agent timed out, a gate did not return
`VERIFIED`, a required test failed, or the final diff includes unexplained
files. State the blocking gate, preserve `$RUN_DIR`, and identify the relevant
`~/.agents/sessions/` log in that case.

## Final report

Report in this order:

1. implemented behavior and changed paths;
2. Sol gate results and any remediation rounds;
3. exact verification commands and outcomes;
4. uncommitted status;
5. persistent session-log location(s); and
6. temporary artifact location (or that it was removed).

---
name: subagents
description: Delegate independent, parallel, or specialized work to isolated Pi subprocesses with per-agent roles, models, thinking levels, and tool allowlists. Use when the user asks for subagents, parallel agents, multiple reviewers, model-specific delegation, or isolated investigation.
---

# Subagents

Use the `subagent` tool registered by the companion extension. It starts a new
ephemeral Pi process for every requested agent, so each agent has an isolated
context and session. Agents run concurrently and return their final responses
to the parent.

If the `subagent` tool is unavailable, tell the user that the extension is not
loaded and suggest running `/reload` or `./install.sh` from the dotfiles
checkout. Do not emulate subagents with ordinary `bash` calls.

## Delegation workflow

1. Decide whether delegation adds value. Use it for independent investigation,
   parallel work, a specialized review, or an explicitly requested model. Do
   not delegate trivial tasks.
2. Split work into at most four independent, self-contained tasks. Agents do
   not share context with one another or automatically receive the parent
   conversation.
3. For each agent, provide:
   - `kind`: a short role such as `scout`, `planner`, `reviewer`, `tester`, or
     `worker`;
   - `task`: all context and expected output needed to complete the work;
   - `instructions`: optional role constraints;
   - `model`: optional model ID or `provider/model` ID; omitted means the
     parent's model;
   - `thinking`: optional `off`, `minimal`, `low`, `medium`, `high`, `xhigh`,
     or `max`; omitted means the parent's thinking level;
   - `tools`: the minimum exact allowlist needed by that agent.
4. Invoke all independent agents in one `subagent` call so they run in
   parallel. Use a later call only when its task depends on earlier output.
5. Synthesize and verify the returned results. Treat subagent output as advice,
   not automatically established fact.

## Tool policy

The extension accepts only Pi's built-in tools:

- Read-only: `read`, `grep`, `find`, `ls`
- Command execution: `bash`
- File mutation: `edit`, `write`

Omitting `tools` gives the agent the read-only set. Prefer that default for
scouts, planners, and reviewers. Add `bash` only when commands or tests are
required. Add `edit` and `write` only when the user has asked an agent to
modify files. Never grant mutation tools to multiple parallel agents working
in the same checkout; concurrent edits can conflict or overwrite one another.

Subagents cannot load extensions, skills, or prompt templates and cannot
recursively invoke `subagent`. They remain in the parent's working directory
and still receive applicable project context files such as `AGENTS.md`.

## Invocation examples

The user can ask naturally:

- "Use two subagents to inspect the parser and test suite in parallel."
- "Ask a reviewer on `anthropic/claude-sonnet-4-5` with high thinking to review
  this change."
- "Have a read-only scout investigate the bug, then use its findings yourself."
- "Delegate implementation to one worker with read, edit, write, and bash."

Translate those requests into tool inputs like:

```json
{
  "agents": [
    {
      "kind": "scout",
      "task": "Locate the authentication flow and report relevant files and risks.",
      "model": "anthropic/claude-haiku-4-5",
      "thinking": "low"
    },
    {
      "kind": "reviewer",
      "task": "Review the authentication tests for missing failure cases. Do not modify files.",
      "model": "openai/gpt-5.4",
      "thinking": "high",
      "tools": ["read", "grep", "find", "ls"]
    }
  ]
}
```

For a modifying worker:

```json
{
  "agents": [
    {
      "kind": "worker",
      "task": "Implement the requested validation, run targeted tests, and summarize changed files.",
      "thinking": "medium",
      "tools": ["read", "grep", "find", "ls", "bash", "edit", "write"]
    }
  ]
}
```

Model IDs must exist in the child Pi process's model catalogue and have valid
authentication. Child processes disable extensions, so they cannot use a custom
provider registered only by an extension in the parent process; select a
provider available from Pi's built-in catalogue or configuration instead.
Unsupported thinking levels are handled by Pi according to the selected
model's capabilities.

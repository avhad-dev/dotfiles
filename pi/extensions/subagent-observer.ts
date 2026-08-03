import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";

const CHANNEL = "subagent:observer";
const MAX_RUNS = 5;
const MAX_ACTIVITY_CHARS = 50_000;
const MAX_STREAMING_CHARS = 8_000;

interface AgentSnapshot {
  id: string;
  kind: string;
  task: string;
  model: string;
  thinking: string;
  tools: string[];
  status: "pending" | "running" | "completed" | "failed" | "aborted";
  activity: string[];
  activityChars: number;
  streamingText: string;
}

interface RunSnapshot {
  id: string;
  startedAt: number;
  completedAt?: number;
  agents: AgentSnapshot[];
}

type ObserverEvent =
  | {
      type: "run-start";
      runId: string;
      timestamp: number;
      agents: Array<{
        id: string;
        kind: string;
        task: string;
        model: string;
        thinking: string;
        tools: string[];
      }>;
    }
  | { type: "agent-start"; runId: string; agentId: string; timestamp: number }
  | { type: "child-event"; runId: string; agentId: string; event: ChildEvent }
  | { type: "stderr"; runId: string; agentId: string; text: string }
  | {
      type: "agent-end";
      runId: string;
      agentId: string;
      timestamp: number;
      exitCode: number;
      stopReason?: string;
    }
  | { type: "run-end"; runId: string; timestamp: number };

interface ChildEvent {
  type?: string;
  delta?: string;
  message?: { role?: string; content?: unknown; isError?: boolean };
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
}

class ObserverStore {
  private runs: RunSnapshot[] = [];
  private listeners = new Set<() => void>();
  private notifyTimer?: ReturnType<typeof setTimeout>;

  getRuns(): readonly RunSnapshot[] {
    return this.runs;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handle(data: unknown): void {
    if (!isObserverEvent(data)) return;
    const event = data;

    if (event.type === "run-start") {
      this.runs.push({
        id: event.runId,
        startedAt: event.timestamp,
        agents: event.agents.map((agent) => ({
          ...agent,
          status: "pending",
          activity: ["Waiting to start"],
          activityChars: "Waiting to start".length,
          streamingText: "",
        })),
      });
      if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
      this.notify();
      return;
    }

    const run = this.runs.find((candidate) => candidate.id === event.runId);
    if (!run) return;

    if (event.type === "run-end") {
      run.completedAt = event.timestamp;
      this.notify();
      return;
    }

    const agent = run.agents.find((candidate) => candidate.id === event.agentId);
    if (!agent) return;

    switch (event.type) {
      case "agent-start":
        agent.status = "running";
        agent.activity = [];
        agent.activityChars = 0;
        appendActivity(agent, "Started");
        break;
      case "stderr":
        appendActivity(agent, `stderr: ${event.text.trim()}`);
        break;
      case "agent-end":
        agent.streamingText = "";
        agent.status =
          event.stopReason === "aborted" || event.exitCode === 130
            ? "aborted"
            : event.exitCode === 0 && event.stopReason !== "error"
              ? "completed"
              : "failed";
        appendActivity(agent, `${agent.status} (exit ${event.exitCode})`);
        break;
      case "child-event":
        applyChildEvent(agent, event.event);
        break;
    }
    this.notify(event.type === "child-event" && event.event.type === "text_delta");
  }

  dispose(): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = undefined;
    this.listeners.clear();
  }

  private notify(throttle = false): void {
    if (this.listeners.size === 0) return;
    if (throttle) {
      if (this.notifyTimer) return;
      this.notifyTimer = setTimeout(() => {
        this.notifyTimer = undefined;
        for (const listener of this.listeners) listener();
      }, 50);
      this.notifyTimer.unref();
      return;
    }
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = undefined;
    for (const listener of this.listeners) listener();
  }
}

function isObserverEvent(data: unknown): data is ObserverEvent {
  if (!data || typeof data !== "object") return false;
  const value = data as { type?: unknown; runId?: unknown };
  return typeof value.type === "string" && typeof value.runId === "string";
}

function appendActivity(agent: AgentSnapshot, text: string): void {
  const normalized = text.trim();
  if (!normalized) return;
  const bounded = normalized.length > MAX_STREAMING_CHARS
    ? `…${normalized.slice(-MAX_STREAMING_CHARS)}`
    : normalized;
  agent.activity.push(bounded);
  agent.activityChars += bounded.length;
  while (agent.activityChars > MAX_ACTIVITY_CHARS && agent.activity.length > 1) {
    agent.activityChars -= agent.activity.shift()?.length ?? 0;
  }
}

function applyChildEvent(agent: AgentSnapshot, event: ChildEvent): void {
  switch (event.type) {
    case "tool_execution_start":
      agent.streamingText = "";
      appendActivity(agent, `→ ${formatToolCall(event.toolName ?? "tool", event.args ?? {})}`);
      break;
    case "tool_execution_end":
      appendActivity(agent, `${event.isError ? "✗" : "✓"} ${event.toolName ?? "tool"}`);
      break;
    case "text_start":
      agent.streamingText = "";
      break;
    case "text_delta": {
      const text = agent.streamingText + (event.delta ?? "");
      agent.streamingText = text.length > MAX_STREAMING_CHARS ? `…${text.slice(-MAX_STREAMING_CHARS)}` : text;
      break;
    }
    case "message_end": {
      const text = messageText(event.message);
      agent.streamingText = "";
      if (event.message?.role === "toolResult") {
        if (event.message.isError && text) appendActivity(agent, `failed tool result:\n${text}`);
      } else if (event.message?.role === "assistant" && text) {
        appendActivity(agent, `assistant:\n${text}`);
      }
      break;
    }
  }
}

function messageText(message: ChildEvent["message"]): string {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function formatToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read":
      return `read ${String(args.path ?? "…")}`;
    case "grep":
      return `grep /${String(args.pattern ?? "")}/ in ${String(args.path ?? ".")}`;
    case "find":
      return `find ${String(args.pattern ?? "*")} in ${String(args.path ?? ".")}`;
    case "ls":
      return `ls ${String(args.path ?? ".")}`;
    case "bash":
      return `$ ${String(args.command ?? "…")}`;
    case "edit":
    case "write":
      return `${name} ${String(args.path ?? "…")}`;
    default: {
      const serialized = JSON.stringify(args);
      return `${name} ${serialized.length > 500 ? `${serialized.slice(0, 500)}…` : serialized}`;
    }
  }
}

class ObserverComponent implements Component {
  private selectedRunId?: string;
  private agentIndex = 0;
  private scrollOffset = 0;
  private follow = true;
  private newestRunId?: string;
  private unsubscribe: () => void;

  constructor(
    private readonly store: ObserverStore,
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly done: () => void,
  ) {
    this.selectedRunId = store.getRuns().at(-1)?.id;
    this.newestRunId = this.selectedRunId;
    this.unsubscribe = store.subscribe(() => {
      const newestRunId = store.getRuns().at(-1)?.id;
      if (newestRunId && newestRunId !== this.newestRunId) {
        this.newestRunId = newestRunId;
        this.selectedRunId = newestRunId;
        this.agentIndex = 0;
        this.resetView();
      }
      this.tui.requestRender();
    });
  }

  render(width: number): string[] {
    const runs = this.store.getRuns();
    if (runs.length === 0) return [truncateToWidth("No subagent runs have been observed.", width)];

    let runIndex = runs.findIndex((run) => run.id === this.selectedRunId);
    if (runIndex < 0) {
      runIndex = runs.length - 1;
      this.selectedRunId = runs[runIndex]?.id;
    }
    const run = runs[runIndex]!;
    this.agentIndex = Math.max(0, Math.min(this.agentIndex, run.agents.length - 1));
    const agent = run.agents[this.agentIndex]!;

    const statusColor =
      agent.status === "completed"
        ? "success"
        : agent.status === "failed" || agent.status === "aborted"
          ? "error"
          : "warning";
    const title =
      this.theme.fg("accent", this.theme.bold("Read-only subagent observer")) +
      this.theme.fg("dim", `  run ${runIndex + 1}/${runs.length}`);
    const agentHeader =
      this.theme.fg("toolTitle", this.theme.bold(agent.kind)) +
      this.theme.fg(statusColor, `  ${agent.status}`) +
      this.theme.fg("dim", `  agent ${this.agentIndex + 1}/${run.agents.length}`);
    const metadata = this.theme.fg(
      "dim",
      `${agent.model} • thinking ${agent.thinking} • tools: ${agent.tools.join(", ") || "none"}`,
    );

    const header = [
      truncateToWidth(title, width),
      truncateToWidth(agentHeader, width),
      ...wrapTextWithAnsi(metadata, Math.max(1, width)).map((line) => truncateToWidth(line, width)),
    ];
    const body: string[] = [];
    for (const item of agent.activity) {
      body.push(
        ...wrapTextWithAnsi(this.theme.fg("toolOutput", item), Math.max(1, width - 2)).map((line) =>
          truncateToWidth(`  ${line}`, width),
        ),
      );
    }
    if (agent.streamingText) {
      body.push(truncateToWidth(this.theme.fg("muted", "  assistant (streaming):"), width));
      body.push(
        ...wrapTextWithAnsi(this.theme.fg("toolOutput", agent.streamingText), Math.max(1, width - 4)).map(
          (line) => truncateToWidth(`    ${line}`, width),
        ),
      );
    }

    const availableBodyRows = Math.max(3, Math.floor(this.tui.terminal.rows * 0.8) - header.length - 4);
    const maxOffset = Math.max(0, body.length - availableBodyRows);
    if (this.follow) this.scrollOffset = maxOffset;
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxOffset));
    const visibleBody = body.slice(this.scrollOffset, this.scrollOffset + availableBodyRows);
    if (visibleBody.length === 0) {
      visibleBody.push(truncateToWidth(this.theme.fg("muted", "  (waiting for activity)"), width));
    }

    const help = this.theme.fg(
      "dim",
      "tab/shift+tab agents • [/ ] runs • ↑↓/pgup/pgdn scroll • end follow • esc close",
    );
    return [...header, "", ...visibleBody, "", truncateToWidth(help, width)];
  }

  handleInput(data: string): void {
    const runs = this.store.getRuns();
    if (matchesKey(data, Key.escape)) {
      this.done();
      return;
    }
    if (runs.length === 0) return;

    let runIndex = runs.findIndex((run) => run.id === this.selectedRunId);
    if (runIndex < 0) runIndex = runs.length - 1;
    const run = runs[runIndex]!;

    if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
      this.agentIndex = (this.agentIndex + 1) % run.agents.length;
      this.resetView();
    } else if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
      this.agentIndex = (this.agentIndex - 1 + run.agents.length) % run.agents.length;
      this.resetView();
    } else if (data === "[") {
      runIndex = Math.max(0, runIndex - 1);
      this.selectedRunId = runs[runIndex]!.id;
      this.agentIndex = 0;
      this.resetView();
    } else if (data === "]") {
      runIndex = Math.min(runs.length - 1, runIndex + 1);
      this.selectedRunId = runs[runIndex]!.id;
      this.agentIndex = 0;
      this.resetView();
    } else if (matchesKey(data, Key.up)) {
      this.follow = false;
      this.scrollOffset--;
    } else if (matchesKey(data, Key.down)) {
      this.follow = false;
      this.scrollOffset++;
    } else if (matchesKey(data, Key.pageUp)) {
      this.follow = false;
      this.scrollOffset -= 10;
    } else if (matchesKey(data, Key.pageDown)) {
      this.follow = false;
      this.scrollOffset += 10;
    } else if (matchesKey(data, Key.end)) {
      this.follow = true;
    }
    this.tui.requestRender();
  }

  invalidate(): void {}

  dispose(): void {
    this.unsubscribe();
  }

  private resetView(): void {
    this.follow = true;
    this.scrollOffset = 0;
  }
}

export default function (pi: ExtensionAPI) {
  const store = new ObserverStore();
  const unsubscribe = pi.events.on(CHANNEL, (event) => store.handle(event));
  let observerOpen = false;

  const openObserver = async (ctx: ExtensionContext | ExtensionCommandContext) => {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("The subagent observer is available only in interactive mode.", "warning");
      return;
    }
    if (store.getRuns().length === 0) {
      ctx.ui.notify("No subagent runs have been observed yet.", "info");
      return;
    }
    if (observerOpen) return;

    observerOpen = true;
    try {
      await ctx.ui.custom<void>(
        (tui, theme, _keybindings, done) => new ObserverComponent(store, tui, theme, done),
        {
          overlay: true,
          overlayOptions: { anchor: "center", width: "90%", maxHeight: "85%", margin: 1 },
        },
      );
    } finally {
      observerOpen = false;
    }
  };

  pi.registerCommand("subagents", {
    description: "Open the read-only live subagent observer",
    handler: async (_args, ctx) => openObserver(ctx),
  });

  pi.registerShortcut(Key.ctrlShift("s"), {
    description: "Open the read-only live subagent observer",
    handler: async (ctx) => openObserver(ctx),
  });

  pi.on("session_shutdown", () => {
    unsubscribe();
    store.dispose();
  });
}

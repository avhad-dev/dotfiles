import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Message, Usage } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const MAX_AGENTS = 4;
const DEFAULT_TOOLS = ["read", "grep", "find", "ls"] as const;

const ThinkingLevel = StringEnum(
  ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const,
  { description: "Reasoning level for this subagent" },
);

const ToolName = StringEnum(
  ["read", "grep", "find", "ls", "bash", "edit", "write"] as const,
  { description: "Built-in tool to expose to this subagent" },
);

const AgentRequest = Type.Object({
  kind: Type.String({
    description: "Short role label, for example scout, planner, reviewer, or worker",
  }),
  task: Type.String({ description: "Self-contained task for the subagent" }),
  instructions: Type.Optional(
    Type.String({ description: "Additional role-specific system instructions" }),
  ),
  model: Type.Optional(
    Type.String({ description: "Model ID or provider/model ID; defaults to the parent model" }),
  ),
  thinking: Type.Optional(ThinkingLevel),
  tools: Type.Optional(
    Type.Array(ToolName, {
      description: "Exact built-in tool allowlist; defaults to read, grep, find, and ls",
      uniqueItems: true,
    }),
  ),
});

interface ChildResult {
  kind: string;
  model: string;
  thinking: string;
  tools: string[];
  output: string;
  stderr: string;
  exitCode: number;
  stopReason?: string;
  errorMessage?: string;
  usage: Usage;
}

interface SubagentDetails {
  results: ChildResult[];
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const executable = basename(process.execPath).toLowerCase();
  if (!/^(node|bun)(\.exe)?$/.test(executable)) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

function finalAssistantText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    return message.content
      .filter((part): part is Extract<(typeof message.content)[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }
  return "";
}

function emptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function addUsage(total: Usage, usage: Usage): void {
  total.input += usage.input;
  total.output += usage.output;
  total.cacheRead += usage.cacheRead;
  total.cacheWrite += usage.cacheWrite;
  total.totalTokens += usage.totalTokens;
  total.cost.input += usage.cost.input;
  total.cost.output += usage.cost.output;
  total.cost.cacheRead += usage.cost.cacheRead;
  total.cost.cacheWrite += usage.cost.cacheWrite;
  total.cost.total += usage.cost.total;
  if (usage.cacheWrite1h !== undefined) {
    total.cacheWrite1h = (total.cacheWrite1h ?? 0) + usage.cacheWrite1h;
  }
  if (usage.reasoning !== undefined) {
    total.reasoning = (total.reasoning ?? 0) + usage.reasoning;
  }
}

async function truncateOutput(output: string): Promise<string> {
  const initial = truncateHead(output);
  if (!initial.truncated) return output;

  const outputPath = join("/tmp", `pi-subagent-output-${randomUUID()}.txt`);
  await writeFile(outputPath, output, { encoding: "utf8", flag: "wx", mode: 0o600 });

  const notice =
    `\n\n[Output truncated to 50 KB or 2,000 lines. ` +
    `Full output can be found at ${outputPath}.]`;
  const result = truncateHead(output, {
    maxBytes: DEFAULT_MAX_BYTES - Buffer.byteLength(notice, "utf8"),
    maxLines: DEFAULT_MAX_LINES - 2,
  });
  return `${result.content}${notice}`;
}

async function runAgent(
  cwd: string,
  request: {
    kind: string;
    task: string;
    instructions?: string;
    model?: string;
    thinking?: string;
    tools?: string[];
  },
  parentModel: string,
  parentThinking: string,
  signal: AbortSignal | undefined,
): Promise<ChildResult> {
  const model = request.model ?? parentModel;
  const thinking = request.thinking ?? parentThinking;
  const tools = request.tools ?? [...DEFAULT_TOOLS];
  const rolePrompt = [
    `You are an isolated ${request.kind} subagent.`,
    "Complete only the delegated task and return a concise, self-contained result to the parent agent.",
    "Do not delegate to other agents.",
    request.instructions,
  ]
    .filter(Boolean)
    .join("\n");

  const args = [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--model",
    model,
    "--thinking",
    thinking,
    "--tools",
    tools.join(","),
    "--append-system-prompt",
    rolePrompt,
    `Task: ${request.task}`,
  ];

  const messages: Message[] = [];
  let stderr = "";
  let stopReason: string | undefined;
  let errorMessage: string | undefined;
  let aborted = false;
  const usage = emptyUsage();
  const invocation = getPiInvocation(args);

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";

    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line) as { type?: string; message?: Message };
        if (event.type !== "message_end" || !event.message) return;
        messages.push(event.message);
        if (event.message.role === "assistant") {
          stopReason = event.message.stopReason;
          errorMessage = event.message.errorMessage;
          addUsage(usage, event.message.usage);
        }
      } catch {
        // Ignore non-JSON diagnostics; JSON mode emits one event per line.
      }
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      resolve(1);
    });
    child.on("close", (code) => {
      if (stdout.trim()) consumeLine(stdout);
      resolve(code ?? 1);
    });

    const abort = () => {
      aborted = true;
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      timer.unref();
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });

  return {
    kind: request.kind,
    model,
    thinking,
    tools,
    output: finalAssistantText(messages),
    stderr: stderr.trim(),
    exitCode: aborted ? 130 : exitCode,
    stopReason: aborted ? "aborted" : stopReason,
    errorMessage,
    usage,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Run one or more isolated, ephemeral Pi subprocesses. Each agent may use a different role, model, thinking level, and exact built-in tool allowlist. Agents run concurrently and cannot access extensions or skills.",
    promptSnippet: "Delegate independent or specialized work to isolated Pi subagents",
    promptGuidelines: [
      "Use subagent when independent context, parallel investigation, or a specialized role would improve the result.",
      "Give every subagent a self-contained task and the minimum tools it needs; omit tools for read-only investigation.",
      "Do not use subagent for trivial work or delegate the same task recursively.",
    ],
    parameters: Type.Object({
      agents: Type.Array(AgentRequest, {
        minItems: 1,
        maxItems: MAX_AGENTS,
        description: `Agents to run concurrently (maximum ${MAX_AGENTS})`,
      }),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const parentModel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "";
      if (!parentModel) throw new Error("No parent model is selected");

      const completed: ChildResult[] = [];
      const results = await Promise.all(
        params.agents.map(async (request) => {
          const result = await runAgent(
            ctx.cwd,
            request,
            parentModel,
            ctx.thinkingLevel,
            signal,
          );
          completed.push(result);
          onUpdate?.({
            content: [
              {
                type: "text",
                text: `${completed.length}/${params.agents.length} subagents completed`,
              },
            ],
            details: { results: [...completed] } satisfies SubagentDetails,
          });
          return result;
        }),
      );

      if (signal?.aborted) throw new Error("Subagents were aborted");

      const sections = results.map((result) => {
        const failed = result.exitCode !== 0 || result.stopReason === "error";
        const body = failed
          ? result.errorMessage || result.stderr || result.output || "No error details returned"
          : result.output || "(no output)";
        return `## ${result.kind} — ${failed ? "failed" : "completed"}\n\n${body}`;
      });

      const usage = emptyUsage();
      for (const result of results) addUsage(usage, result.usage);

      return {
        content: [
          { type: "text", text: await truncateOutput(sections.join("\n\n---\n\n")) },
        ],
        details: { results } satisfies SubagentDetails,
        usage,
      };
    },
  });
}

import { NextRequest } from "next/server";
import { sendMessage, type StreamEvent } from "@/lib/agents";
import { logActivity } from "@/lib/activity";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { projectPath?: string; prompt?: string };
  const projectPath = body.projectPath?.trim();
  const prompt = body.prompt?.trim();

  if (!projectPath || !prompt) {
    return new Response("projectPath and prompt are required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const projectLabel = path.basename(projectPath);
      logActivity("chat.user", `Message sent to ${projectLabel}`, {
        detail: prompt.slice(0, 120),
        projectPath,
      });
      let assistantBuf = "";
      const send = (e: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        if (e.type === "text_delta") assistantBuf += e.text;
        if (e.type === "tool_use") {
          logActivity("chat.tool", `Tool: ${e.name}`, {
            detail: JSON.stringify(e.input).slice(0, 120),
            projectPath,
          });
        }
        if (e.type === "done" && assistantBuf.trim()) {
          logActivity("chat.assistant", `Reply from ${projectLabel}`, {
            detail: assistantBuf.slice(0, 160),
            projectPath,
          });
        }
      };
      const abort = new AbortController();
      req.signal.addEventListener("abort", () => abort.abort());
      try {
        await sendMessage({ projectPath, prompt, onEvent: send, signal: abort.signal });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

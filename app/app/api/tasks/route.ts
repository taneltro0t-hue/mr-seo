import { NextRequest, NextResponse } from "next/server";
import { appendTask, readTasks, readWorkerStatus } from "@/lib/agents";
import { taskCore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json({ ...readTasks(), worker: readWorkerStatus() });
  } catch (e) {
    return NextResponse.json({ error: "tasks_failed", message: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!text) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  try {
    // дедуп: такая же незакрытая задача уже в очереди → не плодим
    const existing = readTasks().tasks.find((q) => q.status === "queued" && taskCore(q.text) === taskCore(text));
    if (existing) {
      return NextResponse.json({ ok: true, dedup: true, task: existing });
    }
    const task = appendTask(text);
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json({ error: "append_failed", message: String(e) }, { status: 500 });
  }
}

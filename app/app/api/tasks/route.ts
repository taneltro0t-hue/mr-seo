import { NextRequest, NextResponse } from "next/server";
import { appendTask, readTasks } from "@/lib/agents";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(readTasks());
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
    const task = appendTask(text);
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json({ error: "append_failed", message: String(e) }, { status: 500 });
  }
}

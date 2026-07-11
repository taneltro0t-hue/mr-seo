import { NextRequest, NextResponse } from "next/server";
import { appendNewSite } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let url = "";
  let name = "";
  let connections: string[] = [];
  try {
    const body = await req.json();
    url = String(body?.url ?? "").trim();
    name = String(body?.name ?? "").trim();
    if (Array.isArray(body?.connections)) {
      connections = body.connections.map((c: unknown) => String(c)).slice(0, 12);
    }
  } catch {
    /* ignore */
  }

  if (!url || !name) {
    return NextResponse.json(
      { error: "empty", message: "Нужны название и URL сайта." },
      { status: 400 }
    );
  }

  try {
    const task = appendNewSite({ url, name, connections });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json(
      { error: "append_failed", message: String(e) },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { buildAgents } from "@/lib/agents";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(buildAgents());
  } catch (e) {
    return NextResponse.json({ error: "agents_failed", message: String(e) }, { status: 500 });
  }
}

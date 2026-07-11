import { NextResponse } from "next/server";
import { buildAgentMetrics } from "@/lib/agent-metrics";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(buildAgentMetrics());
  } catch (e) {
    return NextResponse.json({ error: "agent_metrics_failed", message: String(e) }, { status: 500 });
  }
}

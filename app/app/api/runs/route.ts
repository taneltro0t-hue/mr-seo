import { NextResponse } from "next/server";
import { buildRuns } from "@/lib/runs";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(buildRuns());
  } catch (e) {
    return NextResponse.json({ error: "runs_failed", message: String(e) }, { status: 500 });
  }
}

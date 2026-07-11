import { NextResponse } from "next/server";
import { buildHypotheses } from "@/lib/hypotheses";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(buildHypotheses());
  } catch (e) {
    return NextResponse.json({ error: "hypotheses_failed", message: String(e) }, { status: 500 });
  }
}

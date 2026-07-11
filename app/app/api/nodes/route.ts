import { NextResponse } from "next/server";
import { buildNodes } from "@/lib/nodes";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json(buildNodes());
  } catch (e) {
    return NextResponse.json(
      { error: "nodes_failed", message: String(e) },
      { status: 500 }
    );
  }
}

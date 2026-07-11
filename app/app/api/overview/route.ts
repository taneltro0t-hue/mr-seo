import { NextRequest, NextResponse } from "next/server";
import { buildOverview } from "@/lib/overview";
import { isSiteKey } from "@/lib/sites";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site");
  const key = isSiteKey(site) ? site : "mysite";
  try {
    const data = buildOverview(key);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: "overview_failed", message: String(e) },
      { status: 500 }
    );
  }
}

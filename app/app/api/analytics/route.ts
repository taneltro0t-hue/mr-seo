import { NextRequest, NextResponse } from "next/server";
import { buildAnalytics } from "@/lib/analytics";
import { isSiteKey } from "@/lib/sites";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site");
  const key = isSiteKey(site) ? site : "mysite";
  try {
    return NextResponse.json(buildAnalytics(key));
  } catch (e) {
    return NextResponse.json(
      { error: "analytics_failed", message: String(e) },
      { status: 500 }
    );
  }
}

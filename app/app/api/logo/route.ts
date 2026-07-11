import { NextRequest } from "next/server";
import { getSiteLogo } from "@/lib/site-logo";
import { isSiteKey } from "@/lib/sites";

export const dynamic = "force-dynamic";

/**
 * GET /api/logo?site=mysite → байты логотипа сайта (favicon/og), кэш-прокси.
 * Клиент вставляет как <img src="/api/logo?site=…">; при 404 падает на кружок.
 */
export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get("site");
  if (!isSiteKey(site)) {
    return Response.json({ ok: false, error: "неизвестный site" }, { status: 400 });
  }
  const asset = await getSiteLogo(site);
  if (!asset) {
    return Response.json({ ok: false, error: "логотип не найден" }, { status: 404 });
  }
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SITES } from "./sites";
import type { SiteKey } from "./types";

/**
 * Резолвер логотипов сайтов для «OG-логотипов» рэйла/шапок/узлов.
 * Тянет главную сайта, парсит <link rel=icon> / apple-touch-icon / og:image,
 * выбирает лучший квадратный источник, качает байты и кэширует:
 *   1) в память процесса (мгновенно между запросами),
 *   2) на диск (.cache/logos/<site>) — переживает hot-reload.
 * Роут /api/logo?site= отдаёт байты. Клиент при ошибке падает на цветной кружок.
 */

export interface LogoAsset {
  bytes: Buffer;
  contentType: string;
  source: string; // откуда взят (для дебага)
}

// Хост для fetch логотипа. SITES[site].domain у demo3 — витринный
// demo3-stavropol.ru (сейчас не отвечает), реальный хост — punycode основа26.рф.
const LOGO_HOST: Partial<Record<SiteKey, string>> = {
  demo3: "example.net",
};

const CACHE_DIR = path.join(process.cwd(), ".cache", "logos");
const MEM = new Map<SiteKey, LogoAsset>();
const NEG = new Map<SiteKey, number>(); // site → timestamp последнего провала
const NEG_TTL = 10 * 60 * 1000; // 10 мин между повторными попытками после провала
const FETCH_TIMEOUT = 9000;

function extFor(contentType: string): string {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("x-icon") || contentType.includes("vnd.microsoft.icon")) return "ico";
  if (contentType.includes("webp")) return "webp";
  return "bin";
}

function readDiskCache(site: SiteKey): LogoAsset | null {
  try {
    const metaPath = path.join(CACHE_DIR, `${site}.json`);
    if (!fs.existsSync(metaPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      file: string;
      contentType: string;
      source: string;
    };
    const filePath = path.join(CACHE_DIR, meta.file);
    if (!fs.existsSync(filePath)) return null;
    return { bytes: fs.readFileSync(filePath), contentType: meta.contentType, source: meta.source };
  } catch {
    return null;
  }
}

function writeDiskCache(site: SiteKey, asset: LogoAsset) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = `${site}.${extFor(asset.contentType)}`;
    fs.writeFileSync(path.join(CACHE_DIR, file), asset.bytes);
    fs.writeFileSync(
      path.join(CACHE_DIR, `${site}.json`),
      JSON.stringify({ file, contentType: asset.contentType, source: asset.source })
    );
  } catch {
    /* кэш — не критично */
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Mozilla/5.0 (Mr.Seo logo fetcher)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface Candidate {
  url: string;
  score: number;
}

/** Разобрать HTML главной и вернуть кандидатов в логотип, лучший — первым. */
function parseCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = [];
  const abs = (href: string): string | null => {
    try {
      return new URL(href, base).href;
    } catch {
      return null;
    }
  };
  const sizeOf = (tag: string): number => {
    const m = tag.match(/sizes=["']?(\d+)x\d+/i);
    return m ? parseInt(m[1], 10) : 0;
  };

  // <link rel="... icon / apple-touch-icon ...">
  const linkRe = /<link\b[^>]*>/gi;
  for (const tag of html.match(linkRe) ?? []) {
    if (!/rel=["'][^"']*icon/i.test(tag)) continue;
    const hrefM = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefM) continue;
    const url = abs(hrefM[1]);
    if (!url) continue;
    const isApple = /apple-touch-icon/i.test(tag);
    const isSvg = /image\/svg/i.test(tag) || /\.svg(\?|$)/i.test(url);
    const size = sizeOf(tag);
    // Приоритет: квадратные растровые логотипы высокого разрешения и SVG.
    let score = 40 + size; // базово ценим по размеру
    if (isApple) score += 120; // apple-touch-icon обычно 180×180 — лучший квадрат
    if (isSvg) score += 80; // масштабируется идеально
    out.push({ url, score });
  }

  // og:image — широкая картинка, худший вариант для кольца, но лучше пустоты.
  const ogM = html.match(
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  if (ogM) {
    const url = abs(ogM[1]);
    if (url) out.push({ url, score: 10 });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

async function fetchBytes(url: string): Promise<LogoAsset | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Mozilla/5.0 (Mr.Seo logo fetcher)" },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0].trim() || "image/png";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 2_000_000) return null; // санитария
    return { bytes: buf, contentType: ct, source: url };
  } catch {
    return null;
  }
}

/** Достать логотип сайта (память → диск → сеть). null если не удалось. */
export async function getSiteLogo(site: SiteKey): Promise<LogoAsset | null> {
  const mem = MEM.get(site);
  if (mem) return mem;

  const disk = readDiskCache(site);
  if (disk) {
    MEM.set(site, disk);
    return disk;
  }

  const failedAt = NEG.get(site);
  if (failedAt && Date.now() - failedAt < NEG_TTL) return null;

  const host = LOGO_HOST[site] ?? SITES[site].domain;
  const home = `https://${host}/`;
  const html = await fetchText(home);

  const candidates: Candidate[] = html ? parseCandidates(html, home) : [];
  // Гарантированный запасной путь — /favicon.ico всегда стоит попробовать последним.
  candidates.push({ url: new URL("/favicon.ico", home).href, score: 0 });

  for (const c of candidates) {
    const asset = await fetchBytes(c.url);
    if (asset) {
      MEM.set(site, asset);
      writeDiskCache(site, asset);
      return asset;
    }
  }

  NEG.set(site, Date.now());
  return null;
}

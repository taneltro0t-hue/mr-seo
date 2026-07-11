import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «Объясни цифру»: POST {site, metric, value, context?} → короткое объяснение
 *  мозгом в контексте живых данных (тот же orchestrator chat). */
const SEO_AGENT_ROOT = process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");

export async function POST(req: NextRequest) {
  let site = "mysite", metric = "", value = "", context = "", lang = "ru";
  try {
    const b = await req.json();
    site = String(b?.site ?? "mysite");
    metric = String(b?.metric ?? "").slice(0, 120);
    value = String(b?.value ?? "").slice(0, 60);
    context = String(b?.context ?? "").slice(0, 200);
    lang = b?.lang === "en" ? "en" : "ru";
  } catch {}
  if (!metric) return new Response(lang === "en" ? "explain what?" : "что объяснить?", { status: 400 });

  const langLine = lang === "en" ? "Отвечай на английском языке." : "Отвечай на русском языке.";
  const q = `${langLine} [Пользователь смотрит сайт: ${site}] Объясни ОДНУ цифру просто и коротко (2-4 предложения, без приветствий): метрика «${metric}» = ${value}${context ? `, контекст: ${context}` : ""}. Что это значит для меня и хорошо это или плохо?`;
  const py = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
  const child = spawn(py, [path.join(SEO_AGENT_ROOT, "swarm", "orchestrator.py"), "chat"], { cwd: SEO_AGENT_ROOT });
  child.stdin.write(q); child.stdin.end();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      const enc = new TextEncoder();
      const t = setTimeout(() => child.kill("SIGKILL"), 280_000);
      child.stdout.on("data", (d: Buffer) => c.enqueue(enc.encode(d.toString("utf-8"))));
      child.on("close", () => { clearTimeout(t); c.close(); });
      child.on("error", (e) => { c.enqueue(enc.encode((lang === "en" ? "brain unavailable: " : "мозг недоступен: ") + String(e).slice(0, 100))); c.close(); });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

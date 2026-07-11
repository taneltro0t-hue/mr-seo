import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Мозг Mr.Seo: вопрос → swarm/orchestrator.py chat → headless Claude
 * (инференс на подписке пользователя, трюк Zoey — шелл в первосторонний
 * `claude` бинарь) → ответ по живым данным seo-agent.
 *
 * Контракт: POST { message: string, site?: string } → text/plain stream.
 * Оркестратор сам собирает дайджест (позиции, якоря, репутация, алерты)
 * и подмешивает его в контекст — здесь только транспорт.
 */
const SEO_AGENT_ROOT =
  process.env.SEO_AGENT_ROOT ?? path.resolve(process.cwd(), "..");

const SITE_LABEL: Record<string, string> = {
  // mysite: "example.com (описание бизнеса для контекста ассистента)",
};

export async function POST(req: NextRequest) {
  let message = "";
  let site = "mysite";
  try {
    const body = await req.json();
    message = String(body?.message ?? "").slice(0, 2000);
    site = String(body?.site ?? "mysite");
  } catch {
    /* ignore */
  }

  if (!message.trim()) {
    return new Response(
      "Привет. Я Mr.Seo — вижу свежие данные ваших сайтов. Спросите, например: «почему Москва не растёт?» или «что сделать на этой неделе?».",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  // вопрос префиксуем выбранным сайтом — дайджест общий, фокус задаёт префикс
  const question = `[Пользователь смотрит сайт: ${SITE_LABEL[site] ?? site}]\n${message}`;

  const py = path.join(SEO_AGENT_ROOT, "venv", "bin", "python");
  const script = path.join(SEO_AGENT_ROOT, "swarm", "assistant.py");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const child = spawn(py, [script, "chat", "--thread", "app"], {
        cwd: SEO_AGENT_ROOT,
        env: { ...process.env, HOME: process.env.HOME ?? "" },
      });
      const timer = setTimeout(() => child.kill("SIGKILL"), 280_000);

      child.stdin.write(question);
      child.stdin.end();

      let sentAny = false;
      let buf = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buf += chunk.toString("utf-8");
      });
      const flush = () => {
        try {
          const d = JSON.parse(buf.trim());
          sentAny = true;
          controller.enqueue(enc.encode(String(d.text ?? buf)));
        } catch {
          if (buf.trim()) { sentAny = true; controller.enqueue(enc.encode(buf)); }
        }
      };
      let errBuf = "";
      child.stderr.on("data", (c: Buffer) => (errBuf += c.toString("utf-8")));
      child.on("close", (code) => {
        clearTimeout(timer);
        flush();
        if (!sentAny) {
          controller.enqueue(
            enc.encode(
              code === 0
                ? "Не получил ответа от мозга — попробуйте ещё раз."
                : `Мозг временно недоступен (${errBuf.slice(0, 160) || "код " + code}). Данные на дашборде живые — сводка и советы там.`,
            ),
          );
        }
        controller.close();
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        controller.enqueue(enc.encode(`Мозг недоступен: ${String(e).slice(0, 160)}`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

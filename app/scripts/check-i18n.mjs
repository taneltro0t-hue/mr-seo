// Проверка целостности i18n: каждый используемый в коде ключ обязан быть
// в СЛОВАРЕ обоих языков (ru + en). Source of truth — сам lib/i18n.tsx.
// Запуск: node scripts/check-i18n.mjs  (exit 1 при любом отсутствующем ключе)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const SRC = ["components", "app", "lib"];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

// известные пространства ключей — чтобы ловить строковые литералы-ключи
// (напр. label: "timeline.ev_commit"), а не любой текст с точкой.
const NS = "account|analytics|bell|common|dash|deploys|diag|explain|focus|hypo|insights|nav|nodes|noun|pult|report|roy|runs|timeline|today|wiz|chat";
// динамические ключи вида t(`dash.prio_${x}`) — перечисляем возможные суффиксы вручную
const DYNAMIC = {
  "dash.prio_": ["high", "medium", "low"],
};

const used = new Set();
for (const d of SRC) {
  for (const f of walk(join(app, d))) {
    const isDict = f.endsWith(join("lib", "i18n.tsx"));
    const s = readFileSync(f, "utf-8");
    for (const m of s.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g)) used.add(m[1]);
    for (const m of s.matchAll(/labelKey:\s*["']([a-zA-Z0-9_.]+)["']/g)) used.add(m[1]);
    for (const m of s.matchAll(/\btn\(\s*["']([a-zA-Z0-9_.]+)["']/g)) {
      used.add(`noun.${m[1]}.one`);
      used.add(`noun.${m[1]}.other`);
    }
    // строковые литералы-ключи (label:"ns.x") — вне самого словаря
    if (!isDict) {
      const lit = new RegExp(`["'](?:${NS})\\.[a-z0-9_]+["']`, "g");
      const EXT = /\.(py|ts|tsx|js|mjs|json|css|md|txt)$/;
      for (const m of s.matchAll(lit)) {
        const k = m[0].slice(1, -1);
        if (!EXT.test(k)) used.add(k);
      }
    }
    // раскрываем динамические t(`prefix_${...}`)
    for (const [prefix, sfx] of Object.entries(DYNAMIC)) {
      if (s.includes("`" + prefix)) for (const x of sfx) used.add(prefix + x);
    }
  }
}

const txt = readFileSync(join(app, "lib", "i18n.tsx"), "utf-8");
const body = /i18n:dict:start \*\/([\s\S]*?)\/\* i18n:dict:end/.exec(txt)?.[1] ?? txt;
function keysOf(lang) {
  const m = new RegExp(`${lang}:\\s*\\{([\\s\\S]*?)\\n\\s{2}\\},`).exec(body);
  const set = new Set();
  if (m) for (const k of m[1].matchAll(/"((?:[^"\\]|\\.)*)":\s*"/g)) set.add(k[1]);
  return set;
}
const ru = keysOf("ru");
const en = keysOf("en");

const cand = [...used].filter((k) => k.includes("."));
const missRu = cand.filter((k) => !ru.has(k)).sort();
const missEn = cand.filter((k) => !en.has(k)).sort();

console.log(`used(dotted)=${cand.length}  ru=${ru.size}  en=${en.size}`);
console.log(`missing ru=${missRu.length}  en=${missEn.length}`);
if (missRu.length || missEn.length) {
  if (missRu.length) console.error("MISSING ru:", missRu.join(", "));
  if (missEn.length) console.error("MISSING en:", missEn.join(", "));
  process.exit(1);
}
console.log("✓ i18n complete — все используемые ключи есть в обоих языках");

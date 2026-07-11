# INSTALL_AI — instructions for an AI agent / инструкция для ИИ-агента

> **Human:** open this file in any AI-powered IDE (Cursor, Claude Code, Windsurf,
> Copilot Chat, Zed AI...) and say: **"Install this project following INSTALL_AI.md"**.
> The agent will do the rest and ask you only for tokens.
>
> **Человек:** откройте этот файл в любой IDE с ИИ (Cursor, Claude Code, Windsurf,
> Copilot...) и скажите: **«Установи проект по INSTALL_AI.md»**. Агент сделает всё
> сам и спросит у вас только токены.

---

## YOU ARE AN AI AGENT. FOLLOW THESE STEPS EXACTLY.

You are installing **Mr.Seo** — a local SEO workstation (Next.js app + Python agent
swarm). Work from the repository root. Ask the human only when a step says ASK.
Never commit `.env`, `.env.local` or anything in `credentials/`.

### Step 0 — Preflight
1. Verify: `node -v` (need ≥ 20), `python3 --version` (need ≥ 3.11), `git --version`.
   If missing — install via the platform's standard package manager (brew/apt/winget)
   after confirming with the human.
2. Verify Claude Code CLI: `claude --version`.
   - If missing: `npm install -g @anthropic-ai/claude-code`, then tell the human:
     *"Run `claude` once in a terminal and log in with your Claude Pro/Max account,
     then tell me to continue."* Wait for confirmation.
   - Smoke test: `echo "" | claude -p "reply with exactly: ok" --model sonnet`
     must print `ok`.

### Step 1 — Python swarm
```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
cp sites_config.example.py sites_config.py
```

### Step 2 — Tokens (ASK the human, write into `.env`)
1. **Yandex Webmaster** (required for RU search):
   - ASK: *"Create an app at https://oauth.yandex.ru (access: Yandex.Webmaster),
     get an OAuth token, and paste it here."* → `YANDEX_OAUTH_TOKEN=`
   - Get user id yourself: `curl -s -H "Authorization: OAuth <TOKEN>"
     https://api.webmaster.yandex.net/v4/user/` → `user_id` → `YANDEX_USER_ID=`
2. **Google Search Console** (recommended, permanent access):
   - ASK the human to create a **service account** in Google Cloud Console
     (IAM → Service Accounts → create → JSON key), save the JSON as
     `credentials/gsc.json`, and add the service-account **email** as a user in
     Search Console for each site property (Settings → Users → Add, Full access).
3. Optional: `BING_API_KEY` (Bing Webmaster → Settings → API access),
   `TELEGRAM_SEO_BOT_TOKEN` + `TELEGRAM_SEO_CHAT_ID` for morning digests.

### Step 3 — Sites config
ASK: *"Which sites do we track? For each: a short key (latin), the URL, and the
host id exactly as shown in Yandex Webmaster address bar (format https:domain:443)."*
Write them into `sites_config.py` following the example inside.

### Step 4 — The app
```bash
cd app
npm install
printf "SEO_AGENT_ROOT=%s\n" "$(cd .. && pwd)" > .env.local
npm run dev
```
Verify: `curl -s http://localhost:3000` returns HTML. Tell the human the URL.

### Step 5 — First data
```bash
cd ..
./venv/bin/python daily_scan.py
```
Verify: a JSON file appeared in `memory/<site_key>/daily_snapshots/`.
Refresh the app — Dashboard shows real numbers.

### Step 6 — Autopilot (optional but recommended)
Schedule with cron (Linux) or launchd (macOS):
- `daily_scan.py` — daily, e.g. 09:00
- `./venv/bin/python swarm/orchestrator.py analyst` — daily 09:50 (morning digest)
- `./venv/bin/python swarm/queue_worker.py` — every 2 hours (executes queued tasks)
Create the schedule files yourself and load them; show the human what you created.

### Step 7 — Final checklist (run and report)
- [ ] `curl -s http://localhost:3000/api/today` → JSON without `error`
- [ ] `./venv/bin/python swarm/ops.py status` → yandex `ok:true` (google too, if configured)
- [ ] Chat orb in the app answers a test question
- [ ] `.env` and `credentials/` are NOT tracked by git (`git status`)

### Troubleshooting map
| Symptom | Fix |
|---|---|
| `claude: command not found` | `npm i -g @anthropic-ai/claude-code`, then login once |
| Claude replies "not logged in" | human runs `claude` interactively once |
| GSC 403 | service-account email not added to the Search Console property |
| Yandex 403/401 | token lacks Webmaster scope — recreate the OAuth app |
| Port 3000 busy | `PORT=3210 npm run dev` and use :3210 everywhere |
| App shows demo data | no snapshots yet — run Step 5 |
| `assistant` asks for permissions | it only runs `./venv/bin/python …` — use that exact form |

That's the whole install. Report success to the human with the app URL and what
was scheduled.

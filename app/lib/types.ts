// Shared domain types for Mr.Seo. Mirrors the on-disk schemas of the SEO agent.

export type SiteKey = "mysite" | "demo2" | "demo3";
export type Engine = "yandex" | "google" | "bing";

export interface QueryStat {
  position?: number;
  clicks?: number;
  impressions?: number; // google (GSC)
  shows?: number; // yandex (Webmaster)
  ctr?: number;
}

export interface Snapshot {
  site_key?: string;
  domain?: string;
  date: string;
  scanned_at?: string;
  yandex: Record<string, QueryStat> | { error: string };
  google: Record<string, QueryStat> | { error: string };
  bing: Record<string, QueryStat> | { error: string };
}

export type Tone = "good" | "ok" | "warn";
export type Trend = "up" | "down" | "flat";

export interface SparkPoint {
  date: string;
  pos: number | null;
}

export interface AnchorEngine {
  series: SparkPoint[];
  latest: number | null;
  first: number | null;
  trend: Trend; // "up" == позиция улучшилась (число уменьшилось)
  delta: number | null; // положит. = улучшение позиций
}

export interface Anchor {
  q: string;
  url: string;
  goalPos: number;
  priority: string;
  engines: Partial<Record<"yandex" | "google", AnchorEngine>>;
}

export interface SourceStatus {
  engine: Engine;
  status: "live" | "error";
  clicks7d: number;
  queries: number;
  inTop10: number;
  error?: string;
}

export interface ReputationItem {
  key: string;
  label: string;
  rating: number;
  reviews: number;
  dRating: number | null;
  dReviews: number | null;
}

export interface ScoreBreakdownItem {
  label: string;
  value: number; // 0..100 subscore
  weight: number; // 0..1
  hint: string;
}

export interface Score {
  value: number; // 0..100
  verdict: string;
  tone: Tone;
  breakdown: ScoreBreakdownItem[];
}

export type Priority = "high" | "medium" | "low";

export interface Advice {
  id: string;
  priority: Priority;
  tone: Tone;
  tag: string;
  title: string;
  body: string;
}

export interface SiteMeta {
  key: SiteKey;
  label: string;
  domain: string;
  kind: string;
  region: string;
  accent: string; // hex
}

export interface Overview {
  site: SiteMeta;
  date: string;
  mock: boolean;
  score: Score;
  advice: Advice[];
  anchors: Anchor[];
  sources: SourceStatus[];
  reputation: ReputationItem[];
  clicksSeries: { date: string; yandex: number; google: number }[];
}

// ---- Hypotheses ----
export type HypoStatus =
  | "proposed"
  | "pending"
  | "observe"
  | "confirmed"
  | "partial"
  | "falsified";

export interface Hypothesis {
  id: string;
  commit?: string;
  commit_date?: string;
  site: string;
  urls?: string[];
  change: string;
  expected?: string;
  actual_effect?: string;
  status: HypoStatus;
  verify_due?: string;
  verified_at?: string;
  executor?: string;
  targets_moved?: string[];
  source_finding?: string;
  graveyard_check?: string;
  lesson_id?: string;
  note?: string;
}

export interface Lesson {
  id: string; // L-001
  kind: "falsified" | "confirmed";
  title: string;
  body: string;
}

export interface HypothesesResponse {
  mock: boolean;
  columns: { status: HypoStatus; label: string; items: Hypothesis[] }[];
  lessons: Lesson[];
  stats: { total: number; confirmed: number; falsified: number; active: number };
}

// ---- Runs ----
export interface RunSummary {
  slug: string;
  date: string;
  title: string;
  markdown: string;
  signals: { site: string; tone: Tone; text: string }[];
}

export interface RunsResponse {
  mock: boolean;
  runs: RunSummary[];
}

// ---- Swarm / agents ----
export type AgentStatus = "live" | "sleeping" | "error" | "scheduled";

export interface AgentNode {
  id: string;
  name: string;
  role: string;
  runnable: boolean;
  status: AgentStatus;
  schedule: string;
  lastRun: string | null;
  lastRunAgo: string | null;
  lastResult: string | null;
  inputLabel: string;
  outputLabel: string;
}

export interface AgentsResponse {
  mock: boolean;
  agents: AgentNode[];
}

export interface SwarmTask {
  id: string;
  text: string;
  created: string;
  status: "queued" | "done";
  result?: string; // хвост после « → » у выполненных задач
}

export interface TasksResponse {
  tasks: SwarmTask[];
}

// ---- Nodes (data sources connectivity) ----
export type NodeKind = "yandex" | "google" | "bing" | "reputation" | "llm";
export type NodeState = "live" | "error" | "idle";

export interface DataNode {
  site: SiteKey;
  kind: NodeKind;
  label: string;
  sub: string;
  state: NodeState;
  metric: string | null; // короткая величина, напр. «24 запроса»
  detail: string; // человеческая строка о состоянии
  fix?: string; // что сделать, если ошибка/не подключено
  lastDate: string | null;
}

export interface NodesResponse {
  mock: boolean;
  groups: { site: SiteMeta; nodes: DataNode[] }[];
}

export interface NewSitePayload {
  url: string;
  name: string;
  connections: string[]; // человекочитаемые метки выбранных подключений
}

// ---- Deep analytics ----
export interface AiVisibilityQuery {
  query: string;
  city: string | null;
  mentioned: boolean;
  ourCited: string[];
  competitors: string[];
}

export interface AiVisibility {
  week: string | null;
  ranAt: string | null;
  total: number;
  mentioned: number;
  queries: AiVisibilityQuery[];
  competitors: { domain: string; count: number }[];
}

export interface YandexQueryRow {
  q: string;
  url: string;
  position: number;
  ctr: number;
  clicks: number;
  impressions: number;
  demand: number;
  series: (number | null)[];
}

export interface SerpRow {
  q: string;
  pos: number | null;
  top5: string[];
}

export interface SerpBlock {
  date: string | null;
  engine: string;
  rows: SerpRow[];
}

export interface Analytics {
  site: SiteMeta;
  ai: AiVisibility | null;
  yandex: YandexQueryRow[];
  serp: SerpBlock | null;
}

// ---- Working insights (swarm/insights.py) ----
export type InsightSrc = "google" | "yandex";

export interface QuickWin {
  query: string;
  src: InsightSrc;
  position: number;
  impressions: number;
  clicks: number;
  demand: number | null;
  url: string | null;
}
export interface QuickWinsResponse {
  site: string;
  count: number;
  wins: QuickWin[];
  note?: string;
}

export interface QueryPageQuery {
  query: string;
  src: InsightSrc;
  position: number;
  demand?: number;
  impressions?: number;
}
export interface QueryPageItem {
  page: string;
  queries: QueryPageQuery[];
  total_queries: number;
}
export interface QueryPageResponse {
  site: string;
  pages: QueryPageItem[];
}

export interface ReviewPoint {
  key: string;
  label: string;
  rating: number;
  reviews: number;
  new_7d: number;
  read_url: string;
  reply_url: string;
}
export interface ReviewsResponse {
  date: string;
  points: ReviewPoint[];
  note?: string;
}

// ---- Волна 2: диагностика (bridge → webmaster.py / insights.py) ----

/** Причина исключения страницы из поиска Яндекса. */
export interface ExcludedPage {
  url: string;
  date: string;
  reason: string; // код Вебмастера: LOW_QUALITY, REDIRECT_NOTSEARCHABLE, NOTHING_FOUND…
  reason_ru: string; // человеческая причина
}
export interface AppearedPage {
  url: string;
  date: string;
}
export interface ExcludedResponse {
  site: string;
  removed: ExcludedPage[];
  appeared: AppearedPage[];
  removed_count: number;
  appeared_count: number;
  note?: string;
}

export interface SqiPoint {
  date: string;
  value: number;
}
export interface SqiResponse {
  site: string;
  current: number | null;
  delta_period: number;
  history: SqiPoint[];
}

export interface LinkDonor {
  source: string;
  dest: string;
  discovered: string;
}
export interface LinksResponse {
  site: string;
  total_history: { date: string; total: number }[];
  fresh_donors: LinkDonor[];
  note?: string;
}

export interface CannibalPage {
  page: string;
  position: number;
  impressions: number;
}
export interface CannibalConflict {
  query: string;
  pages: CannibalPage[];
  total_impressions: number;
}
export interface CannibalizationResponse {
  site: string;
  count: number;
  conflicts: CannibalConflict[];
  note?: string;
}

export interface DecayRow {
  query: string;
  was: number;
  now: number;
  drop: number;
  impressions: number;
}
export interface DecayResponse {
  site: string;
  count: number;
  losing: DecayRow[];
  note?: string;
}

// ---- Ops / Пульт (bridge → swarm/ops.py) ----
export interface OpsTokenState {
  ok: boolean;
  note?: string;
  error?: string;
  fix?: string;
}
export interface OpsStatus {
  checked_at: string;
  gsc_sa: OpsTokenState;
  gsc_oauth: OpsTokenState;
  yandex: OpsTokenState;
  bing: OpsTokenState;
}
export interface OpsResult {
  ok: boolean;
  note?: string;
  error?: string;
}
export interface OpsQuota {
  ok: boolean;
  daily_quota?: number;
  remainder?: number;
  error?: string;
}
export interface OpsAiBots {
  ok: boolean;
  blocked?: string[];
  checked?: string[];
  note?: string;
  error?: string;
}

// ---- Раунд 10: «Сегодня» (swarm/today.py) ----
export type TodayActionKind = "merge" | "review" | "draft" | "verify" | "task" | "alert";

export interface TodayNight {
  time: string; // "19:22" или "" (без времени)
  what: string;
  ref: string; // путь к файлу-первоисточнику или ""
}

export interface TodayFix {
  type: "run" | "task";
  label: string;
  agent?: string; // для type=run: scan | verify | analyst | watchman
  task?: string;  // для type=task: текст задачи рою
}

export interface TodayAction {
  kind: TodayActionKind;
  priority: number; // 1 = высший
  title: string;
  fix?: TodayFix; // кнопка «исправить» — рой чинит по клику
  hint?: string; // команда для merge
  url?: string; // ссылка для review
  site?: string; // для kind=merge: ключ сайта (для кнопки «Слить и задеплоить»)
  branch?: string; // для kind=merge: ветка mrseo/*
}

export interface TodayResponse {
  date: string;
  night: TodayNight[];
  actions: TodayAction[];
}

// ---- Раунд 14: Деплои (swarm/deploys.py) ----
export type DeployStage = "awaiting_merge" | "verifying" | "confirmed" | "partial" | "falsified";

export interface DeployPending {
  site: string;
  branch: string;
  date: string;
  sha: string;
  task: string;
  stage: "awaiting_merge";
}

export interface DeployMerged {
  site: string;
  id: string;
  sha: string | null;
  date: string | null;
  task: string;
  stage: "verifying" | "confirmed" | "partial" | "falsified";
  verify_due?: string | null;
  verdict?: string | null;
  targets: string[];
}

export interface DeploysResponse {
  pending: DeployPending[];
  merged: DeployMerged[];
}

export interface DeployMergeResult {
  ok: boolean;
  note?: string;
  error?: string;
}

// ---- Раунд 11: «Фокус недели» (swarm/focus.py) ----
export type FocusExecutor = "рой" | "человек";
export interface FocusItem {
  site: string; // SiteKey; может прийти вне списка — проверяем isSiteKey
  title: string;
  why: string;
  action: string; // «[фокус site] …» — готовая задача для рою
  executor: FocusExecutor;
}
export interface FocusResponse {
  week?: string;
  generated?: string;
  focus: FocusItem[];
  error?: string;
}

// ---- Раунд 10: ROI-таймлайн (swarm/timeline.py) ----
export interface TimelinePoint {
  date: string;
  pos: number;
}
export type TimelineEventType = "commit" | "hypothesis" | "bridge" | "verdict";
export interface TimelineEvent {
  date: string;
  type: TimelineEventType;
  title: string;
  status?: string; // для verdict: falsified / partial / confirmed
}
export interface TimelineResponse {
  site: string;
  days: number;
  series: Record<string, TimelinePoint[]>;
  events: TimelineEvent[];
}

// ---- Раунд 10: Отчёт для клиента (swarm/report.py) ----
export interface ReportAnchor {
  query: string;
  was: number;
  now: number;
  delta: number;
}
export interface ReportWork {
  date: string;
  type?: string;
  title: string;
}
export interface ReportClicks {
  клики7д: number;
  топ10: number;
}
export interface ReportReputationPoint {
  rating: number;
  reviews: number;
  new: number;
}
export interface ReportResponse {
  site: string;
  period_days: number;
  generated: string;
  verdict: string;
  clicks: { was: Record<string, ReportClicks>; now: Record<string, ReportClicks> };
  anchors: ReportAnchor[];
  works: ReportWork[];
  works_total: number;
  reputation: Record<string, ReportReputationPoint>;
  sqi: { current: number | null; delta: number };
  md_path?: string;
}

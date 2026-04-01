// Minimal static app: loads ./conferences.json and renders two independently sortable/scrollable columns.
// Deadlines are interpreted in Anywhere-on-Earth (AoE), i.e., UTC-12.

const TAGS = ["LLMs", "Security", "Biometrics", "Speech", "Usability", "Blockchain", "Quantum", "Post-Quantum"];

const TAG_META = {
  "LLMs": { emoji: "🤖" },
  "Security": { emoji: "🔐" },
  "Biometrics": { emoji: "🧬" },
  "Speech": { emoji: "🗣️" },
  "Usability": { emoji: "🧠" },
  "Blockchain": { emoji: "⛓️" },
  "Quantum": { emoji: "⚛️" },
  "Post-Quantum": { emoji: "🛡️" }
};

function tagDisplay(tag) {
  const e = TAG_META?.[tag]?.emoji;
  return e ? `${e} ${tag}` : tag;
}

function tagToCssVar(tag) {
  switch (tag) {
    case "LLMs": return "var(--tag-llms)";
    case "Security": return "var(--tag-security)";
    case "Biometrics": return "var(--tag-biometrics)";
    case "Speech": return "var(--tag-speech)";
    case "Usability": return "var(--tag-usability)";
    case "Blockchain": return "var(--tag-blockchain)";
    case "Quantum": return "var(--tag-quantum)";
    case "Post-Quantum": return "var(--tag-post-quantum)";
    default: return null;
  }
}

function buildTagGradient(tags) {
  const vars = (tags || [])
    .map((t) => tagToCssVar(t))
    .filter(Boolean);
  if (vars.length === 0) return "";
  if (vars.length === 1) return `linear-gradient(180deg, ${vars[0]}, ${vars[0]})`;
  return `linear-gradient(180deg, ${vars.join(", ")})`;
}

const THEME_STORAGE_KEY = "conf_theme"; // "dark" | "light"
const HIDE_PAST_STORAGE_KEY = "conf_hide_past"; // "1" | "0"
const SEARCH_STORAGE_KEY = "conf_search"; // persisted query
const VIEW_STORAGE_KEY = "conf_view"; // "conferences" | "journals"
const FAV_STORAGE_KEY = "conf_favs_v1"; // JSON string array of favourite keys
const PRIORITY_ONLY_STORAGE_KEY = "conf_priority_only"; // "1" | "0"

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  const cb = document.getElementById("darkMode");
  if (cb) cb.checked = t === "dark";
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function loadHidePastDefault() {
  try {
    const v = localStorage.getItem(HIDE_PAST_STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    // ignore
  }
  return true;
}

function saveHidePast(value) {
  try {
    localStorage.setItem(HIDE_PAST_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function normalizeForSearch(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSubsequence(needle, haystack) {
  // Returns true if all chars in needle appear in order in haystack.
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function fuzzyScore(queryRaw, nameRaw) {
  const q = normalizeForSearch(queryRaw);
  const n = normalizeForSearch(nameRaw);
  if (!q) return 0;
  if (!n) return Number.NEGATIVE_INFINITY;

  if (n === q) return 1000;
  if (n.startsWith(q)) return 800 - (n.length - q.length);
  if (n.includes(q)) return 600 - (n.length - q.length);

  const qTokens = q.split(/\s+/).filter(Boolean);
  const nTokens = n.split(/\s+/).filter(Boolean);

  // Token prefix matches (e.g., "use sec" -> "usenix security")
  let tokenScore = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const nt of nTokens) {
      if (nt === qt) best = Math.max(best, 120);
      else if (nt.startsWith(qt)) best = Math.max(best, 90);
    }
    tokenScore += best;
  }

  // Subsequence fallback for abbreviations/typos (e.g., "usxsc" -> "usenix security")
  const subseq = isSubsequence(q.replace(/\s+/g, ""), n.replace(/\s+/g, "")) ? 80 : 0;
  const lenPenalty = Math.max(0, (n.length - q.length)) * 0.5;

  const score = tokenScore + subseq - lenPenalty;
  return score > 0 ? score : Number.NEGATIVE_INFINITY;
}

function loadSearchDefault() {
  try {
    return String(localStorage.getItem(SEARCH_STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

function saveSearch(value) {
  try {
    localStorage.setItem(SEARCH_STORAGE_KEY, String(value || ""));
  } catch {
    // ignore
  }
}

function loadViewDefault() {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "journals" || v === "conferences") return v;
  } catch {
    // ignore
  }
  return "conferences";
}

function saveView(v) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  } catch {
    // ignore
  }
}

function loadPriorityOnlyDefault() {
  try {
    const v = localStorage.getItem(PRIORITY_ONLY_STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // ignore
  }
  return false;
}

function savePriorityOnly(value) {
  try {
    localStorage.setItem(PRIORITY_ONLY_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function loadFavs() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

function saveFavs(set) {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function favKey(kind, id) {
  return `${String(kind)}:${String(id)}`;
}

function isFav(kind, id) {
  const s = window.__FAVS__;
  if (!s) return false;
  return s.has(favKey(kind, id));
}

function toggleFav(kind, id) {
  if (!window.__FAVS__) window.__FAVS__ = new Set();
  const key = favKey(kind, id);
  if (window.__FAVS__.has(key)) window.__FAVS__.delete(key);
  else window.__FAVS__.add(key);
  saveFavs(window.__FAVS__);
}

function favFirst(items, kind) {
  // Stable partition: keep the existing order within favourites and within non-favourites.
  const favs = [];
  const rest = [];
  for (const it of items) {
    (isFav(kind, it.id) ? favs : rest).push(it);
  }
  return favs.concat(rest);
}

function bindFilterToggle() {
  const btn = document.getElementById("filterToggle");
  const panel = document.getElementById("filtersPanel");
  if (!btn || !panel) return;
  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  // Default collapsed.
  setOpen(false);
  btn.addEventListener("click", () => setOpen(panel.hidden));
}

function bindBuilderModal() {
  const openBtn = document.getElementById("builderOpen");
  const modal = document.getElementById("builderModal");
  const closeBtn = document.getElementById("builderClose");
  const backdrop = document.getElementById("builderBackdrop");
  if (!openBtn || !modal) return;

  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const first = document.getElementById("builderName") || document.getElementById("builderKind");
    if (first) first.focus();
  };
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
    openBtn.focus();
  };

  openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (backdrop) backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") close();
  });
}

function renderBuilderTags() {
  const root = document.getElementById("builderTags");
  if (!root) return;
  root.textContent = "";
  for (const tag of TAGS) {
    const id = `builder-tag-${tag}`;
    const input = el("input", { type: "checkbox", id, "data-tag": tag });
    const label = el("label", { class: "tagPill", for: id }, [input, el("span", { text: tagDisplay(tag) })]);
    root.appendChild(label);
  }
}

function builderSelectedTags() {
  const root = document.getElementById("builderTags");
  if (!root) return [];
  return [...root.querySelectorAll('input[type="checkbox"][data-tag]')]
    .filter((x) => x.checked)
    .map((x) => String(x.getAttribute("data-tag")));
}

function setBuilderVisibility() {
  const kind = String(document.getElementById("builderKind")?.value || "conference");
  const subType = String(document.getElementById("builderSubmissionType")?.value || "datetime");

  const coreWrap = document.getElementById("builderCoreWrap");
  const sjrWrap = document.getElementById("builderSjrWrap");
  const subWrap = document.getElementById("builderSubmissionWrap");
  const isoWrap = document.getElementById("builderIsoWrap");
  const pickerWrap = document.getElementById("builderPickerWrap");
  const aoeWrap = document.getElementById("builderAoeWrap");
  const tbdWrap = document.getElementById("builderTbdWrap");

  const isConf = kind === "conference";
  if (coreWrap) coreWrap.hidden = !isConf;
  if (sjrWrap) sjrWrap.hidden = isConf;
  if (subWrap) subWrap.hidden = !isConf;
  if (isoWrap) isoWrap.hidden = !isConf || subType !== "datetime";
  if (pickerWrap) pickerWrap.hidden = !isConf || (subType !== "datetime" && subType !== "datetime_aot");
  if (aoeWrap) aoeWrap.hidden = !isConf || subType !== "datetime_aot";
  if (tbdWrap) tbdWrap.hidden = !isConf || subType !== "tbd";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function applyPickerToFields() {
  const dateEl = document.getElementById("builderPickerDate");
  const timeEl = document.getElementById("builderPickerTime");
  const tzEl = document.getElementById("builderPickerTz");
  const isoEl = document.getElementById("builderIso");
  const aoeEl = document.getElementById("builderAoe");
  if (!dateEl || !timeEl || !tzEl) return;
  const ymd = String(dateEl.value || "").trim(); // YYYY-MM-DD
  const time = String(timeEl.value || "").trim(); // HH:MM or HH:MM:SS
  if (!ymd || !time) return;
  const hms = time.length === 5 ? `${time}:00` : time;
  const tz = String(tzEl.value || "-12:00");

  // Fill ISO field for "datetime"
  if (isoEl) {
    const iso = tz === "Z"
      ? `${ymd}T${hms}Z`
      : `${ymd}T${hms}${tz}`;
    isoEl.value = iso;
  }

  // Fill AoE wall-clock field for "datetime_aot" (timezone-less)
  if (aoeEl) {
    aoeEl.value = `${ymd}T${hms}`;
  }
}

function builderGenerateItem() {
  const kind = String(document.getElementById("builderKind")?.value || "conference");
  const name = String(document.getElementById("builderName")?.value || "").trim();
  const url = String(document.getElementById("builderUrl")?.value || "").trim();
  const note = String(document.getElementById("builderNote")?.value || "");
  const tags = builderSelectedTags();

  const out = document.getElementById("builderOut");
  const hint = document.getElementById("builderHint");

  if (!name) {
    if (out) out.value = "";
    if (hint) hint.textContent = "Name is required.";
    return null;
  }

  let item = { name, url, tags, note };

  if (kind === "journal") {
    const sjr = String(document.getElementById("builderSjr")?.value || "").trim();
    if (sjr) item.sjr = sjr;
    if (hint) hint.innerHTML = `Paste into <span class="mono">journals.json</span>.`;
  } else {
    const core = String(document.getElementById("builderCore")?.value || "").trim();
    if (core) item.core_ranking = core;

    const subType = String(document.getElementById("builderSubmissionType")?.value || "datetime");
    if (subType === "datetime") {
      const iso = String(document.getElementById("builderIso")?.value || "").trim();
      item.submission = { type: "datetime", iso };
    } else if (subType === "datetime_aot") {
      const aot = String(document.getElementById("builderAoe")?.value || "").trim();
      item.submission = { type: "datetime_aot", aot };
    } else {
      const date = String(document.getElementById("builderDate")?.value || "").trim();
      item.submission = { type: "tbd", date };
    }
    if (hint) hint.innerHTML = `Paste into <span class="mono">conferences.json</span>.`;
  }

  // Drop empty fields for cleanliness.
  if (!item.url) delete item.url;
  if (!item.note) item.note = "";
  if (!Array.isArray(item.tags) || item.tags.length === 0) item.tags = [];

  if (out) out.value = JSON.stringify(item, null, 2);
  return item;
}

async function builderCopyOut() {
  const out = document.getElementById("builderOut");
  if (!out) return;
  const text = String(out.value || "");
  if (!text.trim()) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    out.focus();
    out.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
  }
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return null;
}

function systemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** AoE "now" in ms since epoch */
function nowAoEMs() {
  return Date.now() - 12 * 60 * 60 * 1000;
}

/**
 * Parse "AOT/AoE local time string" like "YYYY-MM-DDTHH:mm:ss" into epoch ms.
 * Interprets the provided wall clock time as UTC-12.
 */
function parseAoEDateTimeToEpochMs(aotString) {
  // Treat the input as if it were UTC, then shift forward by 12h to get real UTC.
  // Example: "2026-05-15T23:59:59" AoE corresponds to "2026-05-16T11:59:59Z".
  const asUtc = Date.parse(`${aotString}Z`);
  if (Number.isNaN(asUtc)) return null;
  return asUtc + 12 * 60 * 60 * 1000;
}

/**
 * Parse an ISO 8601 datetime that includes a timezone offset or Z.
 * Examples:
 * - 2026-02-05T23:59:00-12:00
 * - 2026-02-05T23:59:00Z
 */
function parseIsoWithTzToEpochMs(isoString) {
  const s = String(isoString || "").trim();
  if (!s) return null;
  // Require explicit TZ info to avoid accidental local-time parsing.
  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(s);
  if (!hasTz) return null;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  return ms;
}

function formatAoEParts(epochMs) {
  // Convert to AoE wall-clock by shifting back 12h and formatting in UTC.
  const aoeMs = epochMs - 12 * 60 * 60 * 1000;
  const d = new Date(aoeMs);
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${mi}:${ss}` };
}

function formatYmdToDmy(ymd) {
  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  const s = String(ymd || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function formatCountdown(deltaMs) {
  const sign = deltaMs < 0 ? "-" : "";
  const abs = Math.abs(deltaMs);
  const totalSeconds = Math.floor(abs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  return `${sign}${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatCountdownDAndHMS(deltaMs) {
  const sign = deltaMs < 0 ? "-" : "";
  const abs = Math.abs(deltaMs);
  const totalSeconds = Math.floor(abs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60); // includes days
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const dLine = `${sign}${days}d`;
  const hmsLine = `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  return { dLine, hmsLine };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function normalizeConference(raw, idx) {
  const name = String(raw?.name ?? "").trim();
  const url = String(raw?.url ?? "").trim();
  const core = String(raw?.core_ranking ?? "").trim();
  const tags = Array.isArray(raw?.tags) ? raw.tags.map(String) : [];
  const note = raw?.note != null ? String(raw.note) : "";
  const submission = raw?.submission ?? {};

  const base = {
    id: raw?.id ? String(raw.id) : `${idx}-${name || "conf"}`,
    name,
    url,
    core_ranking: core,
    tags,
    note,
    submission
  };

  if (submission?.type === "datetime_aot") {
    const epochMs = parseAoEDateTimeToEpochMs(String(submission.aot ?? ""));
    return { ...base, kind: "known", deadlineEpochMs: epochMs, deadlineSource: "aoe_wallclock" };
  }

  if (submission?.type === "datetime") {
    // Preferred: ISO 8601 with timezone offset or Z.
    // Example: { "type": "datetime", "iso": "2026-02-05T23:59:00-12:00" }
    const epochMs = parseIsoWithTzToEpochMs(String(submission.iso ?? ""));
    return { ...base, kind: "known", deadlineEpochMs: epochMs, deadlineSource: "iso_tz" };
  }

  if (submission?.type === "tbd") {
    const date = String(submission.date ?? "").trim(); // YYYY-MM-DD
    const approxEpochMs = date ? Date.parse(`${date}T00:00:00Z`) : null;
    return { ...base, kind: "tbd", approxDisclosureEpochMs: Number.isNaN(approxEpochMs) ? null : approxEpochMs };
  }

  // Back-compat / invalid: treat as TBD.
  return { ...base, kind: "tbd", approxDisclosureEpochMs: null };
}

function selectedTags() {
  const selected = new Set();
  for (const tag of TAGS) {
    const cb = document.querySelector(`input[data-tag="${CSS.escape(tag)}"]`);
    if (cb && cb.checked) selected.add(tag);
  }
  return selected;
}

function tagMatches(conf, selected, matchAll) {
  if (selected.size === 0) return true;
  const set = new Set(conf.tags || []);
  if (matchAll) {
    for (const t of selected) if (!set.has(t)) return false;
    return true;
  }
  for (const t of selected) if (set.has(t)) return true;
  return false;
}

function coreScore(core) {
  // Higher is "better" for sorting desc (A* > A > B > C > unranked).
  const c = String(core || "").toUpperCase().replace(/\s+/g, "");
  if (c === "A*") return 5;
  if (c === "A") return 4;
  if (c === "B") return 3;
  if (c === "C") return 2;
  if (c) return 1;
  return 0;
}

function sortKnown(items, mode) {
  const now = Date.now();
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byCore = (a, b) => coreScore(a.core_ranking) - coreScore(b.core_ranking);
  const byDeadline = (a, b) => (a.deadlineEpochMs ?? Number.POSITIVE_INFINITY) - (b.deadlineEpochMs ?? Number.POSITIVE_INFINITY);
  //const byCountdown = (a, b) => ((a.deadlineEpochMs ?? Number.POSITIVE_INFINITY) - now) - ((b.deadlineEpochMs ?? Number.POSITIVE_INFINITY) - now);

  const dir = mode.endsWith("Desc") ? -1 : 1;
  const key = mode.replace(/(Asc|Desc)$/, "");

  const cmp =
    key === "name" ? byName :
    key === "core" ? byCore :
    //key === "countdown" ? byCountdown :
    byDeadline;

  return [...items].sort((a, b) => dir * cmp(a, b));
}

function sortTbd(items, mode) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const byCore = (a, b) => coreScore(a.core_ranking) - coreScore(b.core_ranking);
  const byApprox = (a, b) => (a.approxDisclosureEpochMs ?? Number.POSITIVE_INFINITY) - (b.approxDisclosureEpochMs ?? Number.POSITIVE_INFINITY);

  const dir = mode.endsWith("Desc") ? -1 : 1;
  const key = mode.replace(/(Asc|Desc)$/, "");
  const cmp =
    key === "name" ? byName :
    key === "core" ? byCore :
    byApprox;
  return [...items].sort((a, b) => dir * cmp(a, b));
}

function renderTagFilter() {
  const root = document.getElementById("tagFilter");
  root.textContent = "";
  for (const tag of TAGS) {
    const id = `tag-${tag}`;
    const input = el("input", { type: "checkbox", id, "data-tag": tag });
    const label = el("label", { class: "tagPill", for: id }, [input, el("span", { text: tagDisplay(tag) })]);
    root.appendChild(label);
  }
}

function confRow(conf, { deadlineLines, countdownText = "", deadlineMuted = false, view }) {
  const primaryTag = (conf.tags || []).find(t => TAGS.includes(t)) || "";
  const tagChips = el(
    "div",
    { class: "tagList" },
    (conf.tags || []).map((t) => el("span", { class: "tagChip", text: tagDisplay(t), "data-tag": t }))
  );
  const noteText = String(conf.note || "").trim();
  const coreText = String(conf.core_ranking || "—").trim() || "—";
  const coreKeyRaw = coreText.toUpperCase().replace(/\s+/g, "");
  const coreKey =
    coreKeyRaw === "A*" ? "Astar" :
    coreKeyRaw === "—" ? "unranked" :
    coreKeyRaw === "-" ? "unranked" :
    coreKeyRaw === "" ? "unranked" :
    coreKeyRaw;
  const nameLink = conf.url
    ? el("a", { href: conf.url, target: "_blank", rel: "noopener noreferrer" }, [
        el("div", { class: "confName", text: conf.name || "(Unnamed)" }),
        el("div", { class: "confMeta", text: conf.url })
      ])
    : el("div", {}, [
        el("div", { class: "confName", text: conf.name || "(Unnamed)" }),
        el("div", { class: "confMeta muted", text: "No URL provided" })
      ]);

  const coreBadge = el("div", { class: `coreBadge coreBadge--${coreKey}`, text: coreText, title: `CORE: ${coreText}` });
  const favOn = isFav("conf", conf.id);
  const favBtn = el(
    "button",
    {
      type: "button",
      class: "favBtn",
      "aria-label": "Favourite",
      title: "Favourite",
      "aria-pressed": favOn ? "true" : "false",
      onClick: (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        toggleFav("conf", conf.id);
        if (window.__RERENDER__) window.__RERENDER__();
      }
    },
    [favOn ? "★" : "☆"]
  );

  const cells = [
    el("div", { class: "cell cell--name" }, [nameLink, coreBadge, favBtn]),
    el("div", { class: "cell cell--deadline" }, [
      ...deadlineLines.map((line) => el("div", { class: `deadline ${deadlineMuted ? "muted" : ""}`, text: line }))
    ]),
    el("div", { class: "cell cell--tags" }, [tagChips])
  ];

  if (view === "known") {
    const { dLine, hmsLine } = formatCountdownDAndHMS(conf.deadlineEpochMs - Date.now());
    cells.push(
      el("div", { class: "cell cell--countdown" }, [
        el("div", { class: `countdown countdown--dhms2 ${deadlineMuted ? "muted" : ""}` }, [
          el("div", { class: "countdownValue countdownValue--d", text: dLine }),
          el("div", { class: "countdownValue countdownValue--hms", text: hmsLine })
        ])
      ])
    );
  }

  // Note is always last column (both known + tbd).
  cells.push(
    el("div", { class: "cell cell--note" }, [
      el("div", { class: "noteText", text: noteText || "—" })
    ])
  );

  const gradient = buildTagGradient(conf.tags);
  const attrs = { class: "row", "data-id": conf.id, "data-kind": conf.kind, "data-view": view };
  if (gradient) attrs.style = `--tag-gradient: ${gradient};`;
  return el("div", attrs, cells);
}

function attachExpandableNote(rowEl, noteText) {
  // Used for Note column (both known and TBD).
  const container = rowEl.querySelector(".cell--note");
  const noteEl = rowEl.querySelector(".cell--note .noteText");
  if (!container || !noteEl) return;

  const text = String(noteText || "").trim();
  if (!text || text === "—") return;

  // Heuristic: add toggle for long notes.
  const shouldToggle = text.length > 80 || text.includes("\n");
  if (!shouldToggle) return;

  const noteId = `note-${rowEl.getAttribute("data-id")}`;
  noteEl.id = noteId;
  noteEl.classList.add("noteText", "noteText--clamped");

  const btn = el(
    "button",
    {
      type: "button",
      class: "noteToggle",
      "aria-expanded": "false",
      "aria-controls": noteId,
      onClick: () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        noteEl.classList.toggle("noteText--clamped", expanded);
        btn.textContent = expanded ? "Show more" : "Show less";
      }
    },
    ["Show more"]
  );

  container.appendChild(btn);
}

function renderKnown(listEl, known, { hidePast, knownSort }) {
  const now = nowAoEMs();
  const upcoming = [];
  const past = [];

  for (const c of known) {
    if (!c.deadlineEpochMs) continue;
    // Compare in AoE time by shifting both to AoE reference.
    const deadlineAoEMs = c.deadlineEpochMs - 12 * 60 * 60 * 1000;
    if (deadlineAoEMs < now) past.push(c);
    else upcoming.push(c);
  }

  // Historical section: invert the deadline ordering so the "past" list reads naturally.
  // - deadlineAsc (upcoming: soonest first) -> past: most recently missed first
  // - deadlineDesc (upcoming: farthest first) -> past: oldest first
  if (knownSort === "deadlineAsc") {
    past.sort((a, b) => (b.deadlineEpochMs ?? 0) - (a.deadlineEpochMs ?? 0));
  } else if (knownSort === "deadlineDesc") {
    past.sort((a, b) => (a.deadlineEpochMs ?? 0) - (b.deadlineEpochMs ?? 0));
  }

  listEl.textContent = "";
  const upcomingTable = el("div", { class: "table" });

  for (const c of upcoming) {
    const parts = formatAoEParts(c.deadlineEpochMs);
    const row = confRow(c, { deadlineLines: [parts.date, parts.time], view: "known" });
    // Highlight if deadline is within the next 30 days (AoE-based).
    const deadlineAoEMs = c.deadlineEpochMs - 12 * 60 * 60 * 1000;
    const msLeftAoE = deadlineAoEMs - now;
    if (msLeftAoE >= 0 && msLeftAoE <= 30 * 24 * 60 * 60 * 1000) {
      row.setAttribute("data-deadline-state", "soon");
    }
    upcomingTable.appendChild(row);
    attachExpandableNote(row, String(c.note || ""));
  }

  listEl.appendChild(upcomingTable);

  if (past.length > 0) {
    const toggleBtn = el(
      "button",
      {
        type: "button",
        class: "pastToggle",
        "aria-expanded": hidePast ? "false" : "true",
        onClick: () => {
          window.__HIDE_PAST__ = !window.__HIDE_PAST__;
          saveHidePast(window.__HIDE_PAST__);
          if (window.__CONF_DATA__) {
            const vm = compileViewModel(window.__CONF_DATA__);
            renderKnown(listEl, vm.known, { hidePast: vm.hidePast, knownSort: vm.knownSort });
          }
        }
      },
      [hidePast ? "Show more" : "Show less"]
    );

    // Sticky divider must be a direct child of the scroll container for reliable sticky behavior.
    listEl.appendChild(
      el("div", { class: "divider divider--pastSticky" }, [
        el("span", { text: `Past deadlines (${past.length})` }),
        toggleBtn
      ])
    );

    if (!hidePast) {
      const pastTable = el("div", { class: "table" });
      for (const c of past) {
        const parts = formatAoEParts(c.deadlineEpochMs);
        const row = confRow(c, { deadlineLines: [parts.date, parts.time], deadlineMuted: true, view: "known" });
        pastTable.appendChild(row);
        attachExpandableNote(row, String(c.note || ""));
      }
      listEl.appendChild(pastTable);
    }
  }
}

function renderTbd(listEl, tbd) {
  listEl.textContent = "";
  const table = el("div", { class: "table" });

  for (const c of tbd) {
    const approx = c.submission?.date ? String(c.submission.date) : "TBD";
    const approxPretty = approx === "TBD" ? "TBD" : formatYmdToDmy(approx);
    const deadlineLines = ["TBD", `approx: ${approxPretty}`];
    const noteText = String(c.note || "—");
    const row = confRow(c, { deadlineLines, deadlineMuted: true, view: "tbd" });
    table.appendChild(row);
    attachExpandableNote(row, noteText);
  }

  listEl.appendChild(table);
}

async function loadConfig() {
  const res = await fetch("./conferences.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load conferences.json (${res.status})`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : Array.isArray(data?.conferences) ? data.conferences : [];
  return arr;
}

async function loadJournals() {
  const res = await fetch("./journals.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load journals.json (${res.status})`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : Array.isArray(data?.journals) ? data.journals : [];
  return arr;
}

function normalizeJournal(raw, idx) {
  return {
    id: raw?.id ? String(raw.id) : `${idx}-${String(raw?.name ?? "journal")}`,
    name: String(raw?.name ?? "").trim(),
    url: String(raw?.url ?? "").trim(),
    sjr: String(raw?.sjr ?? "").trim(),
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    note: raw?.note != null ? String(raw.note) : ""
  };
}

function sjrScore(sjr) {
  const s = String(sjr || "").toUpperCase().trim();
  if (s === "D1") return 6;
  if (s === "Q1") return 5;
  if (s === "Q2") return 4;
  if (s === "Q3") return 3;
  if (s === "Q4") return 2;
  if (s) return 1;
  return 0;
}

function sortJournals(items, mode) {
  const dir = mode.endsWith("Desc") ? -1 : 1;
  const key = mode.replace(/(Asc|Desc)$/, "");
  const byName = (a, b) => a.name.localeCompare(b.name);
  const bySjr = (a, b) => sjrScore(a.sjr) - sjrScore(b.sjr);
  const cmp = key === "name" ? byName : bySjr;
  return [...items].sort((a, b) => dir * cmp(a, b));
}

function setStatus(text) {
  const elStatus = document.getElementById("statusText");
  if (elStatus) elStatus.textContent = text;
}

function compileViewModel(all) {
  const selected = selectedTags();
  const matchAll = Boolean(document.getElementById("showOnlySelectedTags")?.checked);
  const hidePast = window.__HIDE_PAST__ ?? true;
  const q = String(window.__SEARCH_QUERY__ || "").trim();
  const priorityOnly = Boolean(document.getElementById("priorityOnly")?.checked);
  const knownSort = String(document.getElementById("sortKnown")?.value ?? "deadlineAsc");
  const tbdSort = String(document.getElementById("sortTbd")?.value ?? "approxAsc");

  // Tag filtering
  let filtered = all.filter(c => tagMatches(c, selected, matchAll));

  // Priority-only filtering (favourites)
  if (priorityOnly) {
    filtered = filtered.filter(c => isFav("conf", c.id));
  }

  // Name search (filter + mild ranking boost)
  if (q) {
    filtered = filtered
      .map((c) => ({ c, s: fuzzyScore(q, c.name) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }

  const known = filtered.filter(c => c.kind === "known" && c.deadlineEpochMs);
  const tbd = filtered.filter(c => c.kind === "tbd" || !c.deadlineEpochMs);

  const knownSorted = favFirst(sortKnown(known, knownSort), "conf");
  const tbdSorted = favFirst(sortTbd(tbd, tbdSort), "conf");

  return {
    hidePast,
    known: knownSorted,
    tbd: tbdSorted,
    knownSort,
    counts: { total: all.length, filtered: filtered.length, known: known.length, tbd: tbd.length }
  };
}

function compileJournalsViewModel(allJournals) {
  const selected = selectedTags();
  const matchAll = Boolean(document.getElementById("showOnlySelectedTags")?.checked);
  const q = String(window.__SEARCH_QUERY__ || "").trim();
  const priorityOnly = Boolean(document.getElementById("priorityOnly")?.checked);
  const sortMode = String(document.getElementById("sortJournals")?.value ?? "sjrDesc");

  let filtered = allJournals.filter(j => tagMatches(j, selected, matchAll));
  if (priorityOnly) {
    filtered = filtered.filter(j => isFav("journal", j.id));
  }
  if (q) {
    filtered = filtered
      .map((j) => ({ j, s: fuzzyScore(q, j.name) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.j);
  }

  const sorted = sortJournals(filtered, sortMode);
  const favBumped = favFirst(sorted, "journal");
  return { journals: favBumped, counts: { total: allJournals.length, filtered: filtered.length } };
}

function confRowJournals(j) {
  const sjrText = String(j.sjr || "—").trim() || "—";
  const sjrKeyRaw = sjrText.toUpperCase().replace(/\s+/g, "");
  const sjrKey = sjrKeyRaw || "unranked";
  const nameLink = j.url
    ? el("a", { href: j.url, target: "_blank", rel: "noopener noreferrer" }, [
        el("div", { class: "confName", text: j.name || "(Unnamed)" }),
        el("div", { class: "confMeta", text: j.url })
      ])
    : el("div", {}, [
        el("div", { class: "confName", text: j.name || "(Unnamed)" }),
        el("div", { class: "confMeta muted", text: "No URL provided" })
      ]);

  const badge = el("div", { class: `sjrBadge sjrBadge--${sjrKey}`, text: sjrText, title: `SJR: ${sjrText}` });
  const favOn = isFav("journal", j.id);
  const favBtn = el(
    "button",
    {
      type: "button",
      class: "favBtn",
      "aria-label": "Favourite",
      title: "Favourite",
      "aria-pressed": favOn ? "true" : "false",
      onClick: (e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        toggleFav("journal", j.id);
        if (window.__RERENDER__) window.__RERENDER__();
      }
    },
    [favOn ? "★" : "☆"]
  );
  const tagChips = el("div", { class: "tagList" }, (j.tags || []).map((t) => el("span", { class: "tagChip", text: tagDisplay(t), "data-tag": t })));
  const noteText = String(j.note || "").trim();

  const gradient = buildTagGradient(j.tags);
  const attrs = { class: "row", "data-view": "journals", "data-id": j.id };
  if (gradient) attrs.style = `--tag-gradient: ${gradient};`;

  return el("div", attrs, [
    el("div", { class: "cell cell--name" }, [nameLink, badge, favBtn]),
    el("div", { class: "cell cell--tags" }, [tagChips]),
    el("div", { class: "cell cell--note" }, [el("div", { class: "noteText", text: noteText || "—" })])
  ]);
}

function renderJournals(listEl, journals) {
  listEl.textContent = "";
  const table = el("div", { class: "table" });
  for (const j of journals) {
    const row = confRowJournals(j);
    table.appendChild(row);
    attachExpandableNote(row, String(j.note || ""));
  }
  listEl.appendChild(table);
}

function tickCountdowns(containerEl, confById) {
  // Recompute countdown + deadline state for visible known rows only.
  const rows = containerEl.querySelectorAll('.row[data-view="known"][data-id]');
  rows.forEach(r => {
    const id = r.getAttribute("data-id");
    const conf = confById.get(id);
    if (!conf || !conf.deadlineEpochMs) return;
    const { dLine, hmsLine } = formatCountdownDAndHMS(conf.deadlineEpochMs - Date.now());
    const dEl = r.querySelector(".cell--countdown .countdownValue--d");
    const hmsEl = r.querySelector(".cell--countdown .countdownValue--hms");
    if (dEl) dEl.textContent = dLine;
    if (hmsEl) hmsEl.textContent = hmsLine;
  });
}

async function main() {
  renderTagFilter();
  renderBuilderTags();

  const savedTheme = loadSavedTheme();
  applyTheme(savedTheme ?? systemTheme());

  window.__HIDE_PAST__ = loadHidePastDefault();
  window.__SEARCH_QUERY__ = loadSearchDefault();
  window.__VIEW__ = loadViewDefault();
  window.__FAVS__ = loadFavs();
  window.__PRIORITY_ONLY__ = loadPriorityOnlyDefault();

  const knownList = document.getElementById("knownList");
  const tbdList = document.getElementById("tbdList");
  const journalsView = document.getElementById("journalsView");
  const columnsView = document.querySelector(".columns");
  const journalsList = document.getElementById("journalsList");
  const btnConfs = document.getElementById("viewConfs");
  const btnJournals = document.getElementById("viewJournals");

  const rerender = () => {
    if (window.__VIEW__ === "journals") {
      if (!window.__JOURNAL_DATA__) return;
      const vm = compileJournalsViewModel(window.__JOURNAL_DATA__);
      renderJournals(journalsList, vm.journals);
      setStatus(`Journals: ${vm.counts.filtered}/${vm.counts.total}`);
      if (columnsView) columnsView.hidden = true;
      if (journalsView) journalsView.hidden = false;
      if (btnConfs) btnConfs.setAttribute("aria-selected", "false");
      if (btnJournals) btnJournals.setAttribute("aria-selected", "true");
      return;
    }

    if (!window.__CONF_DATA__) return;
    const vm = compileViewModel(window.__CONF_DATA__);
    renderKnown(knownList, vm.known, { hidePast: vm.hidePast, knownSort: vm.knownSort });
    renderTbd(tbdList, vm.tbd);
    setStatus(`Showing ${vm.counts.filtered}/${vm.counts.total} • Known: ${vm.counts.known} • TBD: ${vm.counts.tbd}`);
    window.__CONF_BY_ID__ = new Map(window.__CONF_DATA__.map(c => [c.id, c]));
    if (columnsView) columnsView.hidden = false;
    if (journalsView) journalsView.hidden = true;
    if (btnConfs) btnConfs.setAttribute("aria-selected", "true");
    if (btnJournals) btnJournals.setAttribute("aria-selected", "false");
  };
  window.__RERENDER__ = rerender;

  const bind = (sel, ev, fn) => {
    const node = document.querySelector(sel);
    if (node) node.addEventListener(ev, fn);
  };

  // Re-render on controls changes.
  for (const tag of TAGS) {
    bind(`input[data-tag="${tag}"]`, "change", rerender);
  }
  bind("#showOnlySelectedTags", "change", rerender);
  bind("#priorityOnly", "change", (e) => {
    const checked = Boolean(e?.target?.checked);
    window.__PRIORITY_ONLY__ = checked;
    savePriorityOnly(checked);
    rerender();
  });
  bind("#sortKnown", "change", rerender);
  bind("#sortTbd", "change", rerender);
  bind("#sortJournals", "change", rerender);

  // Search box (debounced)
  const searchEl = document.getElementById("searchBox");
  if (searchEl) {
    searchEl.value = window.__SEARCH_QUERY__ || "";
    let t = null;
    searchEl.addEventListener("input", () => {
      const next = String(searchEl.value || "");
      window.__SEARCH_QUERY__ = next;
      saveSearch(next);
      if (t) clearTimeout(t);
      t = setTimeout(rerender, 120);
    });
  }

  // Init priority-only checkbox state from storage.
  const prioEl = document.getElementById("priorityOnly");
  if (prioEl) prioEl.checked = Boolean(window.__PRIORITY_ONLY__);

  bindFilterToggle();
  bindBuilderModal();

  // Builder interactions
  const builderKind = document.getElementById("builderKind");
  const builderSub = document.getElementById("builderSubmissionType");
  if (builderKind) builderKind.addEventListener("change", () => { setBuilderVisibility(); builderGenerateItem(); });
  if (builderSub) builderSub.addEventListener("change", () => { setBuilderVisibility(); builderGenerateItem(); });
  for (const id of ["builderName", "builderUrl", "builderCore", "builderSjr", "builderNote", "builderIso", "builderAoe", "builderDate"]) {
    const n = document.getElementById(id);
    if (n) n.addEventListener("input", () => builderGenerateItem());
  }
  const pickerDate = document.getElementById("builderPickerDate");
  const pickerTime = document.getElementById("builderPickerTime");
  const pickerTz = document.getElementById("builderPickerTz");
  const usePicker = document.getElementById("builderUsePicker");
  if (usePicker) usePicker.addEventListener("click", () => { applyPickerToFields(); builderGenerateItem(); });
  if (pickerDate) pickerDate.addEventListener("input", () => { /* don't auto-overwrite; user clicks Use */ });
  if (pickerTime) pickerTime.addEventListener("input", () => { /* don't auto-overwrite; user clicks Use */ });
  if (pickerTz) pickerTz.addEventListener("change", () => { /* don't auto-overwrite; user clicks Use */ });
  const tagsRoot = document.getElementById("builderTags");
  if (tagsRoot) tagsRoot.addEventListener("change", () => builderGenerateItem());
  const genBtn = document.getElementById("builderGenerate");
  if (genBtn) genBtn.addEventListener("click", () => builderGenerateItem());
  const copyBtn = document.getElementById("builderCopy");
  if (copyBtn) copyBtn.addEventListener("click", () => builderCopyOut());
  setBuilderVisibility();
  builderGenerateItem();

  bind("#darkMode", "change", (e) => {
    const checked = Boolean(e?.target?.checked);
    const t = checked ? "dark" : "light";
    applyTheme(t);
    saveTheme(t);
  });

  bind("#viewConfs", "click", () => {
    window.__VIEW__ = "conferences";
    saveView("conferences");
    rerender();
  });
  bind("#viewJournals", "click", () => {
    window.__VIEW__ = "journals";
    saveView("journals");
    rerender();
  });

  // If user hasn't overridden theme, follow system changes live.
  if (!savedTheme && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(systemTheme());
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
    else if (typeof mq.addListener === "function") mq.addListener(handler);
  }

  setStatus("Loading conferences.json…");
  try {
    const raw = await loadConfig();
    window.__CONF_DATA__ = raw.map(normalizeConference);
  } catch (e) {
    setStatus(String(e?.message ?? e));
    return;
  }

  try {
    const rawJ = await loadJournals();
    window.__JOURNAL_DATA__ = rawJ.map(normalizeJournal);
  } catch (e) {
    // Journals optional; if missing, just don't show them.
    window.__JOURNAL_DATA__ = [];
  }

  rerender();

  // Live countdown refresh (only affects known list).
  setInterval(() => {
    if (!knownList || !window.__CONF_BY_ID__) return;
    tickCountdowns(knownList, window.__CONF_BY_ID__);
  }, 1000);
}

document.addEventListener("DOMContentLoaded", main);


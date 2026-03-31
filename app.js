// Minimal static app: loads ./conferences.json and renders two independently sortable/scrollable columns.
// Deadlines are interpreted in Anywhere-on-Earth (AoE), i.e., UTC-12.

const TAGS = ["LLMs", "Security", "Biometrics", "Speech", "Usability", "Blockchain"];

function tagToCssVar(tag) {
  switch (tag) {
    case "LLMs": return "var(--tag-llms)";
    case "Security": return "var(--tag-security)";
    case "Biometrics": return "var(--tag-biometrics)";
    case "Speech": return "var(--tag-speech)";
    case "Usability": return "var(--tag-usability)";
    case "Blockchain": return "var(--tag-blockchain)";
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
    const approx = String(submission.approx_disclosure_date ?? "").trim(); // YYYY-MM-DD
    const approxEpochMs = approx ? Date.parse(`${approx}T00:00:00Z`) : null;
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
    const label = el("label", { class: "tagPill", for: id }, [input, el("span", { text: tag })]);
    root.appendChild(label);
  }
}

function confRow(conf, { deadlineLines, countdownText = "", deadlineMuted = false, view }) {
  const primaryTag = (conf.tags || []).find(t => TAGS.includes(t)) || "";
  const tagChips = el(
    "div",
    { class: "tagList" },
    (conf.tags || []).map((t) => el("span", { class: "tagChip", text: t, "data-tag": t }))
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

  const cells = [
    el("div", { class: "cell cell--name" }, [nameLink, coreBadge]),
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
  const table = el("div", { class: "table" });

  for (const c of upcoming) {
    const parts = formatAoEParts(c.deadlineEpochMs);
    const row = confRow(c, { deadlineLines: [parts.date, parts.time], view: "known" });
    // Highlight if deadline is within the next 30 days (AoE-based).
    const deadlineAoEMs = c.deadlineEpochMs - 12 * 60 * 60 * 1000;
    const msLeftAoE = deadlineAoEMs - now;
    if (msLeftAoE >= 0 && msLeftAoE <= 30 * 24 * 60 * 60 * 1000) {
      row.setAttribute("data-deadline-state", "soon");
    }
    table.appendChild(row);
    attachExpandableNote(row, String(c.note || ""));
  }

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
          // Re-render using latest state
          if (window.__CONF_DATA__) {
            const vm = compileViewModel(window.__CONF_DATA__);
            renderKnown(listEl, vm.known, { hidePast: vm.hidePast });
          }
        }
      },
      [hidePast ? "Show more" : "Show less"]
    );

    table.appendChild(
      el("div", { class: "divider" }, [
        el("span", { text: `Past deadlines (${past.length})` }),
        toggleBtn
      ])
    );
  }

  if (!hidePast) {
    for (const c of past) {
      const parts = formatAoEParts(c.deadlineEpochMs);
      const row = confRow(c, { deadlineLines: [parts.date, parts.time], deadlineMuted: true, view: "known" });
      // Past deadlines are not "soon" highlighted.
      table.appendChild(row);
      attachExpandableNote(row, String(c.note || ""));
    }
  }

  listEl.appendChild(table);
}

function renderTbd(listEl, tbd) {
  listEl.textContent = "";
  const table = el("div", { class: "table" });

  for (const c of tbd) {
    const approx = c.submission?.approx_disclosure_date ? String(c.submission.approx_disclosure_date) : "TBD";
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

function setStatus(text) {
  const elStatus = document.getElementById("statusText");
  if (elStatus) elStatus.textContent = text;
}

function compileViewModel(all) {
  const selected = selectedTags();
  const matchAll = Boolean(document.getElementById("showOnlySelectedTags")?.checked);
  const hidePast = window.__HIDE_PAST__ ?? true;
  const knownSort = String(document.getElementById("sortKnown")?.value ?? "deadlineAsc");
  const tbdSort = String(document.getElementById("sortTbd")?.value ?? "approxAsc");

  const filtered = all.filter(c => tagMatches(c, selected, matchAll));

  const known = filtered.filter(c => c.kind === "known" && c.deadlineEpochMs);
  const tbd = filtered.filter(c => c.kind === "tbd" || !c.deadlineEpochMs);

  return {
    hidePast,
    known: sortKnown(known, knownSort),
    tbd: sortTbd(tbd, tbdSort),
    knownSort,
    counts: { total: all.length, filtered: filtered.length, known: known.length, tbd: tbd.length }
  };
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

  const savedTheme = loadSavedTheme();
  applyTheme(savedTheme ?? systemTheme());

  window.__HIDE_PAST__ = loadHidePastDefault();

  const knownList = document.getElementById("knownList");
  const tbdList = document.getElementById("tbdList");

  const rerender = () => {
    if (!window.__CONF_DATA__) return;
    const vm = compileViewModel(window.__CONF_DATA__);
    renderKnown(knownList, vm.known, { hidePast: vm.hidePast, knownSort: vm.knownSort });
    renderTbd(tbdList, vm.tbd);
    setStatus(`Showing ${vm.counts.filtered}/${vm.counts.total} • Known: ${vm.counts.known} • TBD: ${vm.counts.tbd}`);
    window.__CONF_BY_ID__ = new Map(window.__CONF_DATA__.map(c => [c.id, c]));
  };

  const bind = (sel, ev, fn) => {
    const node = document.querySelector(sel);
    if (node) node.addEventListener(ev, fn);
  };

  // Re-render on controls changes.
  for (const tag of TAGS) {
    bind(`input[data-tag="${tag}"]`, "change", rerender);
  }
  bind("#showOnlySelectedTags", "change", rerender);
  bind("#sortKnown", "change", rerender);
  bind("#sortTbd", "change", rerender);
  bind("#darkMode", "change", (e) => {
    const checked = Boolean(e?.target?.checked);
    const t = checked ? "dark" : "light";
    applyTheme(t);
    saveTheme(t);
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
    rerender();
  } catch (e) {
    setStatus(String(e?.message ?? e));
    return;
  }

  // Live countdown refresh (only affects known list).
  setInterval(() => {
    if (!knownList || !window.__CONF_BY_ID__) return;
    tickCountdowns(knownList, window.__CONF_BY_ID__);
  }, 1000);
}

document.addEventListener("DOMContentLoaded", main);


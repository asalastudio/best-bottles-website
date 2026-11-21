#!/usr/bin/env node
/**
 * Turns the Best Bottles Cutover Requests form's saved answers into a record in the repo.
 *
 * The form (https://claude.ai/artifact/ScK99Dz3LU5RVgkwQpy61u) saves each answer to its own
 * database, collection "answers", one document per request code (S-2, QB-5, ...), shaped
 * { v, note, by, at }. Only Claude's ArtifactData tool can read that database, so a sync is
 * two steps (see .claude/skills/bestbottles-cutover-requests/SKILL.md):
 *
 *   1. ArtifactData list, collection "answers", with out_dir <dir>  -> <dir>/answers/<code>.json
 *   2. node scripts/cutover_answers_report.mjs --export <dir> [--names names.json]
 *
 * Writes docs/cutover-requests/answers.json (for scripts) and docs/cutover-requests/ANSWERS.md
 * (for people). The request list, titles, owners and options are read from the form's own
 * source, docs/cutover-requests/cutover-requests.html, so the two can never disagree.
 *
 * Long digit runs (9 or more, allowing spaces or dashes) are replaced before anything is
 * written, because the form asks people not to type account, card or permit numbers and
 * some will anyway. ZIP+4 codes are kept.
 *
 * Usage:
 *   node scripts/cutover_answers_report.mjs --export <dir>   # dir from ArtifactData out_dir
 *   node scripts/cutover_answers_report.mjs --empty          # baseline with nothing answered
 *   Options: --names <file.json>  map of person id -> display name (ArtifactData "profiles")
 *            --form <file>        form source (default docs/cutover-requests/cutover-requests.html)
 *            --out <dir>          output folder (default docs/cutover-requests)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FORM_URL = "https://claude.ai/artifact/ScK99Dz3LU5RVgkwQpy61u";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const formPath = resolve(REPO, arg("form", "docs/cutover-requests/cutover-requests.html"));
const outDir = resolve(REPO, arg("out", "docs/cutover-requests"));
const exportArg = arg("export");
const empty = arg("empty") === true;
const namesPath = arg("names");

if (!empty && (!exportArg || exportArg === true)) {
  console.error("Pass --export <dir> (an ArtifactData out_dir) or --empty for a blank baseline.");
  process.exit(2);
}

// ---------- the form's own request list ----------
function extract(source, marker, closer) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Form source has no "${marker}". Was the form restructured?`);
  const from = start + marker.length;
  const end = source.indexOf(closer, from);
  if (end === -1) throw new Error(`Form source: no end for "${marker}".`);
  return source.slice(from, end + closer.length).replace(/;\s*$/, "");
}
const formSource = readFileSync(formPath, "utf8");
const evalLiteral = (text) => vm.runInNewContext(`(${text})`, {}, { timeout: 1000 });
const OWNERS = evalLiteral(extract(formSource, "const OWNERS = ", "};"));
const SECTIONS = evalLiteral(extract(formSource, "const SECTIONS = ", "\n  ];"));
const ITEMS = evalLiteral(extract(formSource, "const ITEMS = ", "\n  ];"));
const itemById = new Map(ITEMS.map((it) => [it.id, it]));
if (ITEMS.length < 1 || itemById.size !== ITEMS.length) throw new Error("Form source: request codes are missing or repeated.");

// ---------- saved answers ----------
function readExport(dir) {
  let base = resolve(process.cwd(), dir);
  if (existsSync(join(base, "answers")) && statSync(join(base, "answers")).isDirectory()) base = join(base, "answers");
  const docs = new Map();
  for (const file of readdirSync(base).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(base, file), "utf8"));
    // Accept the bare document or a wrapper that nests it under data/fields/doc.
    const doc = raw && typeof raw === "object" && ("v" in raw || "note" in raw) ? raw
      : raw?.data ?? raw?.fields ?? raw?.doc ?? raw;
    const id = raw?.id ?? raw?.doc_id ?? raw?._id ?? file.replace(/\.json$/, "");
    docs.set(String(id), doc || {});
  }
  return docs;
}
const docs = empty ? new Map() : readExport(exportArg);
const names = namesPath ? JSON.parse(readFileSync(resolve(process.cwd(), namesPath), "utf8")) : {};

// ---------- redaction ----------
let redactions = 0;
const LONG_NUMBER = /\d(?:[ \-]?\d){8,}/g;
const ZIP4 = /^\d{5}-\d{4}$/;
function redact(text) {
  return String(text).replace(LONG_NUMBER, (m) => {
    if (ZIP4.test(m)) return m;
    redactions++;
    return "[number removed]";
  });
}
function redactValue(v) {
  if (Array.isArray(v)) return v.map((x) => redact(x));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x ?? "")]));
  return v == null ? "" : redact(v);
}

// Same rule the form uses to count a request as answered.
function isAnswered(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.values(v).some((x) => String(x || "").trim());
  return !!String(v || "").trim();
}

// ---------- build the record ----------
const requests = ITEMS.map((it) => {
  const doc = docs.get(it.id);
  const value = doc ? redactValue(doc.v) : (it.type === "multi" ? [] : it.type === "fields" ? {} : "");
  const note = doc ? redact(doc.note || "") : "";
  const answered = isAnswered(value);
  const by = doc?.by || null;
  const unknownOptions = (it.type === "choice" || it.type === "multi") && answered
    ? [].concat(value).filter((x) => !it.opts.includes(x)) : [];
  return {
    id: it.id,
    section: SECTIONS.find((s) => s.id === it.sec)?.title ?? it.sec,
    title: it.title,
    owners: it.owners.map((o) => OWNERS[o] ?? o),
    neededForLaunch: !!it.launch,
    type: it.type,
    answered,
    answer: value,
    note,
    answeredBy: by ? (names[by]?.name ?? names[by] ?? by) : null,
    answeredAt: doc?.at ? new Date(doc.at).toISOString() : null,
    ...(unknownOptions.length ? { unknownOptions } : {}),
  };
});
const ignored = [...docs.keys()].filter((id) => !itemById.has(id)).sort();
const launch = requests.filter((r) => r.neededForLaunch);
const totals = {
  requests: requests.length,
  answered: requests.filter((r) => r.answered).length,
  neededForLaunch: launch.length,
  neededForLaunchAnswered: launch.filter((r) => r.answered).length,
  withNoteOnly: requests.filter((r) => !r.answered && r.note.trim()).length,
};
const lastAnswerAt = requests.map((r) => r.answeredAt).filter(Boolean).sort().at(-1) ?? null;

const record = {
  form: FORM_URL,
  formSource: "docs/cutover-requests/cutover-requests.html",
  syncedAt: new Date().toISOString(),
  lastAnswerAt,
  totals,
  redactedNumbers: redactions,
  ignoredDocuments: ignored,
  requests,
};

// ---------- readable version ----------
function answerLines(r) {
  const it = itemById.get(r.id);
  const out = [];
  if (it.type === "fields") {
    for (const f of it.fields) {
      const x = String(r.answer?.[f.k] ?? "").trim();
      if (x) out.push(`- ${f.label}: ${x}`);
    }
  } else if (Array.isArray(r.answer) && r.answer.length) out.push(`- Answer: ${r.answer.join("; ")}`);
  else if (String(r.answer || "").trim()) out.push(`- Answer: ${String(r.answer).trim()}`);
  if (r.note.trim()) out.push(`- Note: ${r.note.trim()}`);
  if (r.unknownOptions) out.push(`- Check: ${r.unknownOptions.join("; ")} is not one of the form's current options.`);
  if (out.length && (r.answeredBy || r.answeredAt)) {
    out.push(`- Saved${r.answeredBy ? ` by ${r.answeredBy}` : ""}${r.answeredAt ? ` on ${r.answeredAt.slice(0, 16).replace("T", " ")} UTC` : ""}`);
  }
  return out.length ? out : ["- Not answered yet"];
}

const md = [
  "# Best Bottles cutover requests: answers",
  "",
  `Generated from the [cutover requests form](${FORM_URL}) by \`scripts/cutover_answers_report.mjs\`. Do not edit by hand; run a sync instead (see README.md).`,
  "",
  empty
    ? `Empty baseline written ${record.syncedAt.slice(0, 16).replace("T", " ")} UTC. No answers have been synced from the form yet.`
    : `Synced ${record.syncedAt.slice(0, 16).replace("T", " ")} UTC.${lastAnswerAt ? ` Latest answer ${lastAnswerAt.slice(0, 16).replace("T", " ")} UTC.` : ""}`,
  "",
  "| | Answered |",
  "|---|---|",
  `| All requests | ${totals.answered} of ${totals.requests} |`,
  `| Needed for launch | ${totals.neededForLaunchAnswered} of ${totals.neededForLaunch} |`,
  "",
];
if (redactions) md.push(`${redactions} long number${redactions === 1 ? " was" : "s were"} removed from the answers before writing this file.`, "");
if (ignored.length) md.push(`Documents in the form's database that match no request code, so are not shown: ${ignored.join(", ")}.`, "");
for (const s of SECTIONS) {
  const rows = requests.filter((r) => itemById.get(r.id).sec === s.id);
  md.push(`## ${s.title}`, "", `${rows.filter((r) => r.answered).length} of ${rows.length} answered.`, "");
  for (const r of rows) {
    md.push(`### ${r.id} ${r.title}`, "", `${r.neededForLaunch ? "Needed for launch · " : ""}${r.owners.join(", ")}`, "", ...answerLines(r), "");
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "answers.json"), JSON.stringify(record, null, 2) + "\n");
writeFileSync(join(outDir, "ANSWERS.md"), md.join("\n").replace(/\n{3,}/g, "\n\n"));
console.log(`answered ${totals.answered} of ${totals.requests} (needed for launch: ${totals.neededForLaunchAnswered} of ${totals.neededForLaunch})`);
if (ignored.length) console.log(`ignored documents: ${ignored.join(", ")}`);
if (redactions) console.log(`numbers removed: ${redactions}`);
console.log(`wrote ${join(outDir, "answers.json")} and ANSWERS.md`);

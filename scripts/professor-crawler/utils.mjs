import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { OFFICIAL_HOST_SUFFIXES } from "./constants.mjs";

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);?/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

export function htmlToText(value = "") {
  return normalizeSpace(
    decodeHtmlEntities(
      String(value)
        .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
        .replace(/<\/(?:div|li|p|td|th|tr|h[1-6])>/gi, "\n")
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

export function normalizeSpace(value = "") {
  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeNullable(value) {
  const normalized = normalizeSpace(value ?? "");
  return normalized && normalized !== "-" ? normalized : null;
}

export function normalizeUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const url = new URL(decodeHtmlEntities(value), baseUrl);
    url.hash = "";
    if (url.protocol === "http:" && isOfficialUniversityUrl(url)) {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isOfficialUniversityUrl(value) {
  try {
    const hostname = (value instanceof URL ? value : new URL(value)).hostname.toLowerCase();
    return OFFICIAL_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function assertOfficialUniversityUrl(value, label = "URL") {
  if (!isOfficialUniversityUrl(value)) {
    throw new Error(`${label} is not on an approved university domain: ${value}`);
  }
}

export function extractScriptJson(html, idSuffix) {
  const suffix = escapeRegExp(idSuffix);
  const expression = new RegExp(
    `<script\\b[^>]*\\bid=["'][^"']*${suffix}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "gi",
  );
  const values = [];
  for (const match of String(html).matchAll(expression)) {
    try {
      const source = match[1].trim();
      try {
        values.push(JSON.parse(source));
      } catch {
        values.push(JSON.parse(decodeHtmlEntities(source)));
      }
    } catch (error) {
      values.push({ __parse_error: error.message, __raw_length: match[1].length });
    }
  }
  return values;
}

export function extractAnchors(html, baseUrl) {
  const anchors = [];
  for (const match of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = parseHtmlAttributes(match[1]);
    const href = normalizeUrl(attributes.href, baseUrl);
    if (!href) continue;
    anchors.push({
      href,
      text: htmlToText(match[2]),
      title: normalizeSpace(attributes.title ?? ""),
      className: normalizeSpace(attributes.class ?? ""),
    });
  }
  return anchors;
}

export function parseHtmlAttributes(value = "") {
  const attributes = {};
  const expression = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of String(value).matchAll(expression)) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

export function extractElementById(html, id) {
  const opening = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`, "i");
  const match = opening.exec(String(html));
  if (!match) return null;
  return extractBalancedElement(String(html), match.index, match[1]);
}

export function extractElementsByClass(html, className, tagName = "[a-z][\\w:-]*") {
  const expression = new RegExp(`<(${tagName})\\b([^>]*)>`, "gi");
  const elements = [];
  for (const match of String(html).matchAll(expression)) {
    const attributes = parseHtmlAttributes(match[2]);
    if (!normalizeSpace(attributes.class ?? "").split(" ").includes(className)) continue;
    const element = extractBalancedElement(String(html), match.index, match[1]);
    if (element) elements.push(element);
  }
  return elements;
}

export function extractBalancedElement(html, startIndex, tagName) {
  const tokenExpression = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi");
  tokenExpression.lastIndex = startIndex;
  let depth = 0;
  let first = true;
  for (let token = tokenExpression.exec(html); token; token = tokenExpression.exec(html)) {
    if (first && token.index !== startIndex) return null;
    first = false;
    const closing = /^<\//.test(token[0]);
    const selfClosing = /\/>$/.test(token[0]);
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;
    if (depth === 0) {
      return html.slice(startIndex, tokenExpression.lastIndex);
    }
  }
  return null;
}

export function extractTableRows(html) {
  const rows = [];
  for (const rowMatch of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [
      ...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi),
    ].map((cell) => htmlToText(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

export function sanitizeForPersistentCache(body = "") {
  const html = String(body);
  const fragments = [];

  for (const value of extractScriptJson(html, "_deptData")) {
    if (!value || value.__parse_error || Array.isArray(value)) continue;
    fragments.push(
      safeJsonScript("_safe_deptData", {
        orgId: normalizeSpace(value.orgId ?? ""),
        orgzNm: normalizeSpace(value.orgzNm ?? ""),
        orgzPrtNm: normalizeSpace(value.orgzPrtNm ?? ""),
        hpUrl: normalizeSpace(value.hpUrl ?? ""),
      }),
    );
  }

  for (const value of extractScriptJson(html, "_professorsData")) {
    if (!Array.isArray(value)) continue;
    const professors = value
      .map((row) => ({
        nm: normalizeSpace(row.nm ?? ""),
        wkgrKnm: normalizeSpace(row.wkgrKnm ?? ""),
        repnPosn: normalizeSpace(row.repnPosn ?? ""),
        orgzNm: normalizeSpace(row.orgzNm ?? ""),
        detailUrl: normalizeSpace(row.detailUrl ?? ""),
      }))
      .filter((row) => row.nm);
    fragments.push(safeJsonScript("_safe_professorsData", professors));
  }

  for (const id of ["profResult_area2", "profResult_area3"]) {
    const element = extractElementById(html, id);
    if (element) fragments.push(sanitizeAcademicFragment(element));
  }

  for (const element of extractElementsByClass(html, "profinfo", "div")) {
    fragments.push(redactSafeFragment(element));
  }

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = parseHtmlAttributes(match[1]);
    const href = sanitizeCachedHref(attributes.href ?? "");
    if (!href || /^(?:mailto|tel|javascript|data):/i.test(href)) continue;
    const text = redactPlainText(htmlToText(match[2]));
    const title = redactPlainText(attributes.title ?? "");
    fragments.push(
      `<a href="${escapeHtmlAttribute(href)}"${
        title ? ` title="${escapeHtmlAttribute(title)}"` : ""
      }>${escapeHtmlText(text)}</a>`,
    );
  }

  const title = htmlToText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  return `<!doctype html><html><head><title>${escapeHtmlText(
    title,
  )}</title></head><body>${fragments.join("\n")}</body></html>`;
}

export function splitResearchFields(value, { splitCommas = true } = {}) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text || text === "-") return [];
  const separator = splitCommas ? /\s*(?:,|;|·|\||\/|\n)\s*/ : /\s*(?:;|·|\||\n)\s*/;
  return [
    ...new Set(
      text
        .split(separator)
        .map(normalizeSpace)
        .filter((item) => !/^\d+(?:-\d+)?$/.test(item))
        .filter((item) => item.length > 1),
    ),
  ];
}

export function safeIsoDate(value = new Date()) {
  return new Date(value).toISOString();
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await rename(temporaryPath, filePath);
        break;
      } catch (error) {
        if (!["EBUSY", "EPERM"].includes(error.code) || attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      }
    }
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export function stableSortBy(values, selector) {
  return [...values].sort((left, right) =>
    String(selector(left)).localeCompare(String(selector(right)), "ko"),
  );
}

export function uniqueBy(values, selector) {
  const seen = new Set();
  return values.filter((value) => {
    const key = selector(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeJsonScript(id, value) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return `<script id="${id}" type="application/json">${json}</script>`;
}

function redactSafeFragment(value) {
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<a\b[^>]*href\s*=\s*["']mailto:[\s\S]*?<\/a>/gi, "")
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(
      /(?<!\d)(?:\+?82[-\s]?)?(?:2|0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]))[-\s)]?\d{3,4}[-\s]?\d{4}(?!\d)/g,
      "[redacted-phone]",
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]");
}

function sanitizeAcademicFragment(value) {
  return String(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<a\b[^>]*href\s*=\s*["'](?:mailto|tel):[\s\S]*?<\/a>/gi, "")
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    )
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]");
}

function redactPlainText(value) {
  return htmlToText(
    redactSafeFragment(
      String(value)
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"),
    ),
  );
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeHtmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeCachedHref(value) {
  const href = redactSafeFragment(normalizeSpace(value));
  if (!href || /^(?:mailto|tel|javascript|data):/i.test(href)) return "";
  try {
    const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(href);
    const url = new URL(href, "https://cache.invalid");
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:auth|token|session|email|mail|phone|tel|fax|signature|secret)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    for (const [key, item] of [...url.searchParams.entries()]) {
      url.searchParams.set(key, redactPlainText(item));
    }
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

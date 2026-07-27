import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_USER_AGENT } from "./constants.mjs";
import { RobotsPolicy } from "./robots.mjs";
import {
  assertOfficialUniversityUrl,
  sanitizeForPersistentCache,
  sha256,
  writeJsonAtomic,
} from "./utils.mjs";

const CACHE_FORMAT_VERSION = 3;

export class HttpClient {
  constructor({
    cacheDirectory,
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 15_000,
    retries = 2,
    minDelayMs = 1_200,
    offline = false,
    robotsFailureMode = "block",
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (!cacheDirectory) throw new Error("cacheDirectory is required");
    this.cacheDirectory = cacheDirectory;
    this.userAgent = userAgent;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.minDelayMs = minDelayMs;
    this.offline = offline;
    this.fetchImpl = fetchImpl;
    this.lastRequestAt = new Map();
    this.memoryCache = new Map();
    this.robots = new RobotsPolicy({
      userAgent,
      timeoutMs: Math.min(timeoutMs, 10_000),
      failureMode: robotsFailureMode,
      fetchImpl,
    });
  }

  async checkRobots(url) {
    assertOfficialUniversityUrl(url);
    return this.robots.evaluate(url);
  }

  async fetchText(url, { purpose = "official-page", useCache = true } = {}) {
    assertOfficialUniversityUrl(url);
    const normalizedUrl = new URL(url).toString();
    if (this.memoryCache.has(normalizedUrl)) return this.memoryCache.get(normalizedUrl);

    const cachePath = path.join(
      this.cacheDirectory,
      `${sha256(`${CACHE_FORMAT_VERSION}|${normalizedUrl}`)}.json`,
    );
    if (useCache) {
      const cached = await readCache(cachePath);
      if (cached) {
        if (!this.offline) {
          await this.robots.assertAllowed(normalizedUrl);
          if (cached.url && cached.url !== normalizedUrl) {
            await this.robots.assertAllowed(cached.url);
          }
        }
        const result = { ...cached, cache: "persistent" };
        this.memoryCache.set(normalizedUrl, result);
        return result;
      }
    }
    if (this.offline) throw new Error(`OFFLINE_CACHE_MISS: ${normalizedUrl}`);

    const result = await this.#fetchWithRedirects(normalizedUrl, purpose);
    const sanitizedBody = sanitizeForPersistentCache(result.body);
    const persisted = {
      cache_format_version: CACHE_FORMAT_VERSION,
      url: result.url,
      requested_url: normalizedUrl,
      purpose,
      status: result.status,
      content_type: result.content_type,
      body: sanitizedBody,
      content_hash: sha256(sanitizedBody),
      fetched_at: result.fetched_at,
    };
    if (useCache) {
      await mkdir(this.cacheDirectory, { recursive: true });
      await writeJsonAtomic(cachePath, persisted);
    }
    const liveResult = {
      ...persisted,
      body: result.body,
      content_hash: sha256(sanitizedBody),
      cache: "network",
    };
    this.memoryCache.set(normalizedUrl, liveResult);
    return liveResult;
  }

  async #fetchWithRedirects(initialUrl, purpose) {
    let currentUrl = initialUrl;
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      assertOfficialUniversityUrl(currentUrl, `${purpose} URL`);
      const robots = await this.robots.assertAllowed(currentUrl);
      await this.#respectDelay(currentUrl, robots.crawl_delay_ms);
      const response = await this.#requestWithRetry(currentUrl);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`HTTP ${response.status} redirect omitted Location: ${currentUrl}`);
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) throw new HttpError(currentUrl, response.status);
      const body = await response.text();
      return {
        url: response.url || currentUrl,
        status: response.status,
        content_type: response.headers.get("content-type") ?? "unknown",
        body,
        fetched_at: new Date().toISOString(),
      };
    }
    throw new Error(`Too many redirects: ${initialUrl}`);
  }

  async #requestWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.1",
            "accept-language": "ko-KR,ko;q=0.9,en;q=0.6",
            "user-agent": this.userAgent,
          },
          redirect: "manual",
          signal: controller.signal,
        });
        if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
          const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
          await wait(retryAfter ?? 500 * 2 ** attempt);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= this.retries) break;
        await wait(500 * 2 ** attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (lastError?.name === "AbortError") throw new Error(`REQUEST_TIMEOUT: ${url}`);
    throw lastError ?? new Error(`Request failed: ${url}`);
  }

  async #respectDelay(url, crawlDelayMs) {
    const origin = new URL(url).origin;
    const delayMs = Math.max(this.minDelayMs, crawlDelayMs ?? 0);
    const previous = this.lastRequestAt.get(origin) ?? 0;
    const remaining = previous + delayMs - Date.now();
    if (remaining > 0) await wait(remaining);
    this.lastRequestAt.set(origin, Date.now());
  }
}

export class HttpError extends Error {
  constructor(url, status) {
    super(`HTTP_${status}: ${url}`);
    this.name = "HttpError";
    this.url = url;
    this.status = status;
  }
}

async function readCache(filePath) {
  try {
    const cached = JSON.parse(await readFile(filePath, "utf8"));
    return cached.cache_format_version === CACHE_FORMAT_VERSION ? cached : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

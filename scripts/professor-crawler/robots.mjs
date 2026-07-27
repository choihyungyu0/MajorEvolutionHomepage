import { DEFAULT_USER_AGENT, STATUS } from "./constants.mjs";
import { normalizeSpace } from "./utils.mjs";

export class RobotsBlockedError extends Error {
  constructor(url, reason, robotsUrl) {
    super(reason || `robots.txt blocks ${url}`);
    this.name = "RobotsBlockedError";
    this.code = STATUS.ROBOTS_BLOCKED;
    this.url = url;
    this.robotsUrl = robotsUrl;
  }
}

export class RobotsPolicy {
  constructor({
    userAgent = DEFAULT_USER_AGENT,
    timeoutMs = 10_000,
    failureMode = "block",
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.userAgent = userAgent;
    this.productToken = userAgent.split(/[\/\s]/, 1)[0].toLowerCase();
    this.timeoutMs = timeoutMs;
    this.failureMode = failureMode;
    this.fetchImpl = fetchImpl;
    this.cache = new Map();
    this.audit = [];
  }

  async evaluate(url) {
    const target = new URL(url);
    const origin = target.origin;
    let policy = this.cache.get(origin);
    if (!policy) {
      policy = await this.#load(origin);
      this.cache.set(origin, policy);
    }
    const decision = evaluateRules(policy.groups, this.productToken, target);
    const result = {
      url: target.toString(),
      robots_url: policy.robotsUrl,
      robots_status: policy.status,
      allowed: policy.forceBlocked ? false : decision.allowed,
      matched_rule: policy.forceBlocked ? "ROBOTS_UNAVAILABLE_STRICT_MODE" : decision.matchedRule,
      crawl_delay_ms: decision.crawlDelayMs,
      checked_at: new Date().toISOString(),
    };
    this.audit.push(result);
    return result;
  }

  async assertAllowed(url) {
    const result = await this.evaluate(url);
    if (!result.allowed) {
      throw new RobotsBlockedError(
        url,
        `ROBOTS_BLOCKED: ${result.matched_rule || "disallow rule"} (${result.robots_url})`,
        result.robots_url,
      );
    }
    return result;
  }

  async #load(origin) {
    const robotsUrl = new URL("/robots.txt", origin).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(robotsUrl, {
        headers: {
          accept: "text/plain,*/*;q=0.1",
          "user-agent": this.userAgent,
        },
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status === 404 || response.status === 410) {
        return { robotsUrl, status: response.status, groups: [], forceBlocked: false };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`robots.txt redirect omitted Location (${response.status})`);
        const redirected = new URL(location, robotsUrl);
        if (redirected.origin !== new URL(origin).origin) {
          throw new Error(`robots.txt redirected across origins: ${redirected}`);
        }
        const redirectedResponse = await this.fetchImpl(redirected, {
          headers: { "user-agent": this.userAgent },
          redirect: "error",
          signal: controller.signal,
        });
        if (!redirectedResponse.ok) {
          throw new Error(`robots.txt redirect returned HTTP ${redirectedResponse.status}`);
        }
        return {
          robotsUrl: redirected.toString(),
          status: redirectedResponse.status,
          groups: parseRobots(await redirectedResponse.text()),
          forceBlocked: false,
        };
      }
      if (!response.ok) throw new Error(`robots.txt returned HTTP ${response.status}`);
      return {
        robotsUrl,
        status: response.status,
        groups: parseRobots(await response.text()),
        forceBlocked: false,
      };
    } catch (error) {
      if (this.failureMode === "allow") {
        return {
          robotsUrl,
          status: "UNAVAILABLE_ALLOWED_BY_CONFIGURATION",
          groups: [],
          forceBlocked: false,
          error: error.message,
        };
      }
      return {
        robotsUrl,
        status: "UNAVAILABLE_BLOCKED_BY_STRICT_MODE",
        groups: [],
        forceBlocked: true,
        error: error.name === "AbortError" ? "robots.txt request timed out" : error.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseRobots(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  let crawlDelayMs = null;

  const flush = () => {
    if (agents.length) {
      groups.push({
        agents: [...new Set(agents.map((agent) => agent.toLowerCase()))],
        rules: [...rules],
        crawlDelayMs,
      });
    }
    agents = [];
    rules = [];
    crawlDelayMs = null;
  };

  for (const rawLine of String(text).replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = normalizeSpace(line.slice(separator + 1));
    if (directive === "user-agent") {
      if (rules.length || crawlDelayMs !== null) flush();
      agents.push(value);
      continue;
    }
    if (!agents.length) continue;
    if (directive === "allow" || directive === "disallow") {
      if (!value && directive === "disallow") continue;
      rules.push({ type: directive, path: value });
    } else if (directive === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) crawlDelayMs = seconds * 1_000;
    }
  }
  flush();
  return groups;
}

export function evaluateRules(groups, productToken, url) {
  const candidates = groups
    .map((group) => ({
      group,
      specificity: Math.max(
        -1,
        ...group.agents.map((agent) =>
          agent === "*" ? 0 : productToken.startsWith(agent.toLowerCase()) ? agent.length : -1,
        ),
      ),
    }))
    .filter((candidate) => candidate.specificity >= 0);
  if (!candidates.length) {
    return { allowed: true, matchedRule: null, crawlDelayMs: null };
  }
  const maximumSpecificity = Math.max(...candidates.map((candidate) => candidate.specificity));
  const selected = candidates.filter(
    (candidate) => candidate.specificity === maximumSpecificity,
  );
  const pathWithQuery = `${url.pathname}${url.search}`;
  const matchingRules = selected
    .flatMap((candidate) => candidate.group.rules)
    .filter((rule) => robotsPatternMatches(rule.path, pathWithQuery))
    .sort((left, right) => {
      const lengthDifference = ruleSpecificity(right.path) - ruleSpecificity(left.path);
      if (lengthDifference) return lengthDifference;
      if (left.type === right.type) return 0;
      return left.type === "allow" ? -1 : 1;
    });
  const matched = matchingRules[0] ?? null;
  const delays = selected
    .map((candidate) => candidate.group.crawlDelayMs)
    .filter((value) => Number.isFinite(value));
  return {
    allowed: !matched || matched.type === "allow",
    matchedRule: matched ? `${matched.type.toUpperCase()}: ${matched.path}` : null,
    crawlDelayMs: delays.length ? Math.max(...delays) : null,
  };
}

function robotsPatternMatches(pattern, pathWithQuery) {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}${anchored ? "$" : ""}`).test(pathWithQuery);
}

function ruleSpecificity(pattern) {
  return pattern.replace(/[*$]/g, "").length;
}

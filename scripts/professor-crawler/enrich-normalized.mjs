#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportNormalizedDatabase,
  normalizeProfessorDataset,
} from "./export-database.mjs";
import { queryCrossrefMetadata, queryKci } from "./metadata.mjs";
import { writeJsonAtomic } from "./utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const professorDataRoot = path.join(repositoryRoot, "data", "professors");

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [datasetArg, manifestArg, outputArg, ...optionArgs] = process.argv.slice(2);
  if (!datasetArg || !manifestArg || !outputArg) {
    console.error(
      "Usage: node scripts/professor-crawler/enrich-normalized.mjs <dataset.json> <manifest.json> <output-directory> [--per-professor 3] [--max 50] [--delay-ms 500] [--crossref]",
    );
    process.exitCode = 1;
  } else {
    try {
      const options = parseOptions(optionArgs);
      const result = await enrichNormalizedDataset({
        datasetPath: resolveRepositoryPath(datasetArg),
        manifestPath: resolveRepositoryPath(manifestArg),
        outputDirectory: resolveProfessorDataPath(outputArg),
        perProfessor: positiveInteger(options["per-professor"], 3),
        maxPublications: positiveInteger(options.max, 50),
        delayMs: nonNegativeInteger(options["delay-ms"], 500),
        crossref: Boolean(options.crossref),
        kciApiKey: process.env.KCI_API_KEY ?? null,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`[professor-metadata] ${error.stack || error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function enrichNormalizedDataset({
  datasetPath,
  manifestPath,
  outputDirectory,
  perProfessor = 3,
  maxPublications = 50,
  delayMs = 500,
  crossref = false,
  kciApiKey = process.env.KCI_API_KEY ?? null,
  fetchImpl = globalThis.fetch,
  logger = console,
}) {
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const normalized = normalizeProfessorDataset(dataset, manifest);
  const selected = selectRecentPublications(normalized, perProfessor).slice(
    0,
    maxPublications,
  );
  const cacheDirectory = path.join(professorDataRoot, ".metadata-cache");
  await mkdir(cacheDirectory, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const metadataRows = [];
  const errors = [];
  let crossrefMatches = 0;
  let kciMatches = 0;

  for (const [index, publication] of selected.entries()) {
    if (index === 0 || (index + 1) % 25 === 0 || index + 1 === selected.length) {
      logger.info?.(`[professor-metadata] ${index + 1}/${selected.length}`);
    }
    try {
      if (crossref && !publication.doi) {
        const crossrefMatch = await cachedLookup(
          cacheDirectory,
          "crossref",
          publication,
          () =>
            queryCrossrefMetadata(publication, {
              fetchImpl,
            }),
        );
        if (crossrefMatch) {
          publication.doi = crossrefMatch.externalId;
          publication.metadata_source = appendSource(
            publication.metadata_source,
            "CROSSREF",
          );
          metadataRows.push(
            metadataRow(publication, crossrefMatch, fetchedAt),
          );
          crossrefMatches += 1;
        }
        await wait(delayMs);
      }
      if (kciApiKey && !publication.kci_id) {
        const kciMatch = await cachedLookup(
          cacheDirectory,
          "kci",
          publication,
          () =>
            queryKci(publication.title, kciApiKey, {
              fetchImpl,
            }),
        );
        if (kciMatch) {
          publication.kci_id = kciMatch.kciId;
          publication.doi = publication.doi ?? kciMatch.doi;
          publication.metadata_source = appendSource(
            publication.metadata_source,
            "KCI",
          );
          metadataRows.push(
            metadataRow(
              publication,
              {
                provider: "KCI",
                externalId: kciMatch.kciId,
                canonicalTitle: publication.title,
                journalTitle: null,
                authors: [],
                abstract: null,
                keywords: [],
                citationCount: null,
                landingUrl: `https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=${encodeURIComponent(kciMatch.kciId)}`,
                licenseUrl: null,
                matchMethod: "TITLE_KCI_API",
                matchScore: kciMatch.similarity,
              },
              fetchedAt,
            ),
          );
          kciMatches += 1;
        }
        await wait(delayMs);
      }
    } catch (error) {
      errors.push({
        publication_id: publication.id,
        title: publication.title,
        reason: error.message,
      });
    }
  }
  normalized.publication_metadata = dedupeMetadata(metadataRows);
  normalized.counts.publication_metadata = normalized.publication_metadata.length;
  const files = await exportNormalizedDatabase({
    dataset,
    manifest,
    normalized,
    datasetPath,
    manifestPath,
    outputDirectory,
  });
  const report = {
    selected: selected.length,
    per_professor: perProfessor,
    crossref: crossref ? "ENABLED" : "DISABLED",
    kci: kciApiKey ? "ENABLED" : "DISABLED_NO_KCI_API_KEY",
    crossref_matches: crossrefMatches,
    kci_matches: kciMatches,
    metadata_rows: normalized.publication_metadata.length,
    errors,
  };
  await writeJsonAtomic(path.join(outputDirectory, "METADATA_REPORT.json"), report);
  return { report, counts: normalized.counts, files };
}

function selectRecentPublications(normalized, perProfessor) {
  const byProfessor = new Map();
  for (const publication of normalized.publications) {
    const values = byProfessor.get(publication.professor_id) ?? [];
    values.push(publication);
    byProfessor.set(publication.professor_id, values);
  }
  const selected = [];
  for (const professor of normalized.professors) {
    const values = (byProfessor.get(professor.id) ?? [])
      .filter((publication) => !isFuturePublication(publication, professor.collected_at))
      .sort(compareRecentPublications)
      .slice(0, perProfessor);
    selected.push(...values);
  }
  return selected;
}

function isFuturePublication(publication, collectedAt) {
  const published = String(publication.published_date ?? "").slice(0, 10);
  const collected = String(collectedAt ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(published) && published > collected;
}

function compareRecentPublications(left, right) {
  const dateOrder = String(right.published_date ?? "").localeCompare(
    String(left.published_date ?? ""),
  );
  return dateOrder || left.title.localeCompare(right.title, "ko-KR");
}

async function cachedLookup(cacheDirectory, provider, publication, loader) {
  const key = createHash("sha256")
    .update(
      `${provider}|${publication.title}|${publication.published_date ?? ""}`,
    )
    .digest("hex");
  const cachePath = path.join(cacheDirectory, `${provider}-${key}.json`);
  try {
    return JSON.parse(await readFile(cachePath, "utf8")).result;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const result = await loader();
  await writeJsonAtomic(cachePath, {
    provider,
    title: publication.title,
    published_date: publication.published_date,
    fetched_at: new Date().toISOString(),
    result,
  });
  return result;
}

function metadataRow(publication, match, fetchedAt) {
  return {
    id: stableId("publication-metadata", publication.id, match.provider),
    publication_id: publication.id,
    provider: match.provider,
    external_id: match.externalId ?? null,
    canonical_title: match.canonicalTitle ?? null,
    journal_title: match.journalTitle ?? null,
    authors_json: JSON.stringify(match.authors ?? []),
    abstract: match.abstract ?? null,
    keywords_json: JSON.stringify(match.keywords ?? []),
    citation_count: match.citationCount ?? null,
    landing_url: match.landingUrl ?? null,
    license_url: match.licenseUrl ?? null,
    fetched_at: fetchedAt,
    match_method: match.matchMethod,
    match_score: match.matchScore,
  };
}

function dedupeMetadata(rows) {
  return [
    ...new Map(
      rows.map((row) => [`${row.publication_id}|${row.provider}`, row]),
    ).values(),
  ];
}

function appendSource(current, source) {
  const values = new Set(String(current || "OFFICIAL_PROFILE").split("+"));
  values.add(source);
  return [...values].join("+");
}

function stableId(...values) {
  return createHash("sha256").update(values.join("|")).digest("hex").slice(0, 24);
}

function parseOptions(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function nonNegativeInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected a non-negative integer, received: ${value}`);
  }
  return parsed;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveRepositoryPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Input must remain under ${repositoryRoot}`);
  }
  return resolved;
}

function resolveProfessorDataPath(value) {
  const resolved = path.resolve(repositoryRoot, value);
  const relative = path.relative(professorDataRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output must remain under ${professorDataRoot}`);
  }
  return resolved;
}

export const SCHEMA_VERSION = "1.0.0";

export const UNIVERSITY = Object.freeze({
  DKU: "단국대학교",
  CBNU: "충북대학교",
});

export const STATUS = Object.freeze({
  FOUND: "FOUND",
  NOT_LISTED_ON_OFFICIAL_PROFILE: "NOT_LISTED_ON_OFFICIAL_PROFILE",
  PROFILE_UNAVAILABLE: "PROFILE_UNAVAILABLE",
  PARSE_FAILED: "PARSE_FAILED",
  ROBOTS_BLOCKED: "ROBOTS_BLOCKED",
});

export const STATUS_VALUES = Object.freeze(Object.values(STATUS));

export const DEFAULT_USER_AGENT =
  "MajorEvolutionResearchBot/0.1 (+https://github.com/choihyungyu0/MajorEvolutionHomepage; public academic metadata only)";

export const OFFICIAL_HOST_SUFFIXES = Object.freeze([
  "dankook.ac.kr",
  "cbnu.ac.kr",
  "chungbuk.ac.kr",
]);

export const SENSITIVE_KEY_PATTERN =
  /^(?:e-?mail|eml|mail|phone|telephone|tel|telno|fax|faxno|photo|photourl|image|imageurl|img|avatar|picture)$/i;

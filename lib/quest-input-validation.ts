function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function canSaveFirstLine(value: string): boolean {
  return hasText(value);
}

export function canSaveMiniReaction(reaction: string): boolean {
  return hasText(reaction);
}

export function canSaveMiniGlossary(term: string, meaning: string): boolean {
  return hasText(term) && hasText(meaning);
}

export function canSaveMiniBingo(keywords: string[]): boolean {
  return keywords.some((keyword) => hasText(keyword));
}

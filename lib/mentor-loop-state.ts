type SerializableValue = string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };

function normalizedValue(value: unknown): SerializableValue {
  if (Array.isArray(value)) return value.map((item) => normalizedValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizedValue(item)]),
    );
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  return String(value);
}

/** 저장 시각을 제외한 실제 기록 내용이 마지막 저장본과 다른지 판별합니다. */
export function hasUnsavedMentorLoopChanges(
  current: object,
  saved: object | undefined,
): boolean {
  if (!saved) return true;
  return JSON.stringify(normalizedValue(current)) !== JSON.stringify(normalizedValue(saved));
}

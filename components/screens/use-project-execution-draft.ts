"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProjectExecutionDraft,
  normalizeProjectExecutionDraft,
  persistProjectExecutionDraft,
  projectExecutionStorageKey,
  type ProjectExecutionDraft,
  type ProjectExecutionSaveState,
} from "@/lib/project-execution";

type ProjectExecutionSeed = Parameters<typeof createProjectExecutionDraft>[0];
type ProjectExecutionStorageProvider = () => Pick<Storage, "setItem">;

export function persistProjectExecutionDraftFromProvider(
  getStorage: ProjectExecutionStorageProvider,
  storageKey: string,
  draft: ProjectExecutionDraft,
): ProjectExecutionSaveState {
  return persistProjectExecutionDraft({
    setItem(key, value) {
      getStorage().setItem(key, value);
    },
  }, storageKey, draft);
}

export function useProjectExecutionDraft(seed: ProjectExecutionSeed | null) {
  const fallback = useMemo(
    () => seed ? createProjectExecutionDraft(seed) : null,
    [seed?.methodDetail, seed?.professorId, seed?.topicId, seed?.topicQuestion, seed?.topicTitle],
  );
  const storageKey = seed ? projectExecutionStorageKey(seed.topicId, seed.professorId) : null;
  const [draft, setDraft] = useState<ProjectExecutionDraft | null>(fallback);
  const draftRef = useRef<ProjectExecutionDraft | null>(fallback);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [saveState, setSaveState] = useState<ProjectExecutionSaveState>({
    status: "idle",
    error: null,
  });

  useEffect(() => {
    if (!fallback || !storageKey) {
      draftRef.current = null;
      setDraft(null);
      setSaveState({ status: "idle", error: null });
      setHasHydrated(true);
      return;
    }
    let next = fallback;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) next = normalizeProjectExecutionDraft(JSON.parse(stored), fallback);
    } catch {
      // 저장소가 제한되거나 값이 손상됐을 때는 안전한 기본 초안으로 계속합니다.
    }
    draftRef.current = next;
    setDraft(next);
    setSaveState({ status: "idle", error: null });
    setHasHydrated(true);
  }, [fallback, storageKey]);

  const updateDraft = useCallback((patch: Partial<ProjectExecutionDraft>) => {
    if (!storageKey) return;
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    draftRef.current = next;
    setDraft(next);
    setSaveState(persistProjectExecutionDraftFromProvider(
      () => window.localStorage,
      storageKey,
      next,
    ));
  }, [storageKey]);

  return {
    draft,
    hasHydrated,
    updateDraft,
    saveStatus: saveState.status,
    saveError: saveState.error,
  };
}

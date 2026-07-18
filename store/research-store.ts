// 2회차 MVP 세션 스토어 — USER_FLOW.md §11 (장기 저장 없음, 세션 한정)
"use client";

import { create } from "zustand";
import type { DataAccess, ExperienceLevel, Major, PeriodLabel } from "@/data/research-mvp";
import {
  emptyConditions,
  missingRequired,
  recommend,
  type Conditions,
  type RecommendResult,
} from "@/lib/recommend";

const MAX_INTERESTS = 3;
const MAX_METHODS = 2;

const RERECOMMEND_EMPTY_NOTE = "이 조건에서 비교할 수 있는 다른 연구주제가 아직 없어요. 조건을 바꿔 보세요.";

function resultIds(r: RecommendResult): string[] {
  if (r.kind === "ok") return [r.candidates[0].topic.id, r.candidates[1].topic.id];
  if (r.kind === "insufficient") return [r.candidate.topic.id];
  return [];
}

const toggle = (list: string[], value: string, max: number) => {
  if (list.includes(value)) return list.filter((v) => v !== value);
  if (list.length >= max) return list; // 최대 개수 초과는 무시 (UI에서 안내)
  return [...list, value];
};

type ResearchState = {
  conditions: Conditions;
  result: RecommendResult | null;
  selectedTopicId: string | null;
  seenIds: string[];
  loadKey: number; // (재)추천마다 증가 → 결과 화면 로딩 재생
  reRecommendNote: string | null;
  interestsFull: boolean;
  methodsFull: boolean;

  setMajor: (m: Major) => void;
  toggleInterest: (tag: string) => void;
  setExperience: (e: ExperienceLevel) => void;
  toggleMethod: (tag: string) => void;
  setPeriod: (p: PeriodLabel) => void;
  setDataAccess: (d: DataAccess) => void;
  toggleAvoid: (tag: string) => void;

  submit: () => string[]; // 누락 항목 반환 (빈 배열이면 추천 성공)
  reRecommend: () => void;
  selectTopic: (id: string) => void;
  reset: () => void;
};

export const useResearchStore = create<ResearchState>((set, get) => ({
  conditions: { ...emptyConditions },
  result: null,
  selectedTopicId: null,
  seenIds: [],
  loadKey: 0,
  reRecommendNote: null,
  interestsFull: false,
  methodsFull: false,

  setMajor: (m) => set((s) => ({ conditions: { ...s.conditions, major: m } })),
  toggleInterest: (tag) =>
    set((s) => {
      const interests = toggle(s.conditions.interests, tag, MAX_INTERESTS);
      return { conditions: { ...s.conditions, interests }, interestsFull: interests.length >= MAX_INTERESTS };
    }),
  setExperience: (e) => set((s) => ({ conditions: { ...s.conditions, experience: e } })),
  toggleMethod: (tag) =>
    set((s) => {
      const methods = toggle(s.conditions.methods, tag, MAX_METHODS);
      return { conditions: { ...s.conditions, methods }, methodsFull: methods.length >= MAX_METHODS };
    }),
  setPeriod: (p) => set((s) => ({ conditions: { ...s.conditions, period: p } })),
  setDataAccess: (d) => set((s) => ({ conditions: { ...s.conditions, dataAccess: d } })),
  toggleAvoid: (tag) => set((s) => ({ conditions: { ...s.conditions, avoid: toggle(s.conditions.avoid, tag, 99) } })),

  submit: () => {
    const { conditions } = get();
    const missing = missingRequired(conditions);
    if (missing.length) return missing;
    const result = recommend(conditions);
    set((s) => ({
      result,
      seenIds: resultIds(result),
      selectedTopicId: null,
      reRecommendNote: null,
      loadKey: s.loadKey + 1,
    }));
    return [];
  },

  reRecommend: () => {
    const { conditions, seenIds } = get();
    const next = recommend(conditions, { excludeIds: seenIds });
    if (next.kind === "ok") {
      set((s) => ({
        result: next,
        seenIds: [...s.seenIds, ...resultIds(next)],
        selectedTopicId: null,
        reRecommendNote: null,
        loadKey: s.loadKey + 1,
      }));
    } else {
      // 새 후보 부족 → 기존 결과·선택 유지하고 안내만 표시
      set({ reRecommendNote: RERECOMMEND_EMPTY_NOTE });
    }
  },

  selectTopic: (id) => set({ selectedTopicId: id }),

  reset: () =>
    set({
      conditions: { ...emptyConditions },
      result: null,
      selectedTopicId: null,
      seenIds: [],
      reRecommendNote: null,
      interestsFull: false,
      methodsFull: false,
    }),
}));

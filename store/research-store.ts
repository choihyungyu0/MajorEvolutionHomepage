// 연구 공동설계와 공식 교수 연결 상태를 브라우저에 저장한다.
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  modeById,
  questionsForMode,
  type ConfirmedAnswer,
  type IdeaMode,
} from "@/data/co-design";
import type {
  DataAccess,
  ExperienceLevel,
  Major,
  PeriodLabel,
  ResearchTopic,
} from "@/data/research-mvp";
import {
  compareTopicPair,
  emptyConditions,
  missingRequired,
  recommend,
  type Conditions,
  type RecommendResult,
} from "@/lib/recommend";
import type {
  ProfessorKnockKitDraft,
  ProfessorMatch,
  ProfessorMatchResponse,
  ProfessorMentorLoopEntry,
} from "@/lib/professor-domain";

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
  hasHydrated: boolean;
  conditions: Conditions;
  ideaMode: IdeaMode | null;
  coDesignStep: number;
  coDesignAnswers: ConfirmedAnswer[];
  result: RecommendResult | null;
  resultOrigin: "ai" | "reviewed-fallback" | null;
  groundingNote: string | null;
  selectedTopicId: string | null;
  professorMatches: ProfessorMatch[];
  professorCoverage: Pick<
    ProfessorMatchResponse,
    "officialRecordCount" | "scopeStatus" | "coverageGaps" | "note"
  > | null;
  professorMatchStatus: "idle" | "loading" | "success" | "error";
  professorMatchError: string | null;
  selectedProfessorId: string | null;
  knockKitDrafts: Record<string, ProfessorKnockKitDraft>;
  mentorLoopEntries: Record<string, ProfessorMentorLoopEntry>;
  seenIds: string[];
  loadKey: number; // (재)추천마다 증가 → 결과 화면 로딩 재생
  reRecommendNote: string | null;
  interestsFull: boolean;
  methodsFull: boolean;

  setHasHydrated: (value: boolean) => void;
  setIdeaMode: (mode: IdeaMode) => void;
  setMajor: (m: Major) => void;
  toggleInterest: (tag: string) => void;
  setExperience: (e: ExperienceLevel) => void;
  toggleMethod: (tag: string) => void;
  setPeriod: (p: PeriodLabel) => void;
  setDataAccess: (d: DataAccess) => void;
  toggleAvoid: (tag: string) => void;

  submit: () => string[]; // 누락 항목 반환 (빈 배열이면 공동설계 진입 가능)
  answerCoDesign: (value: string) => boolean; // 마지막 질문이면 true
  previousCoDesignQuestion: () => void;
  completeCoDesign: (
    topics?: [ResearchTopic, ResearchTopic],
    groundingNote?: string,
  ) => void;
  reRecommend: () => void;
  selectTopic: (id: string) => void;
  setProfessorMatchLoading: () => void;
  setProfessorMatches: (response: ProfessorMatchResponse) => void;
  setProfessorMatchError: (message: string) => void;
  selectProfessor: (id: string) => void;
  saveKnockKitDraft: (key: string, draft: ProfessorKnockKitDraft) => void;
  saveMentorLoopEntry: (key: string, entry: ProfessorMentorLoopEntry) => void;
  deleteMentorLoopEntry: (key: string) => void;
  reset: () => void;
};

export const useResearchStore = create<ResearchState>()(persist((set, get) => ({
  hasHydrated: false,
  conditions: { ...emptyConditions },
  ideaMode: null,
  coDesignStep: 0,
  coDesignAnswers: [],
  result: null,
  resultOrigin: null,
  groundingNote: null,
  selectedTopicId: null,
  professorMatches: [],
  professorCoverage: null,
  professorMatchStatus: "idle",
  professorMatchError: null,
  selectedProfessorId: null,
  knockKitDrafts: {},
  mentorLoopEntries: {},
  seenIds: [],
  loadKey: 0,
  reRecommendNote: null,
  interestsFull: false,
  methodsFull: false,

  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  setIdeaMode: (ideaMode) =>
    set({
      ideaMode,
      coDesignStep: 0,
      coDesignAnswers: [],
      result: null,
      resultOrigin: null,
      groundingNote: null,
      selectedTopicId: null,
      professorMatches: [],
      professorCoverage: null,
      professorMatchStatus: "idle",
      professorMatchError: null,
      selectedProfessorId: null,
    }),
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
    const { conditions, ideaMode } = get();
    const missing = [...missingRequired(conditions)] as string[];
    if (!ideaMode) missing.unshift("ideaMode");
    if (missing.length) return missing;
    set({
      coDesignStep: 0,
      coDesignAnswers: [],
      result: null,
      resultOrigin: null,
      groundingNote: null,
      seenIds: [],
      selectedTopicId: null,
      professorMatches: [],
      professorCoverage: null,
      professorMatchStatus: "idle",
      professorMatchError: null,
      selectedProfessorId: null,
      reRecommendNote: null,
    });
    return [];
  },

  answerCoDesign: (value) => {
    const { ideaMode, coDesignStep, coDesignAnswers } = get();
    if (!ideaMode || !value.trim()) return false;
    const questions = questionsForMode(ideaMode);
    const question = questions[coDesignStep];
    if (!question) return true;
    const answer: ConfirmedAnswer = {
      questionId: question.id,
      label: question.contextLabel,
      value: value.trim().slice(0, 160),
      status: "사용자 확인",
    };
    const nextAnswers = [
      ...coDesignAnswers.filter((item) => item.questionId !== question.id),
      answer,
    ];
    const isLast = coDesignStep >= questions.length - 1;
    set({
      coDesignAnswers: nextAnswers,
      coDesignStep: isLast ? coDesignStep : coDesignStep + 1,
    });
    return isLast;
  },

  previousCoDesignQuestion: () =>
    set((state) => ({
      coDesignStep: Math.max(0, state.coDesignStep - 1),
    })),

  completeCoDesign: (topics, groundingNote) => {
    const { conditions, ideaMode, coDesignAnswers } = get();
    if (!ideaMode || coDesignAnswers.length < questionsForMode(ideaMode).length) return;
    const result = topics
      ? compareTopicPair(conditions, topics)
      : recommend(conditions);
    set((state) => ({
      result,
      resultOrigin: topics ? "ai" : "reviewed-fallback",
      groundingNote: groundingNote ?? (
        topics
          ? "AI가 사용자 확인 답변을 바탕으로 후보를 구성했습니다."
          : "AI 연결을 사용할 수 없어 검수된 로컬 후보로 이어갑니다."
      ),
      seenIds: resultIds(result),
      selectedTopicId: null,
      professorMatches: [],
      professorCoverage: null,
      professorMatchStatus: "idle",
      professorMatchError: null,
      selectedProfessorId: null,
      reRecommendNote: null,
      loadKey: state.loadKey + 1,
    }));
  },

  reRecommend: () => {
    const { conditions, seenIds } = get();
    const next = recommend(conditions, { excludeIds: seenIds });
    if (next.kind === "ok") {
      set((s) => ({
        result: next,
        resultOrigin: "reviewed-fallback",
        groundingNote: "같은 조건에서 검수된 로컬 후보를 다시 구성했습니다.",
        seenIds: [...s.seenIds, ...resultIds(next)],
        selectedTopicId: null,
        professorMatches: [],
        professorCoverage: null,
        professorMatchStatus: "idle",
        professorMatchError: null,
        selectedProfessorId: null,
        reRecommendNote: null,
        loadKey: s.loadKey + 1,
      }));
    } else {
      // 새 후보 부족 → 기존 결과·선택 유지하고 안내만 표시
      set({ reRecommendNote: RERECOMMEND_EMPTY_NOTE });
    }
  },

  selectTopic: (id) => set({
    selectedTopicId: id,
    professorMatches: [],
    professorCoverage: null,
    professorMatchStatus: "idle",
    professorMatchError: null,
    selectedProfessorId: null,
  }),
  setProfessorMatchLoading: () =>
    set({ professorMatchStatus: "loading", professorMatchError: null }),
  setProfessorMatches: (response) =>
    set((state) => response.topicId !== state.selectedTopicId ? state : ({
      professorMatches: response.matches,
      professorCoverage: {
        officialRecordCount: response.officialRecordCount,
        scopeStatus: response.scopeStatus,
        coverageGaps: response.coverageGaps,
        note: response.note,
      },
      professorMatchStatus: "success",
      professorMatchError: null,
      selectedProfessorId: null,
    })),
  setProfessorMatchError: (professorMatchError) =>
    set({ professorMatchStatus: "error", professorMatchError }),
  selectProfessor: (selectedProfessorId) => set({ selectedProfessorId }),
  saveKnockKitDraft: (key, draft) =>
    set((state) => ({ knockKitDrafts: { ...state.knockKitDrafts, [key]: draft } })),
  saveMentorLoopEntry: (key, entry) =>
    set((state) => ({
      mentorLoopEntries: { ...state.mentorLoopEntries, [key]: entry },
    })),
  deleteMentorLoopEntry: (key) =>
    set((state) => {
      const mentorLoopEntries = { ...state.mentorLoopEntries };
      delete mentorLoopEntries[key];
      return { mentorLoopEntries };
    }),

  reset: () =>
    set({
      conditions: { ...emptyConditions },
      ideaMode: null,
      coDesignStep: 0,
      coDesignAnswers: [],
      result: null,
      resultOrigin: null,
      groundingNote: null,
      selectedTopicId: null,
      professorMatches: [],
      professorCoverage: null,
      professorMatchStatus: "idle",
      professorMatchError: null,
      selectedProfessorId: null,
      seenIds: [],
      reRecommendNote: null,
      interestsFull: false,
      methodsFull: false,
    }),
}), {
  name: "major-evolution-research-v1",
  version: 1,
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: ({
    hasHydrated: _hasHydrated,
    interestsFull: _interestsFull,
    methodsFull: _methodsFull,
    professorMatchStatus,
    professorMatchError,
    ...state
  }) => ({
    ...state,
    professorMatchStatus: professorMatchStatus === "loading" ? "idle" : professorMatchStatus,
    professorMatchError,
  }),
  onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
}));

export function currentModeLabel(mode: IdeaMode | null): string {
  return modeById(mode)?.label ?? "탐색 방식 미선택";
}

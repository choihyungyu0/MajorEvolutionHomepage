"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  defaultEmailDraft,
  defaultPassport,
  defaultProfile,
  defaultQuestions,
  emptyProfile,
  type ComparisonCriterion,
  type Difficulty,
  type EditablePassport,
  type Goal,
  type StudentProfile,
  type Idea,
} from "@/data/prototype";
import { createPassportFromIdea, getAvailableIdeas, type AiGenerationStatus, type AiJourneyResult } from "@/lib/ai-journey";

type ListField = "interests" | "careers" | "skills";
export type QuestNotes = {
  dataPlan: string;
  methodPlan: string;
  portfolio: string;
};

type PrototypeState = {
  hasHydrated: boolean;
  goal: Goal | null;
  dnaStep: number;
  profile: StudentProfile;
  isSampleMode: boolean;
  aiStatus: AiGenerationStatus;
  aiError: string | null;
  aiJourney: AiJourneyResult | null;
  aiIdeaArchive: Idea[];
  selectedTrendId: string;
  ideaSetVersion: 0 | 1;
  selectedIdeaIds: string[];
  selectedIdeaId: string | null;
  comparisonCriteria: ComparisonCriterion[];
  difficulty: Difficulty;
  feasibilityVersion: "original" | "four-week";
  passport: EditablePassport;
  professorFilter: "전체" | "연구 주제" | "방법론" | "프로젝트·수업";
  selectedProfessorId: string | null;
  completedQuestIds: string[];
  savedIdeaIds: string[];
  savedProfessorIds: string[];
  comparedProfessorIds: string[];
  editedQuestions: string[];
  editedEmailDraft: string;
  questNotes: QuestNotes;
  setHasHydrated: (value: boolean) => void;
  setGoal: (goal: Goal | null) => void;
  setDnaStep: (step: number) => void;
  updateProfile: (patch: Partial<StudentProfile>) => void;
  toggleProfileItem: (field: ListField, value: string, max?: number) => void;
  setSampleMode: (value: boolean) => void;
  setAiLoading: () => void;
  setAiJourney: (journey: AiJourneyResult) => void;
  setAiFallback: (journey: AiJourneyResult, message: string) => void;
  setAiError: (message: string) => void;
  setAiIdeas: (ideas: Idea[], generatedAt: string, model: string) => void;
  setSelectedTrend: (id: string) => void;
  regenerateIdeas: () => void;
  toggleIdeaSelection: (id: string) => void;
  setSelectedIdea: (id: string) => void;
  toggleCriterion: (criterion: ComparisonCriterion) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setFeasibilityVersion: (version: "original" | "four-week") => void;
  updatePassport: (field: keyof EditablePassport, value: string) => void;
  setProfessorFilter: (filter: PrototypeState["professorFilter"]) => void;
  setSelectedProfessor: (id: string) => void;
  toggleSavedIdea: (id: string) => void;
  toggleSavedProfessor: (id: string) => void;
  toggleComparedProfessor: (id: string) => void;
  setQuestion: (index: number, value: string) => void;
  setEmailDraft: (value: string) => void;
  setQuestNote: (field: keyof QuestNotes, value: string) => void;
  completeQuest: (id: string) => void;
  resetDemo: () => void;
};

const initialState = {
  goal: null,
  dnaStep: 1,
  profile: emptyProfile,
  isSampleMode: false,
  aiStatus: "idle" as AiGenerationStatus,
  aiError: null as string | null,
  aiJourney: null as AiJourneyResult | null,
  aiIdeaArchive: [] as Idea[],
  selectedTrendId: "greenwashing",
  ideaSetVersion: 0 as const,
  selectedIdeaIds: [] as string[],
  selectedIdeaId: null as string | null,
  comparisonCriteria: ["personalFit", "dataAccess"] as ComparisonCriterion[],
  difficulty: "project" as Difficulty,
  feasibilityVersion: "original" as const,
  passport: defaultPassport,
  professorFilter: "전체" as const,
  selectedProfessorId: null as string | null,
  completedQuestIds: [] as string[],
  savedIdeaIds: [] as string[],
  savedProfessorIds: [] as string[],
  comparedProfessorIds: [] as string[],
  editedQuestions: defaultQuestions,
  editedEmailDraft: defaultEmailDraft,
  questNotes: {
    dataPlan: "핵심 데이터 후보와 접근 경로, 수집 단위를 정리해 주세요.",
    methodPlan: "가장 단순한 기준 방법부터 비교 방법까지 순서대로 적어 주세요.",
    portfolio: "문제, 데이터, 방법, 결과를 한 문장으로 연결해 주세요.",
  } as QuestNotes,
};

export const usePrototypeStore = create<PrototypeState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setGoal: (goal) => set({ goal }),
      setDnaStep: (dnaStep) => set({ dnaStep }),
      updateProfile: (patch) => set((state) => ({ profile: { ...state.profile, ...patch } })),
      toggleProfileItem: (field, value, max) =>
        set((state) => {
          const current = state.profile[field];
          const exists = current.includes(value);
          const next = exists ? current.filter((item) => item !== value) : [...current, value];
          if (!exists && max && next.length > max) return state;
          return { profile: { ...state.profile, [field]: next } };
        }),
      setSampleMode: (isSampleMode) =>
        set({
          ...initialState,
          isSampleMode,
          profile: isSampleMode ? defaultProfile : emptyProfile,
        }),
      setAiLoading: () => set({ aiStatus: "loading", aiError: null }),
      setAiJourney: (aiJourney) =>
        set({
          aiJourney,
          aiStatus: "success",
          aiError: null,
          aiIdeaArchive: [],
          selectedTrendId: aiJourney.trends[0]?.id ?? "",
          selectedIdeaIds: [],
          selectedIdeaId: null,
        }),
      setAiFallback: (aiJourney, aiError) =>
        set({
          aiJourney,
          aiStatus: "fallback",
          aiError,
          aiIdeaArchive: [],
          selectedTrendId: aiJourney.trends[0]?.id ?? "greenwashing",
          selectedIdeaIds: [],
          selectedIdeaId: null,
        }),
      setAiError: (aiError) => set({ aiStatus: "error", aiError }),
      setAiIdeas: (ideas, generatedAt, model) =>
        set((state) => {
          if (!state.aiJourney) return state;
          const archivedIds = new Set(state.aiIdeaArchive.map((idea) => idea.id));
          const aiIdeaArchive = [
            ...state.aiIdeaArchive,
            ...state.aiJourney.ideas.filter((idea) => !archivedIds.has(idea.id)),
          ];
          return {
            aiJourney: { ...state.aiJourney, ideas, generatedAt, model },
            aiIdeaArchive,
            aiStatus: "success",
            aiError: null,
            selectedIdeaIds: [],
            selectedIdeaId: null,
          };
        }),
      setSelectedTrend: (selectedTrendId) => set({ selectedTrendId }),
      regenerateIdeas: () =>
        set((state) => ({
          ideaSetVersion: state.ideaSetVersion === 0 ? 1 : 0,
          selectedIdeaIds: [],
          selectedIdeaId: null,
        })),
      toggleIdeaSelection: (id) =>
        set((state) => {
          const exists = state.selectedIdeaIds.includes(id);
          if (exists) return { selectedIdeaIds: state.selectedIdeaIds.filter((item) => item !== id) };
          if (state.selectedIdeaIds.length >= 2) return state;
          return { selectedIdeaIds: [...state.selectedIdeaIds, id] };
        }),
      setSelectedIdea: (selectedIdeaId) =>
        set((state) => {
          const idea = [...getAvailableIdeas(state.aiJourney), ...state.aiIdeaArchive].find((item) => item.id === selectedIdeaId);
          return {
            selectedIdeaId,
            passport: idea ? createPassportFromIdea(idea) : state.passport,
            questNotes: idea ? {
              dataPlan: `${idea.data.join(", ")}의 확보 경로와 수집 단위를 확인한다.`,
              methodPlan: `${idea.methods.join(" → ")} 순서로 기준 방법부터 적용한다.`,
              portfolio: `${idea.title} 프로젝트에서 ${idea.data.slice(0, 2).join("와 ")}를 활용해 ${idea.question}`,
            } : state.questNotes,
          };
        }),
      toggleCriterion: (criterion) =>
        set((state) => {
          const exists = state.comparisonCriteria.includes(criterion);
          if (exists) return { comparisonCriteria: state.comparisonCriteria.filter((item) => item !== criterion) };
          if (state.comparisonCriteria.length >= 2) return state;
          return { comparisonCriteria: [...state.comparisonCriteria, criterion] };
        }),
      setDifficulty: (difficulty) =>
        set((state) => ({ difficulty, profile: { ...state.profile, difficulty } })),
      setFeasibilityVersion: (feasibilityVersion) => set({ feasibilityVersion }),
      updatePassport: (field, value) => set((state) => ({ passport: { ...state.passport, [field]: value } })),
      setProfessorFilter: (professorFilter) => set({ professorFilter }),
      setSelectedProfessor: (selectedProfessorId) => set({ selectedProfessorId }),
      toggleSavedIdea: (id) =>
        set((state) => ({
          savedIdeaIds: state.savedIdeaIds.includes(id)
            ? state.savedIdeaIds.filter((item) => item !== id)
            : [...state.savedIdeaIds, id],
        })),
      toggleSavedProfessor: (id) =>
        set((state) => ({
          savedProfessorIds: state.savedProfessorIds.includes(id)
            ? state.savedProfessorIds.filter((item) => item !== id)
            : [...state.savedProfessorIds, id],
        })),
      toggleComparedProfessor: (id) =>
        set((state) => {
          if (state.comparedProfessorIds.includes(id)) {
            return { comparedProfessorIds: state.comparedProfessorIds.filter((item) => item !== id) };
          }
          if (state.comparedProfessorIds.length >= 2) return state;
          return { comparedProfessorIds: [...state.comparedProfessorIds, id] };
        }),
      setQuestion: (index, value) =>
        set((state) => ({
          editedQuestions: state.editedQuestions.map((question, questionIndex) =>
            questionIndex === index ? value : question,
          ),
        })),
      setEmailDraft: (editedEmailDraft) => set({ editedEmailDraft }),
      setQuestNote: (field, value) => set((state) => ({ questNotes: { ...state.questNotes, [field]: value } })),
      completeQuest: (id) =>
        set((state) => ({
          completedQuestIds: state.completedQuestIds.includes(id)
            ? state.completedQuestIds
            : [...state.completedQuestIds, id],
        })),
      resetDemo: () => set({ ...initialState, hasHydrated: true }),
    }),
    {
      name: "major-evolution-prototype-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ hasHydrated: _hasHydrated, ...state }) => state,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

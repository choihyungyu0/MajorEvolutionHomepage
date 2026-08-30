"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const PROFILE_GRADES = [
  "1학년",
  "2학년",
  "3학년",
  "4학년 이상",
  "대학원생",
  "휴학 중",
] as const;

export type ProfileGrade = typeof PROFILE_GRADES[number] | "";

export type LocalUserProfile = {
  name: string;
  school: string;
  major: string;
  grade: ProfileGrade;
  careerConcern: string;
  interests: string[];
  updatedAt: string | null;
};

type ProfileState = {
  hasHydrated: boolean;
  hasEnteredService: boolean;
  hasCompletedProfessorTutorial: boolean;
  profile: LocalUserProfile;
  setHasHydrated: (value: boolean) => void;
  markServiceEntered: () => void;
  completeProfessorTutorial: () => void;
  saveProfile: (profile: Omit<LocalUserProfile, "updatedAt">) => void;
  clearProfile: () => void;
};

export const emptyLocalUserProfile: LocalUserProfile = {
  name: "",
  school: "",
  major: "",
  grade: "",
  careerConcern: "",
  interests: [],
  updatedAt: null,
};

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => normalizeText(item, 40))
      .filter(Boolean),
  )).slice(0, 5);
}

function normalizeProfile(value: unknown): LocalUserProfile {
  const profile = value && typeof value === "object"
    ? value as Partial<LocalUserProfile>
    : {};
  const grade = PROFILE_GRADES.includes(profile.grade as Exclude<ProfileGrade, "">)
    ? profile.grade as Exclude<ProfileGrade, "">
    : "";

  return {
    name: normalizeText(profile.name, 40),
    school: normalizeText(profile.school, 80),
    major: normalizeText(profile.major, 80),
    grade,
    careerConcern: normalizeText(profile.careerConcern, 240),
    interests: normalizeInterests(profile.interests),
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt.slice(0, 40) : null,
  };
}

export function migrateProfileState(persistedState: unknown): Partial<ProfileState> {
  const state = persistedState && typeof persistedState === "object"
    ? persistedState as Partial<ProfileState>
    : {};
  return {
    hasEnteredService: Boolean(state.hasEnteredService),
    hasCompletedProfessorTutorial: Boolean(state.hasCompletedProfessorTutorial),
    profile: normalizeProfile(state.profile),
  };
}

export const useProfileStore = create<ProfileState>()(persist((set) => ({
  hasHydrated: false,
  hasEnteredService: false,
  hasCompletedProfessorTutorial: false,
  profile: { ...emptyLocalUserProfile },
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  markServiceEntered: () => set({ hasEnteredService: true }),
  completeProfessorTutorial: () => set({
    hasCompletedProfessorTutorial: true,
    hasEnteredService: true,
  }),
  saveProfile: (profile) => set({
    profile: normalizeProfile({ ...profile, updatedAt: new Date().toISOString() }),
    hasEnteredService: true,
  }),
  clearProfile: () => set({ profile: { ...emptyLocalUserProfile } }),
}), {
  name: "major-evolution-profile-v1",
  version: 2,
  migrate: migrateProfileState,
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: ({ hasHydrated: _hasHydrated, ...state }) => state,
  onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
}));

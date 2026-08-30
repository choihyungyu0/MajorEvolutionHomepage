"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  normalizeGrowthProfessorSuggestions,
  type GrowthProfessorResponse,
  type GrowthProfessorSuggestion,
} from "@/lib/ai-growth-professor";
import {
  hideConversationMapBranchState,
  reconcileConversationMapStateAfterTrim,
  restoreConversationMapBranchState,
} from "@/lib/ai-conversation-map";

export type AiProfessorMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /**
   * 대화 지도에서 과거 AI 답변을 출발점으로 새 갈래를 시작했을 때만
   * 해당 답변 id를 저장합니다. 기존의 일반 대화는 null입니다.
   */
  branchParentMessageId: string | null;
  reflection: GrowthProfessorResponse["reflection"] | null;
  suggestedPrompts: GrowthProfessorSuggestion[];
};

export type AiGrowthNote = {
  id: string;
  title: string;
  body: string;
  sourceMessageId: string;
  createdAt: string;
};

export type AiConversationMapDecision = "keep" | "exclude";

type AiProfessorState = {
  hasHydrated: boolean;
  messages: AiProfessorMessage[];
  growthNotes: AiGrowthNote[];
  mapDecisions: Record<string, AiConversationMapDecision>;
  collapsedMapNodeIds: string[];
  detachedMapNodeIds: string[];
  setHasHydrated: (value: boolean) => void;
  addUserMessage: (content: string, branchParentMessageId?: string | null) => AiProfessorMessage;
  addAssistantMessage: (response: GrowthProfessorResponse) => AiProfessorMessage;
  saveReflection: (messageId: string) => "saved" | "already-saved" | "missing";
  removeConversationBranch: (messageId: string) => void;
  removeGrowthNote: (id: string) => void;
  setMapDecision: (messageId: string, decision: AiConversationMapDecision) => void;
  clearMapDecision: (messageId: string) => void;
  toggleCollapsedMapNode: (messageId: string) => void;
  collapseMapNode: (messageId: string) => void;
  expandMapNode: (messageId: string) => void;
  clearCollapsedMapNode: (messageId: string) => void;
  clearCollapsedMapNodes: () => void;
  detachMapNode: (messageId: string) => void;
  attachMapNode: (messageId: string) => void;
  clearDetachedMapNodes: () => void;
  hideMapBranch: (messageId: string) => void;
  restoreMapBranch: (messageId: string) => void;
  clearConversation: () => void;
  clearGrowthNotes: () => void;
};

const MAX_MESSAGES = 40;
const MAX_NOTES = 20;

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function trimText(value: string, max: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function trimMultilineText(value: string, max: number) {
  return value
    .trim()
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[\t ]+/g, " "))
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}

function conversationBranchMessageIds(
  messages: AiProfessorMessage[],
  messageId: string,
): Set<string> {
  const assistantByUser = new Map<string, string>();
  const userByAssistant = new Map<string, string>();
  const parentByAssistant = new Map<string, string | null>();
  let pendingUser: AiProfessorMessage | null = null;
  let previousAssistantId: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      pendingUser = message;
      continue;
    }

    if (pendingUser) {
      assistantByUser.set(pendingUser.id, message.id);
      userByAssistant.set(message.id, pendingUser.id);
    }
    parentByAssistant.set(
      message.id,
      pendingUser?.branchParentMessageId || previousAssistantId,
    );
    previousAssistantId = message.id;
    pendingUser = null;
  }

  const rootAssistantId = parentByAssistant.has(messageId)
    ? messageId
    : assistantByUser.get(messageId) ?? null;
  if (!rootAssistantId) return new Set([messageId]);

  const removedAssistantIds = new Set([rootAssistantId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [assistantId, parentId] of parentByAssistant) {
      if (parentId && removedAssistantIds.has(parentId) && !removedAssistantIds.has(assistantId)) {
        removedAssistantIds.add(assistantId);
        changed = true;
      }
    }
  }

  const removedMessageIds = new Set<string>(removedAssistantIds);
  for (const assistantId of removedAssistantIds) {
    const userId = userByAssistant.get(assistantId);
    if (userId) removedMessageIds.add(userId);
  }
  return removedMessageIds;
}

export const useAiProfessorStore = create<AiProfessorState>()(persist((set, get) => ({
  hasHydrated: false,
  messages: [],
  growthNotes: [],
  mapDecisions: {},
  collapsedMapNodeIds: [],
  detachedMapNodeIds: [],
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  addUserMessage: (content, branchParentMessageId = null) => {
    const message: AiProfessorMessage = {
      id: createId("user"),
      role: "user",
      content: trimText(content, 600),
      createdAt: new Date().toISOString(),
      branchParentMessageId,
      reflection: null,
      suggestedPrompts: [],
    };
    set((state) => {
      const previousMessages = [...state.messages, message];
      const messages = previousMessages.slice(-MAX_MESSAGES);
      return {
        messages,
        ...reconcileConversationMapStateAfterTrim({
          previousMessages,
          nextMessages: messages,
          mapDecisions: state.mapDecisions,
          collapsedMapNodeIds: state.collapsedMapNodeIds,
          detachedMapNodeIds: state.detachedMapNodeIds,
        }),
      };
    });
    return message;
  },
  addAssistantMessage: (response) => {
    const message: AiProfessorMessage = {
      id: createId("assistant"),
      role: "assistant",
      content: trimMultilineText(response.reply, 220),
      createdAt: response.generatedAt,
      branchParentMessageId: null,
      reflection: {
        title: trimText(response.reflection.title, 80),
        body: trimMultilineText(response.reflection.body, 180),
      },
      suggestedPrompts: normalizeGrowthProfessorSuggestions(response.suggestedPrompts),
    };
    set((state) => {
      const previousMessages = [...state.messages, message];
      const messages = previousMessages.slice(-MAX_MESSAGES);
      return {
        messages,
        ...reconcileConversationMapStateAfterTrim({
          previousMessages,
          nextMessages: messages,
          mapDecisions: state.mapDecisions,
          collapsedMapNodeIds: state.collapsedMapNodeIds,
          detachedMapNodeIds: state.detachedMapNodeIds,
        }),
      };
    });
    return message;
  },
  saveReflection: (messageId) => {
    const state = get();
    const message = state.messages.find((item) => item.id === messageId);
    if (!message?.reflection) return "missing";
    if (state.growthNotes.some((note) => note.sourceMessageId === messageId)) return "already-saved";
    const note: AiGrowthNote = {
      id: createId("note"),
      title: message.reflection.title,
      body: message.reflection.body,
      sourceMessageId: messageId,
      createdAt: new Date().toISOString(),
    };
    set({ growthNotes: [...state.growthNotes, note].slice(-MAX_NOTES) });
    return "saved";
  },
  removeConversationBranch: (messageId) => set((state) => {
    const removedMessageIds = conversationBranchMessageIds(state.messages, messageId);
    const mapDecisions = Object.fromEntries(
      Object.entries(state.mapDecisions).filter(([id]) => !removedMessageIds.has(id)),
    );
    return {
      messages: state.messages.filter((message) => !removedMessageIds.has(message.id)),
      mapDecisions,
      collapsedMapNodeIds: state.collapsedMapNodeIds.filter((id) => !removedMessageIds.has(id)),
      detachedMapNodeIds: state.detachedMapNodeIds.filter((id) => !removedMessageIds.has(id)),
    };
  }),
  removeGrowthNote: (id) => set((state) => ({
    growthNotes: state.growthNotes.filter((note) => note.id !== id),
  })),
  setMapDecision: (messageId, decision) => set((state) => ({
    mapDecisions: { ...state.mapDecisions, [messageId]: decision },
  })),
  clearMapDecision: (messageId) => set((state) => {
    const mapDecisions = { ...state.mapDecisions };
    delete mapDecisions[messageId];
    return { mapDecisions };
  }),
  toggleCollapsedMapNode: (messageId) => set((state) => ({
    collapsedMapNodeIds: state.collapsedMapNodeIds.includes(messageId)
      ? state.collapsedMapNodeIds.filter((id) => id !== messageId)
      : [...state.collapsedMapNodeIds, messageId],
  })),
  collapseMapNode: (messageId) => set((state) => ({
    collapsedMapNodeIds: state.collapsedMapNodeIds.includes(messageId)
      ? state.collapsedMapNodeIds
      : [...state.collapsedMapNodeIds, messageId],
  })),
  expandMapNode: (messageId) => set((state) => ({
    collapsedMapNodeIds: state.collapsedMapNodeIds.filter((id) => id !== messageId),
  })),
  clearCollapsedMapNode: (messageId) => set((state) => ({
    collapsedMapNodeIds: state.collapsedMapNodeIds.filter((id) => id !== messageId),
  })),
  clearCollapsedMapNodes: () => set({ collapsedMapNodeIds: [] }),
  detachMapNode: (messageId) => set((state) => ({
    detachedMapNodeIds: state.detachedMapNodeIds.includes(messageId)
      ? state.detachedMapNodeIds
      : [...state.detachedMapNodeIds, messageId],
  })),
  attachMapNode: (messageId) => set((state) => ({
    detachedMapNodeIds: state.detachedMapNodeIds.filter((id) => id !== messageId),
  })),
  clearDetachedMapNodes: () => set({ detachedMapNodeIds: [] }),
  hideMapBranch: (messageId) => set((state) => hideConversationMapBranchState(state, messageId)),
  restoreMapBranch: (messageId) => set((state) => restoreConversationMapBranchState(state, messageId)),
  clearConversation: () => set({
    messages: [],
    mapDecisions: {},
    collapsedMapNodeIds: [],
    detachedMapNodeIds: [],
  }),
  clearGrowthNotes: () => set({ growthNotes: [] }),
}), {
  name: "major-evolution-ai-professor-v1",
  version: 7,
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  partialize: ({
    messages,
    growthNotes,
    mapDecisions,
    collapsedMapNodeIds,
    detachedMapNodeIds,
  }) => ({
    messages,
    growthNotes,
    mapDecisions,
    collapsedMapNodeIds,
    detachedMapNodeIds,
  }),
  migrate: (persistedState) => {
    const state = persistedState as Partial<AiProfessorState> | undefined;
    return {
      messages: Array.isArray(state?.messages)
        ? state.messages.map((message) => ({
          ...message,
          branchParentMessageId: typeof message.branchParentMessageId === "string"
            ? message.branchParentMessageId
            : null,
          suggestedPrompts: message.role === "assistant"
            ? normalizeGrowthProfessorSuggestions(message.suggestedPrompts)
            : [],
        }))
        : [],
      growthNotes: Array.isArray(state?.growthNotes) ? state.growthNotes : [],
      mapDecisions: state?.mapDecisions && typeof state.mapDecisions === "object"
        ? state.mapDecisions
        : {},
      collapsedMapNodeIds: Array.isArray(state?.collapsedMapNodeIds)
        ? state.collapsedMapNodeIds.filter((id): id is string => typeof id === "string")
        : [],
      detachedMapNodeIds: Array.isArray(state?.detachedMapNodeIds)
        ? state.detachedMapNodeIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  },
  onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
}));

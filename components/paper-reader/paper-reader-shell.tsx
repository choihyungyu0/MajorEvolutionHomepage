"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clipboard,
  CloudDownload,
  Copy,
  ExternalLink,
  FileSearch,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppShell,
  Card,
  LinkButton,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  StatusBanner,
  Tag,
  TextButton,
} from "@/components/app/primitives";
import { FavoriteProfessorPaperPicker } from "@/components/paper-reader/favorite-professor-paper-picker";
import { PaperReadingSteps } from "@/components/paper-reader/paper-reading-steps";
import { requestPaperAnalysis } from "@/lib/ai-client";
import { FIRST_QUESTION_FROM_PAPER_HREF } from "@/lib/email-draft-purpose";
import type { PaperAnalysisResult } from "@/lib/paper-analysis";
import type { ProfessorPaperSelection } from "@/lib/professor-domain";
import {
  requestProfessorPaperContent,
  type ProfessorPaperContentResponse,
} from "@/lib/professor-paper-content-client";
import { requestFavoriteProfessorPaperCatalog } from "@/lib/professor-paper-client";
import { createProfessorPaperSelection } from "@/lib/professor-paper-selection";
import { useQuestStore } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

const MIN_CONTENT_LENGTH = 80;
const MAX_CONTENT_LENGTH = 12_000;
const PAPER_BITE_WORKING_DRAFT_STORAGE_KEY = "major-evolution-paper-bite-working-draft-v1";

type BiteCardKey = "problem" | "method" | "result" | "limitations" | "questions";
type BiteDraft = Record<BiteCardKey, string>;
type PaperBiteWorkflowStep = "select" | "card";

type StoredPaperBiteWorkingDraft = {
  version: 1;
  title: string;
  content: string;
  analysis: PaperAnalysisResult;
  draft: BiteDraft;
  sourceConfirmed: boolean;
};

const BITE_CARD_META: ReadonlyArray<{
  key: BiteCardKey;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Lightbulb;
}> = [
  {
    key: "problem",
    eyebrow: "01 문제",
    title: "왜 시작한 연구인가요?",
    description: "논문이 풀려는 배경과 문제를 확인해요.",
    icon: Lightbulb,
  },
  {
    key: "method",
    eyebrow: "02 방법",
    title: "어떻게 확인했나요?",
    description: "자료와 분석 절차를 쉬운 문장으로 정리해요.",
    icon: FileSearch,
  },
  {
    key: "result",
    eyebrow: "03 결과",
    title: "무엇을 발견했나요?",
    description: "붙여 넣은 범위 안의 핵심 결과를 모아요.",
    icon: CheckCircle2,
  },
  {
    key: "limitations",
    eyebrow: "04 한계",
    title: "어디까지 믿어야 하나요?",
    description: "해석할 때 주의할 점과 빈틈을 남겨요.",
    icon: AlertTriangle,
  },
  {
    key: "questions",
    eyebrow: "05 질문",
    title: "교수님께 무엇을 물어볼까요?",
    description: "면담에서 바로 꺼낼 수 있는 질문을 준비해요.",
    icon: ListChecks,
  },
] as const;

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPaperAnalysisResult(value: unknown): value is PaperAnalysisResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return ["title", "oneLine", "background", "question", "generatedAt", "model"]
    .every((key) => typeof raw[key] === "string")
    && isStringList(raw.methods)
    && isStringList(raw.findings)
    && isStringList(raw.limitations)
    && isStringList(raw.nextQuestions)
    && Array.isArray(raw.glossary)
    && raw.glossary.every((item) => (
      Boolean(item)
      && typeof item === "object"
      && !Array.isArray(item)
      && typeof (item as Record<string, unknown>).term === "string"
      && typeof (item as Record<string, unknown>).meaning === "string"
    ));
}

function isBiteDraft(value: unknown): value is BiteDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return BITE_CARD_META.every((card) => typeof raw[card.key] === "string");
}

function readPaperBiteWorkingDraft(): StoredPaperBiteWorkingDraft | null {
  try {
    const stored = window.sessionStorage.getItem(PAPER_BITE_WORKING_DRAFT_STORAGE_KEY);
    if (!stored || stored.length > 100_000) return null;
    const parsed = JSON.parse(stored) as Partial<StoredPaperBiteWorkingDraft>;
    if (
      parsed.version !== 1
      || typeof parsed.title !== "string"
      || typeof parsed.content !== "string"
      || typeof parsed.sourceConfirmed !== "boolean"
      || !isPaperAnalysisResult(parsed.analysis)
      || !isBiteDraft(parsed.draft)
    ) return null;
    return {
      version: 1,
      title: parsed.title.slice(0, 180),
      content: parsed.content.slice(0, MAX_CONTENT_LENGTH),
      analysis: parsed.analysis,
      draft: parsed.draft,
      sourceConfirmed: parsed.sourceConfirmed,
    };
  } catch {
    return null;
  }
}

function writePaperBiteWorkingDraft(value: StoredPaperBiteWorkingDraft): void {
  try {
    window.sessionStorage.setItem(PAPER_BITE_WORKING_DRAFT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The explicit exit guard remains active when browser storage is unavailable.
  }
}

function clearPaperBiteWorkingDraft(): void {
  try {
    window.sessionStorage.removeItem(PAPER_BITE_WORKING_DRAFT_STORAGE_KEY);
  } catch {
    // A stale session-only draft is safer than deleting unrelated user data.
  }
}

const TEXT_SCOPE_EVIDENCE = {
  label: "사용자가 붙여 넣은 텍스트 범위 · 페이지 정보 없음",
  page: null,
  href: null,
} as const;

function createBiteDraft(result: PaperAnalysisResult): BiteDraft {
  return {
    problem: result.background,
    method: result.methods.join("\n"),
    result: result.findings.join("\n"),
    limitations: result.limitations.join("\n"),
    questions: [result.question, ...result.nextQuestions].filter(Boolean).join("\n"),
  };
}

function SelectedPaperBanner({
  selection,
  onChange,
  onClear,
}: {
  selection: ProfessorPaperSelection;
  onChange: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="selected-professor-paper">
      <div className="selected-professor-paper__icon">
        <BookOpen size={20} aria-hidden="true" />
      </div>
      <div className="selected-professor-paper__body">
        <div className="selected-professor-paper__meta">
          <Tag tone="mint">공식 프로필 서지정보</Tag>
          <span>{selection.professorName} 교수 · {selection.professorDepartment}</span>
        </div>
        <h2>{selection.title}</h2>
        <p>
          {selection.publicationType}
          {" · "}
          {selection.publishedDate ?? "발행일 미기재"}
        </p>
        <small>
          공식 교수 데이터의 논문입니다. 공개 초록 또는 허용된 오픈 라이선스 PDF가 있으면 자동으로 가져옵니다.
        </small>
        <div className="selected-professor-paper__actions">
          <a
            href={selection.officialProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            공식 프로필 확인 <ExternalLink size={13} aria-hidden="true" />
          </a>
          <button type="button" onClick={onChange}>다른 논문 선택</button>
          <button type="button" onClick={onClear}>선택 해제</button>
        </div>
      </div>
    </Card>
  );
}

function PaperContentLookupBanner({
  status,
  result,
  error,
  onRetry,
  onAcceptCandidate,
}: {
  status: "idle" | "loading" | "found" | "candidate" | "unavailable" | "error";
  result: ProfessorPaperContentResponse | null;
  error: string;
  onRetry: () => void;
  onAcceptCandidate: () => void;
}) {
  if (status === "idle") return null;
  const foundFromPdf = result?.status === "found" && result.contentSourceType === "pdf_text";
  const title = status === "loading"
    ? "등록된 논문의 공개 초록·PDF를 찾고 있어요"
    : status === "candidate"
      ? "관련 공개 논문 후보를 찾았어요"
    : status === "found"
      ? foundFromPdf
        ? "오픈 라이선스 PDF에서 텍스트를 가져왔어요"
        : "공개 초록을 자동으로 불러왔어요"
      : "자동으로 가져올 공개 원문을 찾지 못했어요";
  const description = status === "loading"
    ? "DOI를 먼저 확인하고, 없으면 제목과 발행일이 같은 논문만 검색합니다."
    : result?.message || error || "직접 입력하거나 잠시 후 다시 시도해 주세요.";
  const Icon = status === "loading"
    ? LoaderCircle
    : status === "found" ? CloudDownload : status === "candidate" ? FileSearch : AlertTriangle;

  return (
    <div
      className={`paper-content-lookup is-${status}`}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="paper-content-lookup__icon">
        <Icon size={19} className={status === "loading" ? "spin" : undefined} aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {status === "candidate" && result?.matchedTitle ? (
          <div className="paper-content-candidate">
            <strong>{result.matchedTitle}</strong>
            <small>
              {result.matchedPublishedDate ?? "발행일 미기재"}
              {result.matchedDoi ? ` · DOI ${result.matchedDoi}` : ""}
            </small>
            <em>현재 선택한 항목과 제목 또는 연도가 달라 아직 자동 입력하지 않았어요.</em>
          </div>
        ) : null}
        {status === "found" && result ? (
          <small>
            {result.provider === "openalex" ? "OpenAlex" : "Crossref"}
            {result.license ? ` · ${result.license.toUpperCase()}` : ""}
            {result.pageCount ? ` · ${result.pageCount}쪽 확인` : ""}
          </small>
        ) : null}
      </div>
      <div className="paper-content-lookup__actions">
        {result?.sourceUrl ? (
          <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
            출처 확인 <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : null}
        {(status === "unavailable" || status === "error") ? (
          <button type="button" onClick={onRetry}>
            <RotateCcw size={14} aria-hidden="true" /> 다시 찾기
          </button>
        ) : null}
        {status === "candidate" ? (
          <button type="button" className="is-primary" onClick={onAcceptCandidate}>
            <CheckCircle2 size={14} aria-hidden="true" /> 확인하고 불러오기
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PaperReaderShell({
  startFromFavorites = false,
  initialStep = startFromFavorites ? "select" : "card",
}: {
  startFromFavorites?: boolean;
  initialStep?: PaperBiteWorkflowStep;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<PaperAnalysisResult | null>(null);
  const [draft, setDraft] = useState<BiteDraft | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<PaperBiteWorkflowStep>(initialStep);
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const [paperValidationStatus, setPaperValidationStatus] = useState<
    "idle" | "validating" | "verified" | "error"
  >("idle");
  const [paperValidationError, setPaperValidationError] = useState("");
  const [paperValidationRetryKey, setPaperValidationRetryKey] = useState(0);
  const [paperContentStatus, setPaperContentStatus] = useState<
    "idle" | "loading" | "found" | "candidate" | "unavailable" | "error"
  >("idle");
  const [paperContentResult, setPaperContentResult] = useState<ProfessorPaperContentResponse | null>(null);
  const [paperContentError, setPaperContentError] = useState("");
  const [paperContentRetryKey, setPaperContentRetryKey] = useState(0);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const verifiedPaperKeyRef = useRef<string | null>(null);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const paperContentAbortControllerRef = useRef<AbortController | null>(null);
  const restoredWorkingDraftRef = useRef(false);
  const restoredWorkingDraftValueRef = useRef(false);
  const hasUnsavedDraft = Boolean(analysis && draft && !isSaved);

  const confirmDiscardUnsavedDraft = () => (
    !hasUnsavedDraft
    || window.confirm("저장하지 않은 논문 카드 수정 내용이 있어요. 저장하지 않고 이동할까요?")
  );

  const openPaperPicker = () => {
    if (!confirmDiscardUnsavedDraft()) return;
    setIsPickerOpen(true);
  };

  const discardAndNavigate = (href: string) => {
    if (!confirmDiscardUnsavedDraft()) return;
    clearPaperBiteWorkingDraft();
    router.replace(href);
  };

  useEffect(() => {
    if (restoredWorkingDraftRef.current) return;
    restoredWorkingDraftRef.current = true;
    const restored = readPaperBiteWorkingDraft();
    if (!restored) return;
    restoredWorkingDraftValueRef.current = true;
    setTitle(restored.title);
    setContent(restored.content);
    setAnalysis(restored.analysis);
    setDraft(restored.draft);
    setSourceConfirmed(restored.sourceConfirmed);
    setWorkflowStep("card");
    setFeedback("저장하지 않은 논문 카드 수정 내용을 복원했어요.");
  }, []);

  useEffect(() => {
    if (!hasUnsavedDraft || !analysis || !draft) return;
    writePaperBiteWorkingDraft({
      version: 1,
      title,
      content,
      analysis,
      draft,
      sourceConfirmed,
    });
  }, [analysis, content, draft, hasUnsavedDraft, sourceConfirmed, title]);

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedDraft]);

  const moveWorkflowStep = (nextStep: PaperBiteWorkflowStep) => {
    setWorkflowStep(nextStep);
    const sourceQuery = startFromFavorites ? "&source=favorites" : "";
    router.replace(`/paper/reader?mode=bite${sourceQuery}&step=${nextStep}`, { scroll: false });
  };

  const hasQuestHydrated = useQuestStore((state) => state.hasHydrated);
  const savePaperBundle = useQuestStore((state) => state.savePaperBundle);
  const hasResearchHydrated = useResearchStore((state) => state.hasHydrated);
  const selectedProfessorId = useResearchStore((state) => state.selectedProfessorId);
  const selectedTopicId = useResearchStore((state) => state.selectedTopicId);
  const favoriteProfessorIds = useResearchStore((state) => state.favoriteProfessorIds);
  const removeFavoriteProfessors = useResearchStore((state) => state.removeFavoriteProfessors);
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const selectProfessorPaper = useResearchStore((state) => state.selectProfessorPaper);
  const connectedProfessorIds = useMemo(
    () => Array.from(new Set([
      ...(selectedProfessorId ? [selectedProfessorId] : []),
      ...favoriteProfessorIds,
    ])),
    [favoriteProfessorIds, selectedProfessorId],
  );

  useEffect(() => {
    const selectionKey = selectedProfessorPaper
      ? `${selectedProfessorPaper.professorId}:${selectedProfessorPaper.paperId}`
      : null;
    if (
      !hasResearchHydrated
      || !selectedProfessorPaper
      || !selectionKey
      || verifiedPaperKeyRef.current === selectionKey
    ) {
      return;
    }

    const storedSelection = selectedProfessorPaper;
    const controller = new AbortController();
    let metadataMissing = false;
    setPaperValidationStatus("validating");
    setPaperValidationError("");
    void requestFavoriteProfessorPaperCatalog([storedSelection.professorId], {
      signal: controller.signal,
    })
      .then((response) => {
        const professor = response.professors.find(
          (item) => item.id === storedSelection.professorId,
        );
        const publication = professor?.publications.find(
          (item) => item.id === storedSelection.paperId,
        );
        if (!professor || !publication) {
          metadataMissing = true;
          throw new Error("저장된 논문이 최신 공식 프로필 목록에서 확인되지 않습니다.");
        }
        const verifiedSelection = createProfessorPaperSelection(professor, publication);
        verifiedPaperKeyRef.current = selectionKey;
        setPaperValidationStatus("verified");
        setPaperValidationError("");
        selectProfessorPaper({
          ...verifiedSelection,
          selectedAt: storedSelection.selectedAt,
          confirmedPublicPaper: storedSelection.confirmedPublicPaper ?? null,
        });
      })
      .catch((validationError) => {
        if (validationError instanceof DOMException && validationError.name === "AbortError") return;
        verifiedPaperKeyRef.current = null;
        const message = validationError instanceof Error
          ? validationError.message
          : "저장된 논문 정보를 확인하지 못했습니다.";
        if (metadataMissing) {
          selectProfessorPaper(null);
          setPaperValidationStatus("idle");
          setTitle("");
          setError(`${message} 교수님과 논문을 다시 선택해 주세요.`);
          return;
        }
        setPaperValidationStatus("error");
        setPaperValidationError(`${message} 저장된 선택은 유지했어요.`);
      });
    return () => controller.abort();
  }, [
    hasResearchHydrated,
    paperValidationRetryKey,
    selectProfessorPaper,
    selectedProfessorPaper,
  ]);

  useEffect(() => {
    if (
      hasResearchHydrated
      && selectedProfessorPaper
      && paperValidationStatus === "verified"
      && !title
      && !analysis
    ) {
      setTitle(selectedProfessorPaper.title);
    }
  }, [
    analysis,
    hasResearchHydrated,
    paperValidationStatus,
    selectedProfessorPaper,
    title,
  ]);

  useEffect(() => () => {
    analysisAbortControllerRef.current?.abort();
    paperContentAbortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!restoredWorkingDraftValueRef.current) setWorkflowStep(initialStep);
  }, [initialStep]);

  const verifiedProfessorPaper = paperValidationStatus === "verified"
    ? selectedProfessorPaper
    : null;

  useEffect(() => {
    if (analysis && draft) {
      paperContentAbortControllerRef.current?.abort();
      paperContentAbortControllerRef.current = null;
      setPaperContentStatus("idle");
      setPaperContentResult(null);
      setPaperContentError("");
      return;
    }
    if (!verifiedProfessorPaper || workflowStep !== "card") {
      paperContentAbortControllerRef.current?.abort();
      paperContentAbortControllerRef.current = null;
      setPaperContentStatus("idle");
      setPaperContentResult(null);
      setPaperContentError("");
      return;
    }

    paperContentAbortControllerRef.current?.abort();
    const controller = new AbortController();
    paperContentAbortControllerRef.current = controller;
    setPaperContentStatus("loading");
    setPaperContentResult(null);
    setPaperContentError("");

    void requestProfessorPaperContent({
      professorId: verifiedProfessorPaper.professorId,
      paperId: verifiedProfessorPaper.paperId,
    }, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPaperContentResult(result);
        setPaperContentStatus(result.status);
        if (result.status === "found" && result.content) {
          setContent(result.content.slice(0, MAX_CONTENT_LENGTH));
          setSourceConfirmed(true);
          setError("");
        } else {
          setSourceConfirmed(false);
        }
      })
      .catch((lookupError) => {
        if (lookupError instanceof DOMException && lookupError.name === "AbortError") return;
        setPaperContentStatus("error");
        setPaperContentResult(null);
        setPaperContentError(
          lookupError instanceof Error
            ? lookupError.message
            : "공개 초록과 PDF를 자동으로 찾지 못했습니다.",
        );
        setSourceConfirmed(false);
      })
      .finally(() => {
        if (paperContentAbortControllerRef.current === controller) {
          paperContentAbortControllerRef.current = null;
        }
      });

    return () => controller.abort();
  }, [
    analysis,
    draft,
    paperContentRetryKey,
    verifiedProfessorPaper?.paperId,
    verifiedProfessorPaper?.professorId,
    workflowStep,
  ]);
  const isPaperSelectionBlocked = Boolean(
    selectedProfessorPaper && !verifiedProfessorPaper,
  );
  const normalizedLength = content.trim().length;
  const isReady = normalizedLength >= MIN_CONTENT_LENGTH;
  const displayTitle = paperContentResult?.status === "found" && paperContentResult.matchedTitle
    ? paperContentResult.matchedTitle
    : verifiedProfessorPaper?.title || analysis?.title || title.trim() || "제목 미입력 논문";
  const evidence = useMemo(() => {
    if (!verifiedProfessorPaper) return TEXT_SCOPE_EVIDENCE;
    if (paperContentResult?.status === "found") {
      const sourceLabel = paperContentResult.contentSourceType === "pdf_text"
        ? `${paperContentResult.license?.toUpperCase() ?? "오픈"} 공개 PDF에서 자동 추출한 텍스트`
        : "공개 학술 메타데이터에서 자동 불러온 초록";
      return {
        label: paperContentResult.matchedBy === "related-title"
          ? `분석 근거: 사용자가 확인한 관련 공개 논문의 ${sourceLabel} · 출발 서지: 대학 공식 프로필`
          : `분석 근거: ${sourceLabel} · 서지 확인: 대학 공식 프로필`,
        page: null,
        href: paperContentResult.sourceUrl ?? verifiedProfessorPaper.officialProfileUrl,
      };
    }
    return {
      label: "분석 근거: 사용자가 확인하고 입력한 초록·본문 범위(페이지 없음) · 서지 확인: 대학 공식 프로필",
      page: null,
      href: verifiedProfessorPaper.officialProfileUrl,
    };
  }, [paperContentResult, verifiedProfessorPaper]);
  const fullCopy = useMemo(() => {
    if (!analysis || !draft) return "";
    return [
      `논문 한입 · ${displayTitle}`,
      verifiedProfessorPaper
        ? `${verifiedProfessorPaper.professorName} 교수 · ${verifiedProfessorPaper.professorDepartment}`
        : null,
      analysis.oneLine,
      ...BITE_CARD_META.map((card) => `${card.eyebrow} ${card.title}\n${draft[card.key]}`),
      `근거 범위\n${evidence.label}`,
    ].filter(Boolean).join("\n\n");
  }, [analysis, displayTitle, draft, evidence.label, verifiedProfessorPaper]);

  const analyze = async () => {
    const normalized = content.trim();
    if (normalized.length < MIN_CONTENT_LENGTH) {
      setError(`논문 초록이나 본문 일부를 ${MIN_CONTENT_LENGTH}자 이상 입력해 주세요.`);
      return;
    }
    if (verifiedProfessorPaper && !sourceConfirmed) {
      setError("붙여 넣은 텍스트가 선택한 논문의 초록 또는 본문인지 먼저 확인해 주세요.");
      return;
    }

    setError("");
    setFeedback("");
    setIsSaved(false);
    setIsLoading(true);
    analysisAbortControllerRef.current?.abort();
    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;
    try {
      const nextAnalysis = await requestPaperAnalysis({
        title: title.trim(),
        content: normalized,
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAnalysis(nextAnalysis);
      setDraft(createBiteDraft(nextAnalysis));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "논문 분석을 완료하지 못했습니다.",
      );
    } finally {
      if (analysisAbortControllerRef.current === controller) {
        analysisAbortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const updateDraft = (key: BiteCardKey, value: string) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setIsSaved(false);
    setFeedback("");
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(successMessage);
    } catch {
      setFeedback("복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.");
    }
  };

  const saveToQuest = () => {
    if (!analysis || !draft || !hasQuestHydrated) return;

    const bundleId = verifiedProfessorPaper
      ? `paper:${verifiedProfessorPaper.professorId}:${verifiedProfessorPaper.paperId}`
      : `manual:${analysis.generatedAt}`;
    try {
      savePaperBundle({
        bundleId,
        evidence,
        professorId: verifiedProfessorPaper?.professorId ?? selectedProfessorId,
        topicId: selectedTopicId,
        paperId: verifiedProfessorPaper?.paperId ?? null,
        cards: BITE_CARD_META.map((card) => ({
          slot: card.key,
          title: `${card.eyebrow} · ${displayTitle}`,
          body: draft[card.key].trim() || "아직 작성된 내용이 없어요.",
        })),
      });
      clearPaperBiteWorkingDraft();
      setIsSaved(true);
      setFeedback("교수님 퀘스트에 3분 준비 카드 5장을 저장했어요. 같은 논문은 최신 내용으로 갱신됩니다.");
    } catch {
      setIsSaved(false);
      setFeedback(
        "브라우저 저장 공간에 기록하지 못했어요. 전체 복사로 내용을 보관한 뒤 저장 공간 설정을 확인해 주세요.",
      );
    }
  };

  const clearWorkingState = () => {
    analysisAbortControllerRef.current?.abort();
    analysisAbortControllerRef.current = null;
    paperContentAbortControllerRef.current?.abort();
    paperContentAbortControllerRef.current = null;
    setIsLoading(false);
    setContent("");
    setAnalysis(null);
    setDraft(null);
    setError("");
    setFeedback("");
    setIsSaved(false);
    setSourceConfirmed(false);
    setPaperContentStatus("idle");
    setPaperContentResult(null);
    setPaperContentError("");
    clearPaperBiteWorkingDraft();
  };

  const acceptRelatedCandidate = () => {
    if (
      paperContentResult?.status !== "candidate"
      || !paperContentResult.content
      || !paperContentResult.matchedTitle
    ) return;
    setPaperContentResult({
      ...paperContentResult,
      status: "found",
      message: "관련 공개 논문의 제목·연도·DOI를 확인해 초록을 불러왔습니다.",
    });
    setPaperContentStatus("found");
    if (verifiedProfessorPaper && paperContentResult.relatedOfficialPaper) {
      selectProfessorPaper({
        ...verifiedProfessorPaper,
        confirmedPublicPaper: {
          officialPaperId: paperContentResult.relatedOfficialPaper.id,
          title: paperContentResult.matchedTitle,
          publishedDate: paperContentResult.matchedPublishedDate,
          doi: paperContentResult.matchedDoi,
          sourceUrl: paperContentResult.sourceUrl,
          license: paperContentResult.license,
          confirmedAt: new Date().toISOString(),
        },
      });
    }
    setTitle(paperContentResult.matchedTitle.slice(0, 180));
    setContent(paperContentResult.content.slice(0, MAX_CONTENT_LENGTH));
    setSourceConfirmed(true);
    setError("");
    setFeedback("관련 공개 논문을 확인해 초록을 입력했습니다.");
    window.requestAnimationFrame(() => contentRef.current?.focus());
  };

  const choosePaper = (selection: ProfessorPaperSelection) => {
    verifiedPaperKeyRef.current = `${selection.professorId}:${selection.paperId}`;
    setPaperValidationStatus("verified");
    setPaperValidationError("");
    selectProfessorPaper(selection);
    setTitle(selection.title);
    clearWorkingState();
    setIsPickerOpen(false);
    moveWorkflowStep("card");
    window.requestAnimationFrame(() => contentRef.current?.focus());
  };

  const useManualEntry = () => {
    verifiedPaperKeyRef.current = null;
    setPaperValidationStatus("idle");
    setPaperValidationError("");
    selectProfessorPaper(null);
    setTitle("");
    clearWorkingState();
    setIsPickerOpen(false);
    moveWorkflowStep("card");
    window.requestAnimationFrame(() => titleRef.current?.focus());
  };

  const clearPaperSelection = () => {
    if (!confirmDiscardUnsavedDraft()) return;
    verifiedPaperKeyRef.current = null;
    setPaperValidationStatus("idle");
    setPaperValidationError("");
    selectProfessorPaper(null);
    setTitle("");
    clearWorkingState();
    moveWorkflowStep("select");
  };

  const clearInput = () => {
    setContent("");
    setError("");
    setFeedback("");
    setIsSaved(false);
    setSourceConfirmed(false);
    contentRef.current?.focus();
  };

  const paperPicker = (
    <FavoriteProfessorPaperPicker
      open={isPickerOpen}
      favoriteProfessorIds={connectedProfessorIds}
      initialProfessorId={verifiedProfessorPaper?.professorId ?? selectedProfessorId}
      onClose={() => setIsPickerOpen(false)}
      onManualEntry={useManualEntry}
      onRemoveMissing={removeFavoriteProfessors}
      onSelect={choosePaper}
    />
  );

  if (analysis && draft) {
    return (
      <AppShell title="Q01 논문 한입" onBack={() => discardAndNavigate("/quest")} className="paper-bite-screen">
        <PageHeader
          eyebrow="교수님 퀘스트 · 만나기 전"
          title={displayTitle}
          description={analysis.oneLine}
        />
        <PaperReadingSteps current={2} navigationLocked={hasUnsavedDraft} />

        {verifiedProfessorPaper && (
          <SelectedPaperBanner
            selection={verifiedProfessorPaper}
            onChange={openPaperPicker}
            onClear={clearPaperSelection}
          />
        )}

        <StatusBanner icon={CheckCircle2} title="붙여 넣은 텍스트 분석 완료" tone="success">
          PDF 전체가 아니라 입력한 범위만 분석했습니다. 페이지 번호와 원문 위치는 확인할 수 없어요.
        </StatusBanner>

        <div className="paper-bite-meta">
          <Tag tone="violet">3분 카드 5장</Tag>
          <span>{new Date(analysis.generatedAt).toLocaleString("ko-KR")}</span>
          <span>{analysis.model}</span>
        </div>

        <SectionHeading
          title="교수님께 가져갈 논문 한입"
          description="원문과 함께 보며 핵심을 내 말로 다듬어 저장하세요."
        />

        <div className="paper-bite-grid">
          {BITE_CARD_META.map((card) => {
            const Icon = card.icon;
            return (
              <Card className="paper-bite-card" key={card.key}>
                <div className="paper-bite-card__heading">
                  <span><Icon size={19} aria-hidden="true" /></span>
                  <div>
                    <small>{card.eyebrow}</small>
                    <h2>{card.title}</h2>
                    <p>{card.description}</p>
                  </div>
                </div>
                <label htmlFor={`paper-bite-${card.key}`}>
                  <span className="sr-only">{card.title} 내용 편집</span>
                  <textarea
                    id={`paper-bite-${card.key}`}
                    className="textarea paper-bite-card__editor"
                    value={draft[card.key]}
                    onChange={(event) => updateDraft(card.key, event.target.value)}
                    rows={7}
                  />
                </label>
                <TextButton
                  type="button"
                  onClick={() => void copyText(draft[card.key], `${card.eyebrow} 카드를 복사했어요.`)}
                >
                  <Copy size={15} aria-hidden="true" /> 이 카드 복사
                </TextButton>
              </Card>
            );
          })}
        </div>

        <Card className="paper-bite-evidence">
          <ShieldCheck size={21} aria-hidden="true" />
          <div>
            <h2>근거 범위</h2>
            <p>{evidence.label}</p>
            <small>
              원문 문장과 페이지를 함께 적어두면 인용·제출·면담 준비에 활용할 수 있어요.
            </small>
          </div>
        </Card>

        <div className="paper-bite-actions">
          <SecondaryButton type="button" onClick={openPaperPicker}>
            <RotateCcw size={17} aria-hidden="true" /> 다른 논문
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void copyText(fullCopy, "카드 5장을 모두 복사했어요.")}>
            <Clipboard size={17} aria-hidden="true" /> 전체 복사
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={saveToQuest}
            disabled={!hasQuestHydrated || isSaved}
          >
            {isSaved
              ? <><CheckCircle2 size={17} aria-hidden="true" /> 저장 완료</>
              : <><Save size={17} aria-hidden="true" /> 퀘스트에 저장</>}
          </PrimaryButton>
        </div>

        {!hasQuestHydrated && (
          <p className="paper-bite-hydration" role="status">
            저장 공간을 불러오는 중이에요. 잠시 후 저장 버튼이 활성화됩니다.
          </p>
        )}
        {feedback && (
          <p
            className={`action-feedback${feedback.includes("못했") ? " is-error" : ""}`}
            role={feedback.includes("못했") ? "alert" : "status"}
          >
            {feedback}
          </p>
        )}

        <PaperPdfNextStep ready={isSaved} />
        {paperPicker}
      </AppShell>
    );
  }

  return (
    <AppShell title="Q01 논문 한입" backHref="/quest" className="paper-bite-screen">
      <PageHeader
        eyebrow="교수님 퀘스트 · 만나기 전"
        title={workflowStep === "select" ? "읽을 논문 한 편을 고르세요" : "초록이나 본문을 3분 카드로 정리해요"}
        description={workflowStep === "select"
          ? "관심 교수님의 공식 논문 목록에서 준비할 한 편만 선택해요."
          : "선택한 논문의 초록이나 본문을 붙여 넣으면 문제·방법·결과·한계·질문으로 나눠드려요."}
      />
      <PaperReadingSteps current={workflowStep === "select" ? 1 : 2} />

      {paperValidationStatus === "validating" && (
        <StatusBanner icon={LoaderCircle} title="저장된 논문을 공식 데이터로 다시 확인하는 중" tone="lavender">
          교수님과 논문의 연결을 확인한 뒤 제목을 채웁니다.
        </StatusBanner>
      )}

      {paperValidationStatus === "error" && (
        <Card className="paper-validation-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <h2>공식 서지정보를 다시 확인하지 못했어요</h2>
            <p>{paperValidationError}</p>
            <div>
              <button
                type="button"
                onClick={() => setPaperValidationRetryKey((current) => current + 1)}
              >
                다시 확인
              </button>
              <button type="button" onClick={() => setIsPickerOpen(true)}>논문 다시 선택</button>
              <button type="button" onClick={useManualEntry}>직접 입력으로 전환</button>
            </div>
          </div>
        </Card>
      )}

      {workflowStep === "select" ? (
        <>
          <Card className="paper-favorite-entry paper-bite-stage-card">
            <div>
              <Star size={20} fill="currentColor" aria-hidden="true" />
              <span>
                <strong>관심 교수님의 공식 논문 목록</strong>
                <small>
                  {hasResearchHydrated
                    ? `연결·저장한 교수님 ${connectedProfessorIds.length}명에서 찾아요.`
                    : "교수님 목록을 불러오는 중이에요."}
                </small>
              </span>
            </div>
            {verifiedProfessorPaper ? (
              <SecondaryButton
                type="button"
                disabled={!hasResearchHydrated || isLoading}
                onClick={() => setIsPickerOpen(true)}
              >
                <BookOpen size={17} aria-hidden="true" /> 다른 논문 선택
              </SecondaryButton>
            ) : (
              <PrimaryButton
                type="button"
                disabled={!hasResearchHydrated || isLoading}
                onClick={() => setIsPickerOpen(true)}
              >
                <BookOpen size={17} aria-hidden="true" /> 논문 1개 선택하기
              </PrimaryButton>
            )}
          </Card>

          {verifiedProfessorPaper ? (
            <>
              <SelectedPaperBanner
                selection={verifiedProfessorPaper}
                onChange={() => setIsPickerOpen(true)}
                onClear={clearPaperSelection}
              />
              <div className="paper-bite-stage-actions">
                <PrimaryButton type="button" onClick={() => moveWorkflowStep("card")}>
                  이 논문으로 3분 카드 만들기
                </PrimaryButton>
              </div>
            </>
          ) : null}

          <div className="paper-bite-manual-entry">
            <TextButton type="button" onClick={useManualEntry}>
              목록에 없는 논문은 제목·본문을 직접 입력할게요
            </TextButton>
          </div>
        </>
      ) : (
        <>
          <div className="paper-bite-step-back">
            <TextButton type="button" onClick={() => moveWorkflowStep("select")}>
              <ArrowLeft size={16} aria-hidden="true" /> 논문 선택으로
            </TextButton>
          </div>

          {verifiedProfessorPaper && (
            <SelectedPaperBanner
              selection={verifiedProfessorPaper}
              onChange={() => setIsPickerOpen(true)}
              onClear={clearPaperSelection}
            />
          )}

          <Card className="paper-input-card paper-bite-input">
            <label className="field-group" htmlFor="paper-title">
              <span className="field-label">
                논문 제목 <small>
                  {paperContentResult?.status === "found" && paperContentResult.matchedBy === "related-title"
                    ? "확인한 관련 공개 논문"
                    : verifiedProfessorPaper ? "공식 정보로 고정" : "직접 입력"}
                </small>
              </span>
              <input
                ref={titleRef}
                id="paper-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 180))}
                readOnly={Boolean(verifiedProfessorPaper)}
                disabled={isPaperSelectionBlocked || isLoading}
                placeholder="예: 대학생의 진로 불안과 멘토링 효과"
              />
            </label>
            {verifiedProfessorPaper ? (
              <PaperContentLookupBanner
                status={paperContentStatus}
                result={paperContentResult}
                error={paperContentError}
                onRetry={() => setPaperContentRetryKey((current) => current + 1)}
                onAcceptCandidate={acceptRelatedCandidate}
              />
            ) : null}
            <label className="field-group" htmlFor="paper-content">
              <span className="field-label">
                초록 또는 본문
                <small>
                  {paperContentResult?.status === "found"
                    ? paperContentResult.contentSourceType === "pdf_text"
                      ? "공개 PDF 자동 입력"
                      : "공개 초록 자동 입력"
                    : verifiedProfessorPaper
                      ? "자동 조회 후 직접 입력 가능"
                      : "직접 입력"}
                </small>
              </span>
              <textarea
                ref={contentRef}
                id="paper-content"
                className="textarea paper-input"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value.slice(0, MAX_CONTENT_LENGTH));
                  if (paperContentResult?.status !== "found") {
                    setSourceConfirmed(false);
                  }
                }}
                disabled={isPaperSelectionBlocked || isLoading || paperContentStatus === "loading"}
                placeholder={verifiedProfessorPaper
                  ? "공개 초록이나 허용된 PDF가 없으면 논문 내용을 직접 붙여 넣어 주세요."
                  : "분석할 논문 초록이나 본문 일부를 붙여 넣어 주세요."}
              />
            </label>
            {verifiedProfessorPaper && !sourceConfirmed && (
              <label className="paper-source-confirm">
                <input
                  type="checkbox"
                  checked={sourceConfirmed}
                  onChange={(event) => setSourceConfirmed(event.target.checked)}
                />
                <span>현재 텍스트가 선택한 논문의 초록 또는 본문임을 확인했습니다.</span>
              </label>
            )}
            <div className="paper-input-meta">
              <span className={isReady ? "is-ready" : ""}>
                {content.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}자
              </span>
              <small>최소 {MIN_CONTENT_LENGTH}자</small>
            </div>
            {error && <p className="field-error" role="alert">{error}</p>}
            <PrimaryButton
              type="button"
              onClick={analyze}
              disabled={
                isLoading
                || paperContentStatus === "loading"
                || isPaperSelectionBlocked
                || !isReady
                || Boolean(verifiedProfessorPaper && !sourceConfirmed)
              }
            >
              {isLoading
                ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> 논문 한입 만드는 중</>
                : <><FileSearch size={18} aria-hidden="true" /> 3분 카드 만들기</>}
            </PrimaryButton>
          </Card>

          <div className="paper-privacy">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              자동으로 가져온 공개 초록·PDF 텍스트와 직접 입력한 내용은 분석 요청을 위해
              OpenAI API로 전송됩니다. PDF 원본은 저장하지 않으며, 미공개 논문·개인정보·연구실 내부 자료는 넣지 마세요.
            </p>
          </div>

          {content && !isLoading && (
            <div className="context-actions">
              <TextButton type="button" onClick={clearInput}>
                <RotateCcw size={16} aria-hidden="true" /> 입력 지우기
              </TextButton>
            </div>
          )}
        </>
      )}

      {paperPicker}
    </AppShell>
  );
}

function PaperPdfNextStep({ ready }: { ready: boolean }) {
  return (
    <section className="paper-bite-pdf-next" aria-labelledby="paper-pdf-next-title">
      <div className="paper-bite-pdf-next__copy">
        <span><BookOpen size={20} aria-hidden="true" /></span>
        <div>
          <small>다음 준비 선택</small>
          <h2 id="paper-pdf-next-title">첫 질문을 고르거나 PDF를 더 읽어보세요</h2>
          <p>논문 읽기는 선택입니다. 바로 첫 질문을 준비하거나, PDF 원문을 더 읽은 뒤 이어갈 수 있어요.</p>
        </div>
      </div>
      <div className="paper-bite-next-actions">
        {ready ? (
          <>
            <LinkButton href={FIRST_QUESTION_FROM_PAPER_HREF}>
              4단계 · 목적별 첫 질문 고르기
            </LinkButton>
            <LinkButton href="/paper/reader?mode=pdf&from=card" secondary>
              PDF 해설 더 보기 · 선택
            </LinkButton>
          </>
        ) : (
          <>
            <PrimaryButton type="button" disabled>
              첫 질문은 카드 저장 후 이용
            </PrimaryButton>
            <SecondaryButton type="button" disabled>
              PDF 해설은 카드 저장 후 이용
            </SecondaryButton>
          </>
        )}
      </div>
      <small className="paper-bite-pdf-next__note">
        PDF를 사용하지 않아도 진로·연구·프로젝트·멘토링 목적의 첫 질문과 메일을 작성할 수 있어요.
      </small>
    </section>
  );
}

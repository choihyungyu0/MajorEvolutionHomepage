"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  CircleAlert,
  CircleCheck,
  CloudDownload,
  Download,
  FileImage,
  FileText,
  HelpCircle,
  Languages,
  LoaderCircle,
  MessageSquareQuote,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  AppShell,
  Card,
  ChoiceChip,
  LinkButton,
  PrimaryButton,
  SecondaryButton,
  Tag,
} from "@/components/app/primitives";
import { PaperReadingSteps } from "@/components/paper-reader/paper-reading-steps";
import { FIRST_QUESTION_FROM_PAPER_HREF } from "@/lib/email-draft-purpose";
import {
  extractPdfText,
  PdfReadError,
  renderPdfPage,
  type PdfDocument,
  type RenderedPage,
} from "@/lib/pdf-text";
import { requestPaperAssistStream, type PaperReaderAssist } from "@/lib/paper-reader-client";
import { requestProfessorPaperPdf } from "@/lib/professor-paper-pdf-client";
import { useQuestContext } from "@/lib/quest-context";
import { useQuestStore, type SavedQuestCard } from "@/store/quest-store";
import { useResearchStore } from "@/store/research-store";

/**
 * 논문 리더 (F14~F19).
 *
 * PDF는 학생 기기에서만 열고, AI 요청에는 지금 보고 있는 페이지 텍스트만 실어 보냅니다.
 * 모든 결과에는 페이지 근거를 붙이고, 근거가 없으면 만들지 않고 없다고 알립니다.
 */

type TabId = "original" | "translation" | "summary" | "qa" | "figure" | "notes";

const TABS: Array<{ id: TabId; label: string; icon: typeof BookOpen }> = [
  { id: "original", label: "원문", icon: BookOpen },
  { id: "translation", label: "번역", icon: Languages },
  { id: "summary", label: "요약", icon: FileText },
  { id: "qa", label: "질문", icon: HelpCircle },
  { id: "figure", label: "그림·표", icon: FileImage },
  { id: "notes", label: "메모", icon: MessageSquareQuote },
];

const NOTE_KINDS = ["요약", "질문", "그림·표"] as const;
type NoteKind = (typeof NOTE_KINDS)[number];

type QaTurn = { question: string; assist: PaperReaderAssist };

export function PaperReader({ backHref = "/quest" }: { backHref?: string }) {
  const { topic, match } = useQuestContext();
  const saveCard = useQuestStore((state) => state.saveCard);
  const deleteCard = useQuestStore((state) => state.deleteCard);
  const cards = useQuestStore((state) => state.cards);
  const selectedProfessorPaper = useResearchStore((state) => state.selectedProfessorPaper);
  const emailNextAction = (
    <LinkButton href={FIRST_QUESTION_FROM_PAPER_HREF}>
      4단계 · 목적별 첫 질문 고르기 <ArrowRight size={17} aria-hidden="true" />
    </LinkButton>
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publicPdfLoading, setPublicPdfLoading] = useState(false);
  const [publicPdfSourceUrl, setPublicPdfSourceUrl] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>("original");
  const [pageNo, setPageNo] = useState(1);
  const [selected, setSelected] = useState<{ page: number; text: string } | null>(null);

  /** 현재 페이지를 그린 이미지. 원문 탭 표시와 그림·표 비전 입력에 함께 씁니다. */
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const [renderError, setRenderError] = useState(false);
  const [busy, setBusy] = useState<TabId | "simplify" | null>(null);
  const [streaming, setStreaming] = useState("");
  const [assistError, setAssistError] = useState<string | null>(null);
  const [translation, setTranslation] = useState<PaperReaderAssist | null>(null);
  const [summary, setSummary] = useState<PaperReaderAssist | null>(null);
  const [figure, setFigure] = useState<PaperReaderAssist | null>(null);
  const [simplified, setSimplified] = useState<PaperReaderAssist | null>(null);
  const [qaTurns, setQaTurns] = useState<QaTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [noteFilter, setNoteFilter] = useState<NoteKind | "전체">("전체");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const page = doc?.pages.find((p) => p.page === pageNo) ?? null;
  const notes = useMemo(
    () => cards.filter((card) => card.tool === "paper-bite"),
    [cards],
  );
  const visibleNotes = noteFilter === "전체"
    ? notes
    : notes.filter((note) => note.title.startsWith(noteFilter));

  const openFile = async (file: File, sourceUrl: string | null = null) => {
    setLoading(true);
    setLoadError(null);
    setTranslation(null); setSummary(null); setFigure(null); setSimplified(null); setQaTurns([]);
    try {
      const parsed = await extractPdfText(file);
      setDoc(parsed);
      setPublicPdfSourceUrl(sourceUrl);
      setPageNo(1);
      setSelected(null);
    } catch (error) {
      setDoc(null);
      setLoadError(error instanceof PdfReadError
        ? error.message
        : "PDF를 읽지 못했습니다. 다른 파일로 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const openPublicPdf = async () => {
    if (!selectedProfessorPaper) return;
    setPublicPdfLoading(true);
    setLoadError(null);
    try {
      const result = await requestProfessorPaperPdf({
        professorId: selectedProfessorPaper.professorId,
        paperId: selectedProfessorPaper.paperId,
        relatedPaperId: selectedProfessorPaper.confirmedPublicPaper?.officialPaperId ?? null,
      });
      await openFile(result.file, result.sourceUrl || null);
    } catch (error) {
      setLoadError(error instanceof Error
        ? error.message
        : "공개 PDF를 자동으로 열지 못했습니다. 직접 업로드해 주세요.");
    } finally {
      setPublicPdfLoading(false);
    }
  };

  const runAssist = async (
    task: "translate" | "qa" | "figure" | "simplify",
    target: TabId | "simplify",
    pages: Array<{ page: number; text: string }>,
    focus?: string,
    pageImage?: string,
  ): Promise<PaperReaderAssist | null> => {
    setBusy(target);
    setAssistError(null);
    setStreaming("");
    try {
      // 글자가 오는 대로 먼저 보여주고, 검증된 결과는 끝에서 받습니다.
      return await requestPaperAssistStream(task, pages, focus, (delta) => {
        setStreaming((current) => current + delta);
      }, pageImage);
    } catch (error) {
      setAssistError(error instanceof Error ? error.message : "요청을 완료하지 못했습니다.");
      return null;
    } finally {
      setBusy(null);
      setStreaming("");
    }
  };

  /** 스트리밍 중 화면에 먼저 뜨는 글. 완료되면 검증된 결과로 교체됩니다. */
  const StreamingAnswer = () => (
    <Card className="reader-assist reader-assist--streaming">
      <p className="reader-body">
        {streaming}
        <span className="reader-caret" aria-hidden="true" />
      </p>
      <p className="reader-busy"><LoaderCircle className="spin" size={14} /> 받아쓰는 중…</p>
    </Card>
  );

  const saveNote = (kind: NoteKind, body: string, evidencePage: number | null) => {
    if (!body.trim() || !doc) return;
    saveCard({
      tool: "paper-bite",
      title: `${kind} · ${doc.fileName}`,
      body: body.trim(),
      evidence: { label: doc.fileName, page: evidencePage, href: publicPdfSourceUrl },
      professorId: selectedProfessorPaper?.professorId ?? match?.professor.id ?? null,
      topicId: topic?.id ?? null,
      paperId: selectedProfessorPaper?.paperId ?? null,
    });
  };

  const exportNotes = () => {
    const lines = visibleNotes.map((note) =>
      `## ${note.title}\n\n${note.body}\n\n근거: ${note.evidence?.label ?? "-"}${note.evidence?.page ? ` p.${note.evidence.page}` : ""}`);
    const blob = new Blob([`# 분석 메모\n\n${lines.join("\n\n---\n\n")}\n`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `분석메모-${doc?.fileName ?? "논문"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 페이지가 바뀌면 원본 레이아웃을 다시 그립니다. 실패해도 텍스트 읽기는 계속됩니다.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setRendered(null);
    setRenderError(false);
    renderPdfPage(doc.bytes, pageNo, 1.6)
      .then((image) => { if (!cancelled) setRendered(image); })
      .catch((error) => {
        console.error("[reader] page render failed", error);
        if (!cancelled) setRenderError(true);
      });
    return () => { cancelled = true; };
  }, [doc, pageNo]);

  const toggleChecked = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ── 업로드 전 ───────────────────────────────────────────────
  if (!doc) {
    return (
      <AppShell
        title="논문 리더"
        backHref={backHref}
        className="reader-screen"
        stickyAction={emailNextAction}
      >
        <PaperReadingSteps current={3} />
        <Card className="reader-drop">
          <Upload size={30} aria-hidden="true" />
          <h1>PDF를 넣고 논문을 해설·요약해요</h1>
          <p>
            파일은 이 브라우저에서 열고, AI에는 현재 확인 중인 페이지와 앞뒤 페이지 내용만 보냅니다.
          </p>
          {selectedProfessorPaper ? (
            <div className="reader-selected-paper">
              <small>앞에서 선택한 논문</small>
              <strong>{selectedProfessorPaper.title}</strong>
              <span>
                {selectedProfessorPaper.confirmedPublicPaper
                  ? `확인한 공개 논문 · ${selectedProfessorPaper.confirmedPublicPaper.title}`
                  : `${selectedProfessorPaper.professorName} 교수 · 공개 PDF가 확인되면 자동으로 열 수 있어요.`}
              </span>
            </div>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void openFile(file, null);
            }}
          />
          {selectedProfessorPaper ? (
            <div className="reader-drop__actions">
              <PrimaryButton onClick={() => void openPublicPdf()} disabled={loading || publicPdfLoading}>
                {publicPdfLoading
                  ? <><LoaderCircle className="spin" size={17} /> 공개 PDF 확인 중…</>
                  : <><CloudDownload size={17} /> 공개 PDF 자동 열기</>}
              </PrimaryButton>
              <SecondaryButton onClick={() => fileInput.current?.click()} disabled={loading || publicPdfLoading}>
                {loading
                  ? <><LoaderCircle className="spin" size={17} /> PDF 읽는 중…</>
                  : <><Upload size={17} /> PDF 직접 선택</>}
              </SecondaryButton>
              <small>공개 라이선스·10MB 이하·검증된 PDF만 자동으로 열며 파일은 저장하지 않아요.</small>
            </div>
          ) : (
            <PrimaryButton onClick={() => fileInput.current?.click()} disabled={loading}>
              {loading
                ? <><LoaderCircle className="spin" size={17} /> PDF 읽는 중…</>
                : <><Upload size={17} /> PDF 넣고 페이지별 해설·요약 시작</>}
            </PrimaryButton>
          )}
          {loadError && (
            <p className="reader-drop__error" role="alert"><CircleAlert size={15} /> {loadError}</p>
          )}
        </Card>
      </AppShell>
    );
  }

  // ── 리더 ────────────────────────────────────────────────────
  return (
    <AppShell
      title="논문 리더"
      backHref={backHref}
      className="reader-screen"
      stickyAction={emailNextAction}
    >
      <PaperReadingSteps current={3} />
      <div className="reader-file">
        <FileText size={20} aria-hidden="true" />
        <div>
          <strong>{doc.fileName}</strong>
          <small>읽기 완료 · PDF {doc.pageCount}p</small>
          {publicPdfSourceUrl ? (
            <a href={publicPdfSourceUrl} target="_blank" rel="noopener noreferrer">공개 원문 출처</a>
          ) : null}
        </div>
        <span className="reader-file__status"><CircleCheck size={15} /> 텍스트 추출 완료</span>
        <button type="button" aria-label="다른 파일 열기" onClick={() => {
          setDoc(null);
          setPublicPdfSourceUrl(null);
        }}>
          <X size={17} />
        </button>
      </div>

      <div className="reader-tabs" role="tablist" aria-label="논문 리더 보기 방식">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} aria-hidden="true" /> {item.label}
            </button>
          );
        })}
      </div>

      {assistError && (
        <p className="reader-error" role="alert"><CircleAlert size={15} /> {assistError}</p>
      )}

      {tab === "original" && (
        <div className="reader-work">
          <aside className="reader-thumbs" aria-label="페이지 목록">
            {doc.pages.map((p) => (
              <button
                key={p.page}
                type="button"
                className={p.page === pageNo ? "is-active" : undefined}
                onClick={() => setPageNo(p.page)}
              >
                {p.page}
              </button>
            ))}
          </aside>

          <section className="reader-page">
            <header>
              <span>{pageNo} / {doc.pageCount}</span>
              <div>
                <button type="button" disabled={pageNo <= 1} onClick={() => setPageNo((n) => n - 1)}>이전</button>
                <button type="button" disabled={pageNo >= doc.pageCount} onClick={() => setPageNo((n) => n + 1)}>다음</button>
              </div>
            </header>
            {/* 원본 레이아웃. 표·수식·단 구성을 눈으로 확인하는 용도입니다. */}
            <figure className="reader-canvas">
              {rendered ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rendered.dataUrl} alt={`${pageNo}쪽 원본 이미지`} width={rendered.width} height={rendered.height} />
              ) : renderError ? (
                <p className="reader-empty">원본 이미지를 그리지 못했어요. 아래 문장으로 읽어 주세요.</p>
              ) : (
                <p className="reader-busy"><LoaderCircle className="spin" size={15} /> 원본을 그리는 중</p>
              )}
              <figcaption>원본 그대로 보기 · 아래에서 문장을 골라 근거로 남깁니다</figcaption>
            </figure>

            {page && page.sentences.length > 0 ? (
              <div className="reader-sentences">
                {page.sentences.map((sentence, index) => (
                  <button
                    key={`${pageNo}-${index}`}
                    type="button"
                    className={selected?.text === sentence ? "is-selected" : undefined}
                    onClick={() => { setSelected({ page: pageNo, text: sentence }); setSimplified(null); }}
                  >
                    {sentence}
                  </button>
                ))}
              </div>
            ) : (
              <p className="reader-empty">이 페이지에서는 선택할 수 있는 문장을 찾지 못했어요.</p>
            )}
          </section>

          <aside className="reader-side">
            <h2>선택한 문장</h2>
            {selected ? (
              <>
                <blockquote>{selected.text}</blockquote>
                <Tag tone="violet">근거 p.{selected.page}</Tag>
                <div className="reader-side__actions">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      const r = await runAssist("simplify", "simplify", [{ page: selected.page, text: selected.text }], selected.text);
                      if (r) setSimplified(r);
                    }}
                  >
                    <Sparkles size={15} /> 쉽게 설명
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTab("qa"); setQuestion(`"${selected.text}" 이 문장은 무슨 뜻인가요?`); }}
                  >
                    <HelpCircle size={15} /> 질문 만들기
                  </button>
                  <button type="button" onClick={() => saveNote("요약", selected.text, selected.page)}>
                    <Bookmark size={15} /> 메모 저장
                  </button>
                </div>
                {busy === "simplify" && <StreamingAnswer />}
                {simplified && (
                  <Card className="reader-assist">
                    <p>{simplified.answer}</p>
                    <button type="button" onClick={() => saveNote("요약", simplified.answer, selected.page)}>
                      <Bookmark size={14} /> 이 설명을 메모로
                    </button>
                  </Card>
                )}
              </>
            ) : (
              <p className="reader-empty">왼쪽에서 문장을 누르면 여기에서 이어서 볼 수 있어요.</p>
            )}
            <p className="reader-note">선택한 문장과 AI 설명을 나란히 보며 필요한 내용을 메모할 수 있어요.</p>
          </aside>
        </div>
      )}

      {tab === "translation" && (
        <div className="reader-pair">
          <section>
            <h2>원문 <Tag>p.{pageNo}</Tag></h2>
            <p className="reader-body">{page?.text || "이 페이지에는 텍스트가 없습니다."}</p>
          </section>
          <section>
            <h2>번역 <Tag tone="violet">p.{pageNo}</Tag></h2>
            {busy === "translation" ? <StreamingAnswer /> : translation ? (
              <>
                <p className="reader-body">{translation.answer}</p>
                {translation.terms.length > 0 && (
                  <div className="reader-terms">
                    <h3>용어 사전</h3>
                    {translation.terms.map((t) => (
                      <div key={t.term}><strong>{t.term}</strong><span>{t.meaning}</span></div>
                    ))}
                  </div>
                )}
                <button type="button" className="reader-inline-save" onClick={() => saveNote("요약", translation.answer, pageNo)}>
                  <Bookmark size={14} /> 번역을 메모로 저장
                </button>
              </>
            ) : (
              <PrimaryButton
                disabled={busy !== null || !page?.text}
                onClick={async () => {
                  if (!page) return;
                  const r = await runAssist("translate", "translation", [{ page: page.page, text: page.text }]);
                  if (r) setTranslation(r);
                }}
              >
                이 페이지 번역하기
              </PrimaryButton>
            )}
          </section>
        </div>
      )}

      {tab === "summary" && (
        <div className="reader-single">
          {busy === "summary" ? <StreamingAnswer /> : summary ? (
            <>
              <Card className="reader-assist">
                <p className="reader-body">{summary.answer}</p>
                {!summary.grounded && (
                  <p className="reader-ungrounded"><CircleAlert size={14} /> 페이지에서 근거를 충분히 찾지 못했습니다.</p>
                )}
              </Card>
              {summary.citations.length > 0 && (
                <div className="reader-citations">
                  <h3>원문 근거 {summary.citations.length}개</h3>
                  {summary.citations.map((c, i) => (
                    <div key={`${c.page}-${i}`}>
                      <Tag tone="violet">근거 p.{c.page}</Tag>
                      <p>“{c.quote}”</p>
                      <button type="button" onClick={() => { setTab("original"); setPageNo(c.page); }}>원문으로 이동</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="reader-inline-save" onClick={() => saveNote("요약", summary.answer, summary.citations[0]?.page ?? null)}>
                <Bookmark size={14} /> 요약을 메모로 저장
              </button>
            </>
          ) : (
            <Card className="reader-cta">
              <FileText size={24} aria-hidden="true" />
              <h2>지금 보고 있는 부분을 정리해요</h2>
              <p>현재 페이지와 앞뒤 페이지를 근거로 문제·방법·결과를 구분해 정리합니다.</p>
              <PrimaryButton
                disabled={busy !== null}
                onClick={async () => {
                  const range = doc.pages.filter((p) => Math.abs(p.page - pageNo) <= 1 && p.text);
                  const r = await runAssist("qa", "summary", range.map((p) => ({ page: p.page, text: p.text })),
                    "이 부분의 연구문제, 데이터·방법, 핵심 결과, 한계를 각각 구분해 정리해 주세요.");
                  if (r) setSummary(r);
                }}
              >
                구조화 요약 만들기
              </PrimaryButton>
            </Card>
          )}
        </div>
      )}

      {tab === "qa" && (
        <div className="reader-single">
          <div className="reader-chat">
            {qaTurns.length === 0 && busy !== "qa" && (
              <p className="reader-empty">논문 내용에 대해 질문해 보세요. 답변에는 페이지 근거가 붙습니다.</p>
            )}
            {qaTurns.map((turn, index) => (
              <article key={index}>
                <p className="reader-chat__q">{turn.question}</p>
                <div className="reader-chat__a">
                  <p>{turn.assist.answer}</p>
                  {!turn.assist.grounded && (
                    <p className="reader-ungrounded"><CircleAlert size={14} /> 이 페이지들에서는 근거를 찾지 못했습니다.</p>
                  )}
                  {turn.assist.citations.map((c, i) => (
                    <div key={i} className="reader-chat__cite">
                      <Tag tone="violet">근거 p.{c.page}</Tag>
                      <p>“{c.quote}”</p>
                      <button type="button" onClick={() => { setTab("original"); setPageNo(c.page); }}>원문으로 이동</button>
                    </div>
                  ))}
                  <button type="button" className="reader-inline-save" onClick={() => saveNote("질문", `${turn.question}\n\n${turn.assist.answer}`, turn.assist.citations[0]?.page ?? pageNo)}>
                    <Bookmark size={14} /> 메모로 저장
                  </button>
                </div>
              </article>
            ))}
            {busy === "qa" && <StreamingAnswer />}
          </div>
          <div className="reader-ask">
            <textarea
              rows={3}
              value={question}
              maxLength={500}
              placeholder="논문 내용에 대해 질문해 보세요"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div>
              <small>{question.length} / 500 · 근거 범위 p.{Math.max(1, pageNo - 1)}–{Math.min(doc.pageCount, pageNo + 1)}</small>
              <PrimaryButton
                disabled={busy !== null || !question.trim()}
                onClick={async () => {
                  const range = doc.pages.filter((p) => Math.abs(p.page - pageNo) <= 1 && p.text);
                  const asked = question.trim();
                  const r = await runAssist("qa", "qa", range.map((p) => ({ page: p.page, text: p.text })), asked);
                  if (r) { setQaTurns((t) => [...t, { question: asked, assist: r }]); setQuestion(""); }
                }}
              >
                {busy === "qa" ? <><LoaderCircle className="spin" size={16} /> 확인 중…</> : "질문하기"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {tab === "figure" && (
        <div className="reader-single">
          <Card className="reader-cta">
            <FileImage size={24} aria-hidden="true" />
            <h2>그림·표 해설</h2>
            <p>
              현재 페이지를 이미지로 함께 보내 그림과 표를 직접 보고 설명합니다.
              이미지에서 읽히지 않는 수치는 추측하지 않습니다.
            </p>
            {rendered && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="reader-figure-preview" src={rendered.dataUrl} alt={`${pageNo}쪽 미리보기`} />
            )}
            <PrimaryButton
              disabled={busy !== null || !rendered}
              onClick={async () => {
                if (!page || !rendered) return;
                const r = await runAssist("figure", "figure", [{ page: page.page, text: page.text }],
                  "이 페이지의 그림 또는 표를 한눈에 보기·축과 범례·비교 대상·주의할 해석으로 나누어 설명해 주세요.",
                  rendered.dataUrl);
                if (r) setFigure(r);
              }}
            >
              {rendered ? `p.${pageNo} 그림·표 해설 만들기` : "원본을 그리는 중…"}
            </PrimaryButton>
          </Card>
          {busy === "figure" && <StreamingAnswer />}
          {figure && (
            <Card className="reader-assist">
              <p className="reader-body">{figure.answer}</p>
              {!figure.grounded && (
                <p className="reader-ungrounded"><CircleAlert size={14} /> 이 페이지에서는 그림·표 근거를 찾지 못했습니다.</p>
              )}
              <button type="button" className="reader-inline-save" onClick={() => saveNote("그림·표", figure.answer, pageNo)}>
                <Bookmark size={14} /> 해설을 메모로 저장
              </button>
            </Card>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="reader-single">
          <div className="filter-scroll">
            {(["전체", ...NOTE_KINDS] as const).map((kind) => (
              <ChoiceChip key={kind} selected={noteFilter === kind} onClick={() => setNoteFilter(kind)}>
                {kind}
              </ChoiceChip>
            ))}
          </div>

          {visibleNotes.length === 0 ? (
            <p className="reader-empty">저장한 메모가 없어요. 원문·번역·요약·질문에서 메모로 저장해 보세요.</p>
          ) : (
            <div className="reader-notes">
              {visibleNotes.map((note: SavedQuestCard) => (
                <article key={note.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.has(note.id)}
                      onChange={() => toggleChecked(note.id)}
                      aria-label={`${note.title} 선택`}
                    />
                  </label>
                  <div>
                    <Tag>{note.title.split(" · ")[0]}</Tag>
                    <p>{note.body}</p>
                    {note.evidence?.page && <small>페이지 근거 p.{note.evidence.page}</small>}
                  </div>
                  <button type="button" aria-label="메모 삭제" onClick={() => deleteCard(note.id)}>
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}

          <div className="reader-notes__actions">
            <button type="button" onClick={exportNotes} disabled={visibleNotes.length === 0}>
              <Download size={15} /> 내보내기
            </button>
            <span className="reader-notes__count">선택 {checked.size}개</span>
          </div>
          <p className="reader-note">
            메모는 퀘스트 저장 모델에 담깁니다. 교수님 퀘스트 허브에서도 같은 카드를 볼 수 있어요.
          </p>
        </div>
      )}
    </AppShell>
  );
}

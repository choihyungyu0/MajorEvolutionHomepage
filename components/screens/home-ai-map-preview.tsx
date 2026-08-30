"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  GitBranch,
  Lightbulb,
  ListChecks,
  Map as MapIcon,
  MessageCircleMore,
  Sparkles,
  Target,
} from "lucide-react";
import {
  buildConversationMap,
  getConversationMapRoots,
  type ConversationMapNode,
  type ConversationMapNodeType,
} from "@/lib/ai-conversation-map";
import { useAiProfessorStore } from "@/store/ai-professor-store";
import styles from "./home-dashboard.module.css";

const NODE_ICONS = {
  question: CircleHelp,
  insight: Lightbulb,
  decision: Target,
  action: ListChecks,
} satisfies Record<ConversationMapNodeType, typeof CircleHelp>;

function selectPreviewNodes(
  roots: ConversationMapNode[],
  nodes: ConversationMapNode[],
  limit = 4,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const queue = [...roots];
  const selected: ConversationMapNode[] = [];
  const seen = new Set<string>();

  while (queue.length && selected.length < limit) {
    const node = queue.shift();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    selected.push(node);
    node.childIds.forEach((id) => {
      const child = byId.get(id);
      if (child) queue.push(child);
    });
  }

  return selected;
}

function PreviewTreeNode({
  node,
  nodes,
}: {
  node: ConversationMapNode;
  nodes: ConversationMapNode[];
}) {
  const Icon = NODE_ICONS[node.type];
  const children = node.childIds
    .map((id) => nodes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ConversationMapNode => Boolean(candidate));

  return (
    <li className={styles.aiMapTreeItem}>
      <article className={styles.aiMapNode} data-type={node.type}>
        <span><Icon size={13} aria-hidden="true" /> {node.typeLabel}</span>
        <strong>{node.title}</strong>
        <small>{node.topic}</small>
      </article>
      {children.length ? (
        <ol>
          {children.map((child) => (
            <PreviewTreeNode key={child.id} node={child} nodes={nodes} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function HomeAiMapPreview() {
  const hasHydrated = useAiProfessorStore((state) => state.hasHydrated);
  const messages = useAiProfessorStore((state) => state.messages);
  const growthNotes = useAiProfessorStore((state) => state.growthNotes);
  const mapDecisions = useAiProfessorStore((state) => state.mapDecisions);

  const allNodes = buildConversationMap(messages, growthNotes);
  const visibleNodes = allNodes.filter((node) => mapDecisions[node.id] !== "exclude");
  const roots = getConversationMapRoots(visibleNodes);
  const previewNodes = selectPreviewNodes(roots, visibleNodes);
  const previewRoots = getConversationMapRoots(previewNodes);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const branchPointCount = visibleNodes.filter(
    (node) => node.childIds.filter((id) => visibleIds.has(id)).length > 1,
  ).length;
  const latestNode = visibleNodes.at(-1) ?? null;
  const mobilePreviewNodes = previewNodes.length
    ? latestNode && latestNode.id !== previewNodes[0]?.id
      ? [previewNodes[0]!, latestNode]
      : [previewNodes[0]!]
    : latestNode
      ? [latestNode]
      : [];

  return (
    <section className={styles.aiMapPreviewSection} aria-labelledby="home-ai-map-title">
      <header className={styles.aiMapPreviewHeader}>
        <div>
          <span className={styles.aiMapPreviewEyebrow}>
            <Sparkles size={14} aria-hidden="true" /> 나의 AI 교수님
          </span>
          <h2 id="home-ai-map-title">대화로 정리된 나의 생각 지도</h2>
          <p>진로 고민과 프로젝트 대화가 어떤 질문·발견·행동으로 이어졌는지 홈에서 바로 확인해요.</p>
        </div>
        {hasHydrated && visibleNodes.length ? (
          <dl className={styles.aiMapPreviewMetrics} aria-label="AI 대화 지도 요약">
            <div><dt>생각 노드</dt><dd>{visibleNodes.length}</dd></div>
            <div><dt>분기 지점</dt><dd>{branchPointCount}</dd></div>
            <div><dt>성장 메모</dt><dd>{growthNotes.length}</dd></div>
          </dl>
        ) : null}
      </header>

      {!hasHydrated ? (
        <div className={styles.aiMapPreviewLoading} role="status">
          <MapIcon size={21} aria-hidden="true" /> 대화 지도를 불러오고 있어요.
        </div>
      ) : visibleNodes.length && latestNode ? (
        <div className={styles.aiMapPreviewBody}>
          <div className={styles.aiMapMiniCanvas} aria-label="나의 AI 대화 지도 미리보기">
            <span className={styles.aiMapStart}><MessageCircleMore size={14} aria-hidden="true" /> 대화 시작</span>
            <span className={styles.aiMapStartLine} aria-hidden="true" />
            <ol className={styles.aiMapTree}>
              {previewRoots.map((node) => (
                <PreviewTreeNode key={node.id} node={node} nodes={previewNodes} />
              ))}
            </ol>
            {visibleNodes.length > previewNodes.length ? (
              <span className={styles.aiMapMoreNodes}>+ {visibleNodes.length - previewNodes.length}개 흐름</span>
            ) : null}
          </div>

          <ol className={styles.aiMapMobileFlow} aria-label="나의 AI 대화 지도 핵심 흐름">
            {mobilePreviewNodes.map((node) => {
              const Icon = NODE_ICONS[node.type];
              return (
                <li key={node.id} data-type={node.type}>
                  <span aria-hidden="true"><Icon size={15} /></span>
                  <div>
                    <strong>{node.title}</strong>
                    <small>{node.typeLabel} · {node.topic}</small>
                  </div>
                </li>
              );
            })}
          </ol>

          <Link href="/portfolio/ai-professor?view=map" className={styles.aiMapMobileLink}>
            전체 {visibleNodes.length}개 생각 흐름 보기 <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <aside className={styles.aiMapLatest} aria-label="최근 AI 대화 정리">
            <span>최근 정리된 생각</span>
            <strong>{latestNode.title}</strong>
            <p>{latestNode.summary}</p>
            <Link href="/portfolio/ai-professor?view=map">
              전체 대화 지도 보기 <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      ) : (
        <div className={styles.aiMapPreviewEmpty}>
          <span><GitBranch size={23} aria-hidden="true" /></span>
          <div>
            <strong>아직 만들어진 대화 지도가 없어요</strong>
            <p>AI 교수님과 고민을 하나 나누면 첫 생각 노드가 이곳에 생겨요.</p>
          </div>
          <Link href="/portfolio/ai-professor">
            첫 대화 시작하기 <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

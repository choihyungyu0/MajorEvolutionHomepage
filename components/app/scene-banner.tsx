"use client";

import { sceneSrcSet } from "@/lib/brand-assets";

type SceneSet = { w1024: string; w1440: string; w1920?: string; og?: string };

/**
 * 화면 상단 대표 장면.
 *
 * 브랜드 자산 패키지의 WebP를 화면 폭에 맞춰 내려받습니다.
 * 캐릭터는 실제 교수나 학생의 사진이 아니라 가상 일러스트입니다.
 */
export function SceneBanner({
  scene,
  alt,
  eyebrow,
  title,
  description,
  priority = false,
  className,
}: {
  scene: SceneSet;
  /** 장식이 아니라 내용을 전달하면 설명을 넣고, 아니면 빈 문자열로 둡니다. */
  alt: string;
  eyebrow?: string;
  title: string;
  description?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <section className={["scene-banner", className].filter(Boolean).join(" ")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="scene-banner__image"
        src={scene.w1440}
        srcSet={sceneSrcSet(scene)}
        sizes="(min-width: 1024px) 1040px, 100vw"
        alt={alt}
        aria-hidden={alt === "" ? "true" : undefined}
        width={1440}
        height={810}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
      <div className="scene-banner__body">
        {eyebrow && <p className="scene-banner__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="scene-banner__description">{description}</p>}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  AppShell,
  Card,
  SectionHeading,
  Tag,
} from "@/components/app/primitives";
import { professorDetailQuery } from "@/lib/navigation-flow";
import type { OfficialProfessor } from "@/lib/professor-domain";

/**
 * F11 공식 강의정보.
 *
 * 강의·시간표는 현재 수집 데이터에 없는 항목입니다.
 * 없는 값을 추정해 채우지 않고 빈 상태로 두며, 확인은 대학 공식 시스템으로 넘깁니다.
 */

const SEMESTERS = ["2026학년도 1학기", "2025학년도 2학기", "2025학년도 1학기"];

/** 공식 프로필 주소에서 대학 포털 주소만 뽑아 씁니다. 주소를 지어내지 않습니다. */
function portalOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function OfficialCoursesScreen({
  professor,
  from,
  journey,
}: {
  professor: OfficialProfessor;
  from?: string;
  journey?: string;
}) {
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const portal = portalOrigin(professor.officialProfileUrl);
  const collectedAt = new Date(professor.collectedAt).toLocaleDateString("ko-KR");
  const detailHref = `/professors/${professor.id}${professorDetailQuery(from, journey)}`;

  return (
    <AppShell
      title="공식 강의정보"
      backHref={detailHref}
      className="courses-screen"
    >
      <nav className="courses-breadcrumb" aria-label="현재 위치">
        <Link href={detailHref}>교수님 상세</Link>
        <span aria-hidden="true">›</span>
        <strong>공식 강의정보</strong>
      </nav>

      <section className="courses-hero">
        <div className="official-professor-avatar official-professor-avatar--large" aria-hidden="true">
          {professor.name.slice(0, 1)}
        </div>
        <div>
          <h1>{professor.name} {professor.title}</h1>
          <p>{professor.college} · {professor.department}</p>
          <div className="tag-row">
            <Tag tone="mint">연구분야 {professor.researchFields.length}건</Tag>
            <Tag tone="violet">담당과목</Tag>
            <Link
              className="courses-hero__link"
              href={professor.officialProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              공식 프로필 <ExternalLink size={13} />
            </Link>
          </div>
        </div>
        <label className="courses-semester">
          <span>학기 선택</span>
          <select value={semester} onChange={(event) => setSemester(event.target.value)}>
            {SEMESTERS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </section>

      <SectionHeading title="공식 강의정보" description={semester} />
      <div className="courses-table" role="table" aria-label={`${semester} 공식 강의정보`}>
        <div className="courses-table__head" role="row">
          <span role="columnheader">강의명</span>
          <span role="columnheader">구분</span>
          <span role="columnheader">시간</span>
          <span role="columnheader">강의실</span>
        </div>
        <div className="courses-table__empty">
          <CalendarClock size={26} aria-hidden="true" />
          <h2>아직 강의 데이터를 연결하지 않았어요</h2>
          <p>
            현재 수집한 공식 프로필에는 연구분야와 논문만 있고 강의명·시간·강의실 항목이 없습니다.
            최신 수업 정보는 아래 대학 공식 시스템에서 이어서 확인할 수 있어요.
          </p>
        </div>
      </div>

      <div className="courses-meta">
        <Card>
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>단국대학교 공식 학사정보</strong>
            <small>공식 출처</small>
            <p>이 화면은 대학이 공개한 공식 정보만 표시합니다.</p>
          </div>
        </Card>
        <Card>
          <CalendarCheck size={20} aria-hidden="true" />
          <div>
            <strong>최근 확인</strong>
            <small>{collectedAt}</small>
            <p>공식 프로필을 수집한 날짜입니다. 강의정보는 아직 수집 대상이 아닙니다.</p>
          </div>
        </Card>
      </div>

      <Card className="courses-warning">
        <TriangleAlert size={19} aria-hidden="true" />
        <div>
          <strong>강의시간은 변경될 수 있어요</strong>
          <p>수강신청 전 반드시 학사정보시스템의 공식 시간표를 다시 확인해 주세요.</p>
        </div>
        {portal && (
          <Link href={portal} target="_blank" rel="noopener noreferrer">
            대학 포털에서 확인 <ExternalLink size={15} />
          </Link>
        )}
      </Card>
    </AppShell>
  );
}

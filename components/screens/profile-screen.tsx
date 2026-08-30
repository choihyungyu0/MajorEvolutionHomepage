"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Home,
  LoaderCircle,
  MapPin,
  PencilLine,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app/primitives";
import { ServiceBottomNav } from "@/components/app/side-nav";
import {
  PROFILE_GRADES,
  useProfileStore,
  type LocalUserProfile,
  type ProfileGrade,
} from "@/store/profile-store";
import { useResearchStore } from "@/store/research-store";
import styles from "./profile-screen.module.css";

type ProfileDraft = Omit<LocalUserProfile, "updatedAt" | "interests"> & {
  interestsText: string;
};

function formatUpdatedAt(value: string | null): string {
  if (!value) return "아직 저장 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 저장됨";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function profileInitial(
  profile: LocalUserProfile,
  research: { school: string; major: string | null; interests: string[] },
): ProfileDraft {
  return {
    name: profile.name,
    school: profile.school || research.school,
    major: profile.major || research.major || "",
    grade: profile.grade,
    careerConcern: profile.careerConcern,
    interestsText: (profile.interests.length ? profile.interests : research.interests).join(", "),
  };
}

function ProfileEditor({ initial }: { initial: ProfileDraft }) {
  const saveProfile = useProfileStore((state) => state.saveProfile);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const interests = draft.interestsText
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    saveProfile({
      name: draft.name,
      school: draft.school,
      major: draft.major,
      grade: draft.grade,
      careerConcern: draft.careerConcern,
      interests,
    });
    setSaved(true);
  };

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <div className={styles.cardHeading}>
        <span><PencilLine size={20} aria-hidden="true" /></span>
        <div>
          <h2>내 정보</h2>
          <p>교수 연결과 프로젝트 설계에서 반복 입력하지 않도록 기본 정보를 저장해요.</p>
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span>이름</span>
          <input
            name="name"
            value={draft.name}
            maxLength={40}
            placeholder="예: 이연수"
            autoComplete="name"
            onChange={(event) => update("name", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>학년</span>
          <select
            name="grade"
            value={draft.grade}
            onChange={(event) => update("grade", event.target.value as ProfileGrade)}
          >
            <option value="">선택해 주세요</option>
            {PROFILE_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>학교</span>
          <input
            name="school"
            value={draft.school}
            maxLength={80}
            placeholder="예: 단국대학교"
            autoComplete="organization"
            onChange={(event) => update("school", event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>전공·학과</span>
          <input
            name="major"
            value={draft.major}
            maxLength={80}
            placeholder="예: 데이터사이언스학과"
            onChange={(event) => update("major", event.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.fullField}`}>
          <span>관심 키워드 <small>쉼표로 구분 · 최대 5개</small></span>
          <input
            name="interests"
            value={draft.interestsText}
            maxLength={220}
            placeholder="예: AI 서비스, 데이터 분석, 교육"
            onChange={(event) => update("interestsText", event.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.fullField}`}>
          <span>요즘 가장 큰 진로 고민 <small>{draft.careerConcern.length}/240</small></span>
          <textarea
            name="careerConcern"
            value={draft.careerConcern}
            maxLength={240}
            rows={4}
            placeholder="어떤 선택 앞에서 고민하고 있는지 편하게 적어 주세요."
            onChange={(event) => update("careerConcern", event.target.value)}
          />
        </label>
      </div>

      <div className={styles.formFooter}>
        <p><ShieldCheck size={16} aria-hidden="true" /> 입력 내용은 현재 브라우저에만 저장됩니다.</p>
        <button type="submit" className={styles.saveButton}>
          {saved ? <CheckCircle2 size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
          {saved ? "저장했어요" : "내 정보 저장"}
        </button>
      </div>
    </form>
  );
}

export function ProfileScreen() {
  const hasHydrated = useProfileStore((state) => state.hasHydrated);
  const profile = useProfileStore((state) => state.profile);
  const conditions = useResearchStore((state) => state.conditions);

  if (!hasHydrated) {
    return (
      <div className="research-loading">
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>내 정보를 불러오고 있어요.</p>
      </div>
    );
  }

  const initial = profileInitial(profile, {
    school: conditions.school,
    major: conditions.major,
    interests: conditions.interests,
  });
  const displayName = profile.name || "나의 프로필";
  const identity = [profile.school || initial.school, profile.major || initial.major, profile.grade]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      showHeader={false}
      className={styles.shell}
      bottomNav={<ServiceBottomNav />}
    >
      <div className={styles.page}>
        <header className={styles.intro}>
          <div>
            <span className={styles.eyebrow}><UserRound size={16} aria-hidden="true" /> 마이페이지</span>
            <h1>{profile.name ? `${profile.name}님의 정보` : "나를 소개할 정보를 남겨 주세요."}</h1>
            <p>저장한 정보는 이 기기에서 다시 확인하고, 교수 연결과 프로젝트 방향을 정리할 때 활용할 수 있어요.</p>
          </div>
          <Link href="/home" className={styles.homeLink}><Home size={17} aria-hidden="true" /> 홈으로</Link>
        </header>

        <div className={styles.layout}>
          <aside className={styles.summaryCard} aria-label="저장된 프로필 요약">
            <div className={styles.avatar} aria-hidden="true">
              {profile.name ? profile.name.slice(0, 1) : <UserRound size={30} />}
            </div>
            <div className={styles.summaryCopy}>
              <h2>{displayName}</h2>
              <p>{identity || "학교와 전공을 입력하면 여기에 표시돼요."}</p>
            </div>
            {profile.interests.length > 0 && (
              <div className={styles.tags}>
                {profile.interests.map((interest) => <span key={interest}>{interest}</span>)}
              </div>
            )}
            <div className={styles.savedStatus}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <div><strong>로컬 저장</strong><span>{formatUpdatedAt(profile.updatedAt)}</span></div>
            </div>
            <Link href="/portfolio/manage?from=profile" className={styles.recordsAction}>
              <span><Settings2 size={18} aria-hidden="true" /></span>
              <div>
                <strong>내 기록 관리</strong>
                <p>저장한 기록을 백업하거나 필요한 항목만 직접 정리해요.</p>
              </div>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <p className={styles.localNote}><MapPin size={15} aria-hidden="true" /> 다른 기기나 브라우저에는 자동으로 공유되지 않아요.</p>
          </aside>

          <ProfileEditor initial={initial} />
        </div>

        <section className={styles.nextCard}>
          <div>
            <strong>저장한 정보로 다음 여정을 이어가세요.</strong>
            <p>홈에서 지금까지의 진행 상태와 다음 행동을 한눈에 확인할 수 있어요.</p>
          </div>
          <Link href="/home">서비스 홈 보기 <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      </div>
    </AppShell>
  );
}

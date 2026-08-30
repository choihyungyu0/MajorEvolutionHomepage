"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  Layers3,
  SearchCheck,
  School,
  Sparkles,
} from "lucide-react";
import {
  Card,
  PrimaryButton,
  Tag,
} from "@/components/app/primitives";
import {
  countMappedDepartments,
  getDepartmentsForCollege,
  type ProfessorAcademicTaxonomy,
} from "@/lib/professor-academic-taxonomy";
import {
  CAREER_CONCERN_OPTIONS,
  CAREER_GOAL_OPTIONS,
  CAREER_INTEREST_OPTIONS,
  DIRECT_ACADEMIC_ENTRY,
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  MAX_CAREER_CONCERNS,
  MAX_CAREER_INTERESTS,
  MAX_DISCOVERY_INTERESTS,
  MEETING_OPTIONS,
  normalizeSecondaryMajor,
  SECONDARY_MAJOR_TYPES,
  STUDENT_STAGE_OPTIONS,
  SUPPORT_STYLE_OPTIONS,
  toggleLimitedValue,
  validateProfessorDiscoveryBasics,
  validateProfessorDiscoverySecondary,
  type ProfessorDiscoveryContext,
  type ProfessorDiscoveryValidationIssue,
} from "@/lib/professor-discovery-model";

type ContextUpdater = (
  current: ProfessorDiscoveryContext,
) => ProfessorDiscoveryContext;

type ProfessorDiscoveryFormProps = {
  taxonomy: ProfessorAcademicTaxonomy;
  context: ProfessorDiscoveryContext;
  inputError: string | null;
  loading: boolean;
  rejectedCount: number;
  onContextChange: (updater: ContextUpdater) => void;
  onSubmit: () => void;
  onResetRejected: () => void;
};

const FIELD_ELEMENT_IDS: Record<
  ProfessorDiscoveryValidationIssue["field"],
  string
> = {
  university: "professor-university",
  college: "professor-college",
  major: "professor-major",
  studentStage: "professor-student-stage",
  goal: "professor-goal-group",
  interests: "professor-interest-group",
  careerConcerns: "professor-concern-group",
};

function focusValidationIssue(issue: ProfessorDiscoveryValidationIssue) {
  window.setTimeout(() => {
    document.getElementById(FIELD_ELEMENT_IDS[issue.field])?.focus();
  }, 0);
}

function SelectionCounter({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  return <span className="discovery-selection-count">{current}/{max}</span>;
}

function ProfessorAnalysisGuide() {
  return (
    <Card className="professor-analysis-guide">
      <header>
        <div>
          <h2>교수님은 이렇게 분석해요</h2>
          <p>점수나 순위 대신, 입력의 역할을 나눠 공식 근거와 대화 맥락을 구분합니다.</p>
        </div>
        <Tag tone="mint">근거 규칙 방식</Tag>
      </header>
      <ol>
        <li>
          <span>1</span>
          <div>
            <strong>입력 구조화</strong>
            <p>주전공·관심 분야와 진로 단계·고민을 서로 다른 신호로 정리해요.</p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>공식 근거 대조</strong>
            <p>전공·연구·산업 신호만 교수 연구분야와 공식 논문에 대조해요.</p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>세 관점 연결</strong>
            <p>주제·방법·확장 역할의 교수 3명과 각 교수에게 확인할 질문을 보여줘요.</p>
          </div>
        </li>
      </ol>
    </Card>
  );
}

export function ProfessorDiscoveryForm({
  taxonomy,
  context,
  inputError,
  loading,
  rejectedCount,
  onContextChange,
  onSubmit,
  onResetRejected,
}: ProfessorDiscoveryFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [customInterest, setCustomInterest] = useState("");
  const [interestInputError, setInterestInputError] = useState<string | null>(null);

  const primaryDepartments = useMemo(
    () => getDepartmentsForCollege(taxonomy, context.college),
    [context.college, taxonomy],
  );
  const secondaryDepartments = useMemo(
    () => getDepartmentsForCollege(taxonomy, context.secondaryCollege),
    [context.secondaryCollege, taxonomy],
  );
  const mappedDepartmentCount = useMemo(
    () => countMappedDepartments(taxonomy),
    [taxonomy],
  );
  const usesDirectPrimaryMajor = context.college === DIRECT_ACADEMIC_ENTRY;
  const usesDirectSecondaryMajor = context.secondaryCollege === DIRECT_ACADEMIC_ENTRY;

  const changeContext = (updater: ContextUpdater) => {
    setStepError(null);
    onContextChange(updater);
  };

  const toggleArray = (
    field: "interests" | "careerInterests" | "careerConcerns",
    value: string,
    limit: number,
  ) => {
    changeContext((current) => ({
      ...current,
      [field]: toggleLimitedValue(current[field], value, limit),
    }));
  };

  const validateBasics = (): boolean => {
    const issue = validateProfessorDiscoveryBasics(context);
    if (!issue) {
      setStepError(null);
      return true;
    }
    setStepError(issue.message);
    setStep(1);
    focusValidationIssue(issue);
    return false;
  };

  const submit = () => {
    if (!validateBasics()) return;
    const secondaryError = validateProfessorDiscoverySecondary(context);
    if (secondaryError) {
      setStep(2);
      setStepError(secondaryError);
      return;
    }
    setStepError(null);
    onSubmit();
  };

  const addCustomInterest = () => {
    const value = customInterest.trim();
    if (!value) {
      setInterestInputError("직접 입력할 관심 분야를 적어 주세요.");
      return;
    }
    if (context.interests.includes(value)) {
      setInterestInputError("이미 선택한 관심 분야예요.");
      return;
    }
    if (context.interests.length >= MAX_DISCOVERY_INTERESTS) {
      setInterestInputError(`관심 분야는 최대 ${MAX_DISCOVERY_INTERESTS}개까지 선택할 수 있어요.`);
      return;
    }
    changeContext((current) => ({
      ...current,
      interests: [...current.interests, value],
    }));
    setCustomInterest("");
    setInterestInputError(null);
  };

  return (
    <>
      <ProfessorAnalysisGuide />

      <Card className="context-panel professor-discovery-form">
        <header className="professor-discovery-form__head">
          <div>
            <h2>나에게 맞는 연결 조건</h2>
            <p>필수 질문은 연결 근거를 만들고, 선택 질문은 면담 질문을 더 구체화합니다.</p>
          </div>
          <div className="professor-discovery-steps" aria-label="교수 찾기 입력 단계">
            <button
              type="button"
              className={step === 1 ? "is-active" : "is-complete"}
              aria-current={step === 1 ? "step" : undefined}
              onClick={() => setStep(1)}
            >
              <span>{step === 2 ? <CheckCircle2 size={16} /> : "1"}</span>
              기본분석
            </button>
            <span aria-hidden="true" />
            <button
              type="button"
              className={step === 2 ? "is-active" : ""}
              aria-current={step === 2 ? "step" : undefined}
              onClick={() => {
                if (validateBasics()) setStep(2);
              }}
            >
              <span>2</span>
              심층분석
            </button>
          </div>
        </header>

        {step === 1 ? (
          <div className="professor-discovery-step" data-step="basic">
            <section className="discovery-question">
              <div className="discovery-question__title">
                <School size={19} />
                <div>
                  <h3>1. 학교와 주전공 <Tag tone="warning">필수</Tag></h3>
                  <p>학교를 고르면 현재 공식 교수 데이터에서 확인된 단과대와 학과가 열립니다.</p>
                </div>
              </div>

              <button
                id="professor-university"
                type="button"
                className={`university-choice${context.university === taxonomy.university ? " is-selected" : ""}`}
                aria-pressed={context.university === taxonomy.university}
                onClick={() => changeContext((current) => ({
                  ...current,
                  university: taxonomy.university,
                }))}
              >
                <GraduationCap size={21} />
                <span>
                  <strong>단국대학교</strong>
                  <small>공식 교수 {taxonomy.officialProfessorCount.toLocaleString("ko-KR")}명</small>
                </span>
                <CheckCircle2 size={19} />
              </button>

              {context.university === taxonomy.university && (
                <>
                  <div className="academic-select-grid">
                    {!usesDirectPrimaryMajor ? (
                      <>
                        <label htmlFor="professor-college">
                          <span>단과대</span>
                          <select
                            id="professor-college"
                            value={context.college}
                            onChange={(event) => changeContext((current) => ({
                              ...current,
                              college: event.target.value,
                              major: "",
                            }))}
                          >
                            <option value="">단과대를 선택하세요</option>
                            {taxonomy.colleges.map((college) => (
                              <option key={college.name} value={college.name}>
                                {college.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label htmlFor="professor-major">
                          <span>학과·전공</span>
                          <select
                            id="professor-major"
                            value={context.major}
                            disabled={!context.college}
                            onChange={(event) => changeContext((current) => ({
                              ...current,
                              major: event.target.value,
                            }))}
                          >
                            <option value="">
                              {context.college ? "학과·전공을 선택하세요" : "단과대를 먼저 선택하세요"}
                            </option>
                            {primaryDepartments.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : (
                      <label htmlFor="professor-major" className="academic-select-grid__wide">
                        <span>목록에 없는 학과·전공 직접 입력</span>
                        <input
                          id="professor-major"
                          type="text"
                          list="professor-unmapped-major-options"
                          value={context.major}
                          maxLength={80}
                          placeholder="예: 자유전공학부"
                          onChange={(event) => changeContext((current) => ({
                            ...current,
                            major: event.target.value,
                          }))}
                        />
                        <datalist id="professor-unmapped-major-options">
                          {taxonomy.unmappedDepartments.map((department) => (
                            <option key={department} value={department} />
                          ))}
                        </datalist>
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    className="academic-entry-toggle"
                    onClick={() => changeContext((current) => ({
                      ...current,
                      college: usesDirectPrimaryMajor ? "" : DIRECT_ACADEMIC_ENTRY,
                      major: "",
                    }))}
                  >
                    {usesDirectPrimaryMajor
                      ? "공식 단과대·학과 선택으로 돌아가기"
                      : "공식 목록에 내 전공이 없어요 · 직접 입력"}
                  </button>
                  <p className="discovery-data-note">
                    단과대 관계가 확인된 {taxonomy.colleges.length}개 단과대·
                    {mappedDepartmentCount}개 학과를 제공합니다.
                    {usesDirectPrimaryMajor
                      ? " 직접 입력 전공은 동일 학과 소속을 보장하지 않고 인접 연구분야만 연결합니다."
                      : ""}
                  </p>
                </>
              )}
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <Layers3 size={19} />
                <div>
                  <h3>2. 지금 어느 단계인가요? <Tag tone="warning">필수</Tag></h3>
                  <p>학년 대신 현재 고민의 단계를 선택하면 복학·편입·졸업유예 학생도 답하기 쉬워요.</p>
                </div>
              </div>
              <div id="professor-student-stage" className="chip-grid" tabIndex={-1}>
                {STUDENT_STAGE_OPTIONS.map((studentStage) => (
                  <button
                    key={studentStage}
                    type="button"
                    className={`choice-chip${context.studentStage === studentStage ? " is-selected" : ""}`}
                    aria-pressed={context.studentStage === studentStage}
                    onClick={() => changeContext((current) => ({ ...current, studentStage }))}
                  >
                    {studentStage}
                  </button>
                ))}
              </div>
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <SearchCheck size={19} />
                <div>
                  <h3>3. 교수님에게 어떤 도움을 받고 싶나요? <Tag tone="warning">필수</Tag></h3>
                  <p>추천 결과를 실제 학교생활의 다음 행동으로 연결하기 위한 질문입니다.</p>
                </div>
              </div>
              <div id="professor-goal-group" className="chip-grid" tabIndex={-1}>
                {GOAL_OPTIONS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={`choice-chip${context.goal === goal ? " is-selected" : ""}`}
                    aria-pressed={context.goal === goal}
                    onClick={() => changeContext((current) => ({ ...current, goal }))}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <Sparkles size={19} />
                <div>
                  <h3>
                    4. 관심 연구·산업 분야 <Tag tone="warning">필수</Tag>
                    <SelectionCounter current={context.interests.length} max={MAX_DISCOVERY_INTERESTS} />
                  </h3>
                  <p>교수 연구분야·논문과 직접 대조할 핵심 신호예요. 최대 5개를 골라 주세요.</p>
                </div>
              </div>
              <div id="professor-interest-group" className="chip-grid discovery-chip-grid" tabIndex={-1}>
                {INTEREST_OPTIONS.map((interest) => {
                  const selected = context.interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      className={`choice-chip${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      disabled={!selected && context.interests.length >= MAX_DISCOVERY_INTERESTS}
                      onClick={() => toggleArray("interests", interest, MAX_DISCOVERY_INTERESTS)}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
              <div className="custom-interest-row">
                <label htmlFor="professor-custom-interest">
                  <span>목록에 없는 관심 분야</span>
                  <input
                    id="professor-custom-interest"
                    type="text"
                    value={customInterest}
                    maxLength={60}
                    disabled={context.interests.length >= MAX_DISCOVERY_INTERESTS}
                    placeholder="예: 디지털 헬스케어"
                    onChange={(event) => {
                      setCustomInterest(event.target.value);
                      setInterestInputError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomInterest();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="choice-chip"
                  disabled={!customInterest.trim() || context.interests.length >= MAX_DISCOVERY_INTERESTS}
                  onClick={addCustomInterest}
                >
                  추가
                </button>
              </div>
              {interestInputError && <p className="context-panel__error" role="alert">{interestInputError}</p>}
              {context.interests.length > 0 && (
                <div className="selected-signal-list" aria-label="선택한 관심 분야">
                  {context.interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleArray("interests", interest, MAX_DISCOVERY_INTERESTS)}
                      aria-label={`${interest} 관심 분야 제거`}
                    >
                      {interest} ×
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <BriefcaseBusiness size={19} />
                <div>
                  <h3>
                    5. 지금 가장 큰 진로 고민 <Tag tone="warning">필수</Tag>
                    <SelectionCounter current={context.careerConcerns.length} max={MAX_CAREER_CONCERNS} />
                  </h3>
                  <p>이 답은 교수 연구근거를 바꾸지 않고, 면담에서 직접 확인할 질문을 개인화하는 데 사용해요.</p>
                </div>
              </div>
              <div id="professor-concern-group" className="chip-grid discovery-chip-grid" tabIndex={-1}>
                {CAREER_CONCERN_OPTIONS.map((concern) => {
                  const selected = context.careerConcerns.includes(concern);
                  return (
                    <button
                      key={concern}
                      type="button"
                      className={`choice-chip${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      disabled={!selected && context.careerConcerns.length >= MAX_CAREER_CONCERNS}
                      onClick={() => toggleArray("careerConcerns", concern, MAX_CAREER_CONCERNS)}
                    >
                      {concern}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="professor-discovery-form__actions">
              <PrimaryButton
                onClick={() => {
                  if (validateBasics()) setStep(2);
                }}
              >
                선택 심층분석 이어가기 <ArrowRight size={17} />
              </PrimaryButton>
              <button type="button" className="discovery-skip-button" onClick={submit}>
                기본 정보만으로 교수님 찾기
              </button>
            </div>
          </div>
        ) : (
          <div className="professor-discovery-step" data-step="deep">
            <section className="discovery-question">
              <div className="discovery-question__title">
                <GraduationCap size={19} />
                <div>
                  <h3>1. 부전공·복수전공 <Tag>선택</Tag></h3>
                  <p>입력한 부·복수전공도 가까운 학과 연결 범위에 포함해요. 공식 소속과 관심 근거를 함께 확인해 첫 교수 후보를 제안합니다.</p>
                </div>
              </div>
              <div className="chip-grid">
                {SECONDARY_MAJOR_TYPES.map((secondaryMajorType) => (
                  <button
                    key={secondaryMajorType}
                    type="button"
                    className={`choice-chip${context.secondaryMajorType === secondaryMajorType ? " is-selected" : ""}`}
                    aria-pressed={context.secondaryMajorType === secondaryMajorType}
                    onClick={() => changeContext((current) => normalizeSecondaryMajor({
                      ...current,
                      secondaryMajorType,
                      secondaryCollege: secondaryMajorType === "없음"
                        ? ""
                        : current.secondaryCollege,
                      secondaryMajor: secondaryMajorType === "없음"
                        ? ""
                        : current.secondaryMajor,
                    }))}
                  >
                    {secondaryMajorType}
                  </button>
                ))}
              </div>
              {context.secondaryMajorType !== "없음" && (
                <div className="academic-select-grid">
                  <label htmlFor="professor-secondary-college">
                    <span>{context.secondaryMajorType} 단과대</span>
                    <select
                      id="professor-secondary-college"
                      value={context.secondaryCollege}
                      onChange={(event) => changeContext((current) => ({
                        ...current,
                        secondaryCollege: event.target.value,
                        secondaryMajor: "",
                      }))}
                    >
                      <option value="">단과대를 선택하세요</option>
                      {taxonomy.colleges.map((college) => (
                        <option key={college.name} value={college.name}>
                          {college.name}
                        </option>
                      ))}
                      <option value={DIRECT_ACADEMIC_ENTRY}>목록에 없음 · 직접 입력</option>
                    </select>
                  </label>
                  <label htmlFor="professor-secondary-major">
                    <span>{context.secondaryMajorType} 학과·전공</span>
                    {usesDirectSecondaryMajor ? (
                      <input
                        id="professor-secondary-major"
                        type="text"
                        value={context.secondaryMajor}
                        maxLength={80}
                        placeholder="연계·융합전공명을 입력하세요"
                        onChange={(event) => changeContext((current) => ({
                          ...current,
                          secondaryMajor: event.target.value,
                        }))}
                      />
                    ) : (
                      <select
                        id="professor-secondary-major"
                        value={context.secondaryMajor}
                        disabled={!context.secondaryCollege}
                        onChange={(event) => changeContext((current) => ({
                          ...current,
                          secondaryMajor: event.target.value,
                        }))}
                      >
                        <option value="">
                          {context.secondaryCollege ? "학과·전공을 선택하세요" : "단과대를 먼저 선택하세요"}
                        </option>
                        {secondaryDepartments.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                </div>
              )}
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <BriefcaseBusiness size={19} />
                <div>
                  <h3>
                    2. 관심 직무 <Tag>선택</Tag>
                    <SelectionCounter current={context.careerInterests.length} max={MAX_CAREER_INTERESTS} />
                  </h3>
                  <p>연구분야를 학교 밖 진로와 연결해 볼 보조 신호입니다.</p>
                </div>
              </div>
              <div className="chip-grid discovery-chip-grid">
                {CAREER_INTEREST_OPTIONS.map((careerInterest) => {
                  const selected = context.careerInterests.includes(careerInterest);
                  return (
                    <button
                      key={careerInterest}
                      type="button"
                      className={`choice-chip${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      disabled={!selected && context.careerInterests.length >= MAX_CAREER_INTERESTS}
                      onClick={() => toggleArray("careerInterests", careerInterest, MAX_CAREER_INTERESTS)}
                    >
                      {careerInterest}
                    </button>
                  );
                })}
              </div>

              <span>진로 목표</span>
              <div className="chip-grid">
                {CAREER_GOAL_OPTIONS.map((careerGoal) => (
                  <button
                    key={careerGoal}
                    type="button"
                    className={`choice-chip${context.careerGoal === careerGoal ? " is-selected" : ""}`}
                    aria-pressed={context.careerGoal === careerGoal}
                    onClick={() => changeContext((current) => ({ ...current, careerGoal }))}
                  >
                    {careerGoal}
                  </button>
                ))}
              </div>
            </section>

            <section className="discovery-question">
              <div className="discovery-question__title">
                <Sparkles size={19} />
                <div>
                  <h3>3. 교수님과 나누고 싶은 대화 <Tag>선택</Tag></h3>
                  <p>원하는 도움·구체 주제·경험은 교수 매칭과 첫 질문에 함께 반영해요. 만날 상황은 준비 카드에만 사용합니다.</p>
                </div>
              </div>
              <span>원하는 도움 방식</span>
              <div className="chip-grid">
                {SUPPORT_STYLE_OPTIONS.map((preferredSupport) => (
                  <button
                    key={preferredSupport}
                    type="button"
                    className={`choice-chip${context.preferredSupport === preferredSupport ? " is-selected" : ""}`}
                    aria-pressed={context.preferredSupport === preferredSupport}
                    onClick={() => changeContext((current) => ({ ...current, preferredSupport }))}
                  >
                    {preferredSupport}
                  </button>
                ))}
              </div>

              <span>만날 상황</span>
              <div className="chip-grid">
                {MEETING_OPTIONS.map((meetingSituation) => (
                  <button
                    key={meetingSituation}
                    type="button"
                    className={`choice-chip${context.meetingSituation === meetingSituation ? " is-selected" : ""}`}
                    aria-pressed={context.meetingSituation === meetingSituation}
                    onClick={() => changeContext((current) => ({ ...current, meetingSituation }))}
                  >
                    {meetingSituation}
                  </button>
                ))}
              </div>

              <label htmlFor="professor-topic">
                <span>구체적으로 궁금한 주제</span>
                <input
                  id="professor-topic"
                  type="text"
                  value={context.topic}
                  maxLength={160}
                  placeholder="예: AI 서비스기획 직무에서 경제학 전공을 살리는 방법"
                  onChange={(event) => changeContext((current) => ({
                    ...current,
                    topic: event.target.value,
                  }))}
                />
              </label>

              <label htmlFor="professor-experience">
                <span>흥미롭게 들은 수업·프로젝트·동아리·사용 가능한 도구</span>
                <textarea
                  id="professor-experience"
                  value={context.experience}
                  maxLength={500}
                  placeholder="예: 통계학 수업을 들었고, 공모전에서 설문 데이터를 엑셀로 분석해 봤어요."
                  onChange={(event) => changeContext((current) => ({
                    ...current,
                    experience: event.target.value,
                  }))}
                />
              </label>

              <label htmlFor="professor-additional-context">
                <span>AI가 함께 고려하면 좋은 추가 맥락</span>
                <textarea
                  id="professor-additional-context"
                  value={context.additionalContext}
                  maxLength={500}
                  placeholder="예: 코딩 경험은 적지만 실제 문제를 데이터로 풀어보고 싶어요."
                  onChange={(event) => changeContext((current) => ({
                    ...current,
                    additionalContext: event.target.value,
                  }))}
                />
              </label>
            </section>

            <div className="professor-discovery-form__actions professor-discovery-form__actions--deep">
              <button type="button" className="discovery-back-button" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> 기본분석 수정
              </button>
              <PrimaryButton onClick={submit} disabled={loading}>
                {loading ? "공식 근거를 찾는 중…" : "세 관점의 교수님 찾기"}
                {!loading && <SearchCheck size={17} />}
              </PrimaryButton>
            </div>
          </div>
        )}

        {(stepError || inputError) && (
          <p className="context-panel__error" role="alert">
            {stepError ?? inputError}
          </p>
        )}
        {rejectedCount > 0 && (
          <button
            type="button"
            className="context-panel__reset"
            onClick={onResetRejected}
          >
            제외한 교수 {rejectedCount}명 다시 포함하기
          </button>
        )}
      </Card>
    </>
  );
}

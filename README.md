# 전공진화소

진로와 전공의 갈림길에 선 학생이 공식 근거로 관련 교수를 찾고, 준비해서 만나고, 받은 조언을 수업·연구·진로의 다음 행동으로 바꾸도록 돕는 모바일 우선 프로토타입입니다.

## 실행

```bash
npm install
```

루트에 `.env.local`을 만들고 서버 전용 키를 설정합니다.

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

```bash
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다.

## 멘토링 반영 MVP

`http://localhost:3000/mentoring`에서 교수 연결 3단계를 한 화면으로 확인할 수 있습니다.

1. 자유 브레인스토밍, 학과 × AI 트렌드, 전공 융합 중 하나를 선택
2. AI가 한 번에 한 질문을 제시하고 사용자가 확인한 맥락을 누적
3. 숫자 점수 없이 연구질문·데이터·방법·범위·확인할 점을 같은 스키마로 비교
4. 후보 2개 중 하나를 선택하면 서버측 공식 데이터 인덱스에서 교수 1명과 대안 1명 연결
5. `/professors/[id]`에서 공식 연구분야·논문 상태·근거 ID 확인
6. `/quest`에서 60초 소개, 질문 3개, 20분 안건, 이메일 초안을 준비하는 교수 Knock Kit 사용
7. `/mentor-loop`에서 면담 피드백, 연구안 수정 전후, 7일 행동과 감사·후속 이메일을 저장

공식 프로필에 연구분야나 논문 목록이 없으면 추정해서 채우지 않습니다. `공식 프로필 미기재`, `프로필 접근 불가`, `파싱 실패`, `robots 차단`을 별도 상태로 기록합니다. DOI/KCI는 공식 프로필에 이미 노출된 논문의 서지 메타데이터 보강에만 사용합니다.

현재 런타임 데이터는 단국대 공식 디렉터리 115개 학과·전공을 시도한 정규화 결과 1,051명입니다. 학과 소속 결과가 공식 중앙 교원검색에도 없는 3개 전공은 `PARTIAL` 범위 공백으로 표시합니다. 교수의 우열이나 성공 가능성을 점수로 표시하지 않으며, `TOPIC`, `METHOD`, `CONTEXT` 역할과 공식 근거 ID만 제공합니다.

## 레거시 탐색 흐름

초기 점수형 아이디어 랩과 전공 DNA 화면은 코드 이력으로만 남깁니다. `/ideas`, `/ideas/compare`, `/evolution-report`, `/feasibility`, `/passport` 직접 진입은 최신 공동설계 시작점인 `/research`로 이동합니다.

추가 기능으로 논문 초록·본문 구조화 분석, 실제 6단계 퀘스트 진행률, 이메일 앱 열기, 캘린더 일정, Markdown 문서와 인쇄 기반 PDF 저장을 제공합니다.

## 기술 구성

- Next.js 15 App Router
- React 19, TypeScript
- Zustand persist 기반 브라우저 로컬 상태
- OpenAI Responses API와 strict JSON Schema 기반 맞춤 결과 생성
- Tailwind CSS 4와 전용 CSS 디자인 시스템
- Lucide 아이콘

분석 시 입력 프로필은 앱의 서버 API를 거쳐 OpenAI Responses API로 전송됩니다. API 키는 서버에서만 읽으며 클라이언트 번들에 포함하지 않습니다. 생성 결과, 선택 주제, 공식 교수 연결 결과, Knock Kit와 Mentor Loop 수정 내용은 브라우저 `localStorage`에 저장됩니다.

AI 호출에 실패하면 준비된 샘플 결과로 흐름을 이어가며, 화면에서 샘플 결과임을 표시합니다. AI가 생성한 탐색 방향은 외부 출처 검증을 마친 최신 동향으로 표시하지 않습니다.

레거시 데이터 파일에는 화면 검증용 가상 교수가 남아 있지만, 멘토링 반영 `/result → /professors → /quest → /mentor-loop` 흐름에서는 노출하지 않습니다. 공식 데이터 수집 결과는 출처·수집일·공식 프로필 미기재·robots 차단 상태와 함께 관리합니다. 회원 로그인, 여러 기기 동기화, 이메일 자동 발송은 후속 연동 범위입니다.

## 에셋과 문서

- 런타임 이미지: `public/major-evolution-assets`
- ZIP 원본 참고 자료: `design/reference-assets`
- 최신 제품 기획 기준: `docs/PRODUCT_PLAN_2026-07-28.md`
- 초기 제품 요구사항 보관본: `PRD.md`
- 멘토링 반영 MVP 제작 명세: `docs/MVP_SPEC.md`
- 교수 데이터 수집 명세와 실행 보고: `docs/PROFESSOR_DATA.md`
- 공식 교수 런타임 연결 구조와 제한: `docs/PROFESSOR_RUNTIME.md`
- 전체 서비스 흐름도와 유저플로우: `docs/SERVICE_FLOW.md`
- 논문 리더 팀원 인계 명세: `docs/PAPER_READER_HANDOFF.md`

## 검증

```bash
npm run typecheck
npm run professors:test
npm run professors:smoke
npm run build
npm audit --omit=dev
```

구현은 360px, 390px, 430px 모바일과 1440px 데스크톱에서 전체 라우트, 가로 넘침, 이미지 로드, 콘솔 오류, 키보드 모달 동작을 점검했습니다.

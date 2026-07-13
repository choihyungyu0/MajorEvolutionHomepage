# 전공진화소

전공과 관심사를 AI 연구 아이디어로 확장하고, 아이디어 비교부터 교수 연결과 첫 실행 퀘스트까지 이어주는 모바일 우선 인터랙티브 프로토타입입니다.

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

## 핵심 흐름

1. 목적 선택과 6단계 전공 DNA 입력
2. 전공 진화 리포트와 연구 트렌드 탐색
3. 아이디어 3개 생성, 2개 비교, 난이도 조절
4. 4주 실행 범위와 아이디어 패스포트 작성
5. 교수 추천 근거 비교와 상세 확인
6. 면담 준비 퀘스트, 홈, 탐색, 보관함, 프로필

## 기술 구성

- Next.js 15 App Router
- React 19, TypeScript
- Zustand persist 기반 브라우저 로컬 상태
- OpenAI Responses API와 strict JSON Schema 기반 맞춤 결과 생성
- Tailwind CSS 4와 전용 CSS 디자인 시스템
- Lucide 아이콘

분석 시 입력 프로필은 앱의 서버 API를 거쳐 OpenAI Responses API로 전송됩니다. API 키는 서버에서만 읽으며 클라이언트 번들에 포함하지 않습니다. 생성 결과와 진행 상태는 브라우저 `localStorage`에 저장됩니다. 교수 이름, 연구실, 출처 항목은 기능 검증을 위한 가상 데이터이며 화면에도 이를 명시합니다.

AI 호출에 실패하면 준비된 샘플 결과로 흐름을 이어가며, 화면에서 샘플 결과임을 표시합니다. AI가 생성한 탐색 방향은 외부 출처 검증을 마친 최신 동향으로 표시하지 않습니다.

## 에셋과 문서

- 런타임 이미지: `public/major-evolution-assets`
- ZIP 원본 참고 자료: `design/reference-assets`
- 제품 요구사항과 QA 기준: `PRD.md`

## 검증

```bash
npm run typecheck
npm run build
npm audit --omit=dev
```

구현은 360px, 390px, 430px 모바일과 1440px 데스크톱에서 전체 라우트, 가로 넘침, 이미지 로드, 콘솔 오류, 키보드 모달 동작을 점검했습니다.

# 공식 교수 런타임 연결

## 목적

선택한 연구주제와 수집된 대학 공식 교수 데이터를 같은 식별자로 연결합니다. 교수의 우열이나 합격·지도 가능성을 점수로 표시하지 않고 다음 역할만 제공합니다.

- `TOPIC`: 연구주제 연결
- `METHOD`: 방법론 연결
- `CONTEXT`: 응용 맥락 연결

## 데이터 흐름

```text
selectedTopicId + 선택 주제 내용
  → POST /api/professors/match
  → lib/professor-data.server.ts
  → 공식 데이터 JSON 인덱스
  → 교수 1명 + 대안 1명
  → research-store localStorage 저장
  → /result → /professors/[id] → /quest → /mentor-loop
```

서버측 인덱스를 사용하므로 논문 목록 전체를 클라이언트 초기 번들에 넣지 않습니다. API 입력은 길이와 배열 개수를 제한하며, 잘못된 요청은 `400`, 과도한 요청 본문은 `413`을 반환합니다.

## 안정 식별자

- 교수: 수집 데이터의 `professor.id`
- 프로필 근거: `profile:{professorId}`
- 논문 근거: `publication:{professorId}:{officialProfileOrder}`
- 주제: `selectedTopicId`

논문 근거는 공식 프로필에 노출된 목록 안에서 선택 주제와 제목 표현이 연결되는 경우에만 추천 근거에 포함합니다. 관련성이 제한적인 대안 후보에는 프로필 근거만 연결합니다.

## 상태와 예외

- 공식 프로필 논문 목록이 없으면 `NOT_LISTED_ON_OFFICIAL_PROFILE`을 그대로 표시합니다.
- 단국대 공식 디렉터리 115개 학과·전공을 모두 시도한 결과를 사용합니다.
- 중앙 교원검색에도 소속 결과가 없는 3개 전공은 `PARTIAL` 범위 공백으로 숨기지 않습니다.
- 교수의 면담·지도·모집 가능 여부와 참여 의사는 항상 판단 대상에서 제외합니다.
- 이메일은 자동 발송하지 않으며 사용자가 Knock Kit 초안을 검토한 뒤 복사합니다.

## 브라우저 저장

`major-evolution-research-v1` 키에 다음 상태를 저장합니다.

- 연구 조건과 공동설계 답변
- 후보 2개와 `selectedTopicId`
- 공식 교수 연결 결과와 `selectedProfessorId`
- 교수·주제별 Knock Kit 수정 내용
- 교수·주제별 Mentor Loop 피드백, 연구안 수정 전후, 7일 행동과 후속 이메일

새로고침 시 저장 상태 복원이 끝난 뒤에만 결과 없음 여부를 판단합니다.

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run professors:test
npm.cmd run professors:smoke
npm.cmd run build
```

수동 브라우저 검증 범위:

```text
/research
  → 조건 입력
  → /co-design 5개 질문
  → /result 주제 선택
  → 공식 교수 2명 확인
  → /professors/[id] 공식 근거 확인
  → /quest Knock Kit 수정
  → /mentor-loop 피드백·수정안·7일 행동 저장
  → /mentoring에서 3단계 완료 상태 확인
  → 새로고침 후 수정 내용 유지 확인
```

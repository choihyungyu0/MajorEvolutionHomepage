# 단국대·충북대 교수 공개 데이터 수집

이 파이프라인은 대학 공식 페이지에 공개된 교수의 이름·직위·소속·연구분야와 **공식 프로필에 노출된 논문 목록까지만** 수집합니다. 이메일과 전화·팩스는 결과와 영속 캐시에 저장하지 않습니다. 교수 사진은 핵심 데이터와 캐시에서 제외하고, 별도 `photo-references.json`에 공식 사진 URL·출처·확인일만 기록할 수 있습니다. 사진 파일은 내려받지 않으며 학교 또는 권리자의 이용 허가를 확인하기 전 앱에 표시하지 않습니다. 영속 캐시는 원문 HTML 전체가 아니라 필요한 공개 데이터와 탐색 링크만 허용 목록 방식으로 재구성합니다.

## 현재 범위

- 단국대학교: 공식 학부 안내 페이지의 `*_deptData` JSON으로 전체 학과를 발견하고, 각 학과 홈페이지에서 교수 페이지를 제한적으로 탐색합니다. 교수 목록의 `*_professorsData` JSON과 공식 교원 상세 프로필을 사용합니다.
- 충북대학교: `www.cbnu.ac.kr/robots.txt`가 `User-agent: *`에 대해 `/` 전체를 차단하므로 중앙 학과 디렉터리를 읽지 않습니다. `data/professors/seeds/cbnu-departments.json`에서 robots 허용 여부를 사람이 확인한 학과 호스트만 수집합니다. 따라서 현재 충북대 결과는 **전 학과 완료가 아닌 PARTIAL**입니다.
- DOI/KCI: 공식 프로필에 이미 노출된 논문 제목의 식별자를 보정하는 용도입니다. API 검색 결과만으로 논문을 새로 추가하지 않습니다.

`NOT_LISTED_ON_OFFICIAL_PROFILE`은 “연구 또는 논문이 없다”는 뜻이 아닙니다. 공식 프로필에서 해당 목록이 노출되지 않았다는 뜻입니다.

## 실행

```powershell
npm.cmd run professors:test
npm.cmd run professors:smoke

# 네트워크 샘플
npm.cmd run professors:crawl -- --university dku --max-departments 1 --max-professors 2
npm.cmd run professors:crawl -- --university cbnu --max-departments 1 --max-professors 2

# 허용된 전체 발견 범위. 호스트별 최소 1.2초 간격을 적용하므로 오래 걸립니다.
npm.cmd run professors:crawl -- --university all

# 공식 목록 논문만 Crossref DOI 보정
npm.cmd run professors:crawl -- --university dku --enrich-crossref --enrich-max 50

# KCI는 발급받은 키가 있을 때만 활성화됩니다. 키는 결과에 기록되지 않습니다.
$env:KCI_API_KEY = "..."
npm.cmd run professors:crawl -- --university dku --enrich-max 50

npm.cmd run professors:validate -- data/professors/sample/live-dku/dataset.json

# 검증된 수집 결과를 SQLite·정규화 JSON·CSV로 변환
npm.cmd run professors:export-db -- `
  data/professors/runs/dku-full/dataset.json `
  data/professors/runs/dku-full/manifest.json `
  data/professors/dku/current

# 공식 사진 URL만 별도 참조 장부로 생성(사진 파일 다운로드·앱 표시 없음)
npm.cmd run professors:collect-photo-references -- `
  data/professors/dku/current/normalized.json `
  data/professors/dku/current
```

출력은 기본적으로 `data/professors/runs/<timestamp>/`에 생성되며 Git에서 제외됩니다.

- `dataset.json`: 앱이 읽을 교수 데이터
- `manifest.json`: 범위, 상태별 건수, robots 판단, 콘텐츠 해시, 누락 사유
- `report.md`: 사람이 검토할 요약

DB 내보내기는 동일한 공식 프로필 URL을 가진 교수를 한 번만 저장하고,
`professor_departments` 관계표로 학과 연결을 분리합니다. 하나의 공식 학과
홈페이지가 여러 세부 전공에 공통으로 연결된 경우
`SHARED_OFFICIAL_HOMEPAGE`로 표시하며 직접 소속으로 단정하지 않습니다.

생성 파일:

- `dankook-professors.sqlite`: 정규화 SQLite DB
- `normalized.json`: DB와 같은 구조의 JSON
- `csv/*.csv`: 단과대학·학과·교수·관계·연구분야·논문·수집 이슈 테이블
- `source-dataset.json`: 스키마 검증을 통과한 수집 원본
- `source-manifest.json`: 수집 범위, robots 감사, 실패 사유와 해시
- `photo-references.json`, `photo-references.csv`: 선택 생성되는 공식 사진 URL 참조 장부. 핵심 DB와 분리되며 이용 허가 미확인 상태

## KCI·Crossref 상세정보 보강

교수-논문 연결의 기준 목록은 계속 대학 공식 프로필로 제한합니다. KCI나
Crossref 검색 결과만으로 논문을 새로 추가하지 않습니다.

- Crossref REST API: DOI, 저널, 저자, 발행일, 라이선스, 경우에 따라 초록과
  참고문헌 메타데이터를 제공합니다. 원문 제공 서비스는 아닙니다.
- KCI Open API: 국내 논문의 기본·상세·참고문헌·인용정보를 제공하며 발급받은
  API 키가 필요합니다.
- 보강 데이터는 `publication_metadata` 테이블에 제공기관, 외부 ID, 수집일,
  매칭 방식과 대조한 필드를 함께 저장합니다. 중복 판별용 내부 유사도 값이
  있더라도 교수 추천 점수로 해석하거나 사용자 화면에 노출하지 않습니다.
- 초록은 제공기관의 이용조건을 확인한 경우에만 저장·표시하고, 원문 PDF는
  공개 여부와 라이선스를 별도로 확인합니다.
- 제목만 같은 결과는 채택하지 않고 제목·연도·저자 중 확인 가능한 항목을
  함께 대조합니다.

## 전체 실행 판단 기준

2026-07-27 단국대 전체 실행에서 확인된 범위는 다음과 같습니다.

- 단국대: 단과대학 `20`, 학과·전공 `115`, 중복 제거 교수 `1,051`, 교수-학과 연결 `1,256`, 연구분야 `2,654`, 공식 프로필 연구실적 `55,899`를 정규화했습니다. 최초 구조 해석 실패 20명은 회귀 테스트와 재수집으로 모두 복구했습니다.
- 중앙 공식 교수 검색에도 결과가 없는 학과·전공 `3개`는 `PROFILE_UNAVAILABLE`로 남겨 데이터 범위를 `PARTIAL`로 표시합니다.
- 공식 사진 참조 장부는 교수 `623명`과 연결됐고, 사진 파일은 `0개` 다운로드했으며 앱 표시도 비활성입니다.
- 충북대: 검토된 시드 `1개`(소프트웨어학부), 교수 목록 23명 중 2명 출력 확인입니다. 중앙 디렉터리 차단 때문에 전 학과 분모 자체를 자동 확정하지 않았습니다.

```powershell
# 115개 학과 구조 호환성 선행 점검: 학과마다 교수 상세 1명
npm.cmd run professors:crawl -- --university dku --max-professors 1 --output data/professors/runs/dku-preflight

# 단국대 발견 범위 전체
npm.cmd run professors:crawl -- --university dku --output data/professors/runs/dku-full

# 현재 허용·검토된 범위 전체: 단국대 + 충북대 시드 1개
# 충북대 전 학과 완료를 뜻하지 않으며 manifest는 PARTIAL로 남습니다.
npm.cmd run professors:crawl -- --university all --output data/professors/runs/current-allowed-full
```

Crossref/KCI 보정은 공식 프로필 논문 건수만큼 별도 API 요청이 늘 수 있으므로 첫 전체 수집과 분리하고 `--enrich-max`로 제한하는 편이 안전합니다.

## 상태

| 상태 | 의미 |
|---|---|
| `FOUND` | 공식 프로필에서 연구분야 또는 논문 목록을 확인 |
| `NOT_LISTED_ON_OFFICIAL_PROFILE` | 프로필은 있으나 해당 목록이 노출되지 않음 |
| `PROFILE_UNAVAILABLE` | 공식 상세 프로필 URL 또는 페이지를 사용할 수 없음 |
| `PARSE_FAILED` | 페이지는 받았지만 예상 구조를 안전하게 해석하지 못함 |
| `ROBOTS_BLOCKED` | 해당 URL을 robots 정책 때문에 요청하지 않음 |

레코드의 `status` 외에 `research_fields_status`와 `publications_status`를 별도로 둡니다. 연구분야는 확인됐지만 논문 목록은 공개되지 않은 경우를 잃지 않기 위해서입니다.

## 수집 안전장치

1. 모든 요청 전 최종 URL까지 호스트별 `robots.txt`를 평가합니다.
2. robots를 읽지 못하면 엄격 모드에서 요청을 차단합니다. 404/410은 표준에 따라 규칙 없음으로 처리합니다.
3. 리디렉션은 수동으로 따라가며 새 호스트의 robots를 다시 확인합니다.
4. 대학 공식 도메인(`*.dankook.ac.kr`, `*.cbnu.ac.kr`, `*.chungbuk.ac.kr`) 이외의 URL은 대학 페이지 수집기로 요청하지 않습니다.
5. 호스트별 속도 제한, `429/5xx` 재시도, 타임아웃, SHA-256 콘텐츠 해시와 캐시를 적용합니다.
6. 영속 캐시는 학과·교수·연구분야·연구실적·탐색 링크만 재구성하며, 원문 HTML 전체는 저장하지 않습니다.
7. 스키마 검증기는 금지 키와 이메일·전화·이미지 URL 형태가 핵심 데이터에 섞이면 실패시킵니다. 사진 URL은 분리된 참조 장부 전용 파서만 다룹니다.

## 충북대 전 학과 확장 절차

중앙 호스트 차단을 우회하지 않습니다. 다음 중 하나가 확보될 때 시드를 늘립니다.

1. 대학이 제공하는 robots 허용 공식 학과 목록/API
2. 대학의 명시적 크롤링 허가
3. 사람이 공식 링크와 각 호스트 robots를 검토한 학과 홈페이지 목록

새 시드는 `college`, `department`, `homepage_url`, 선택적 `profile_url`, 검토 근거를 기록합니다. 추가 후 반드시 제한 샘플을 실행하고 `manifest.json`의 `robots_audit`와 상태를 확인합니다.

## 오류 기록 규칙

- 어디서: `manifest.json`의 `source_url`·`official_profile_url`
- 왜: `failure_reason`과 상태
- 해결: 어댑터 또는 검토된 시드 갱신
- 예방: fixtures에 해당 HTML 구조를 개인정보 없이 축약해 추가하고 `npm.cmd run professors:test` 회귀 테스트 작성

### 2026-07-26 전체 실행 사전 중단

- 어디서: 단국대 첫 학과 교수 상세 레코드의 `content_hash` 검증
- 왜: 전화번호 탐지 정규식이 SHA-256 해시 앞부분의 숫자를 전화번호처럼 오인함. 실제 연락처가 저장된 것은 아님
- 해결: 정확한 64자리 16진수 `content_hash` 메타데이터만 전화번호 값 검사에서 제외
- 예방: 전화번호 형태로 시작하는 SHA-256 값도 허용하고 실제 이메일·전화 키와 값은 계속 거부하는 회귀 테스트를 데이터 테스트에 포함

### 2026-07-26 두 번째 전체 실행 중단

- 어디서: 단국대 두 번째 학과의 `official_profile_url` 검증
- 왜: 공식 URL 안의 숫자형 교원 식별자를 전화번호처럼 오인함
- 해결: URL 전체를 일반 문자열 정규식으로 검사하지 않고, 이메일·이미지 URL 및 `email`·`tel`·`fax` 같은 연락처형 쿼리 키만 별도로 거부
- 예방: 전화번호처럼 보이는 공식 숫자 식별자는 허용하고 연락처형 쿼리 키는 거부하는 양방향 회귀 테스트를 추가

### 2026-07-27 오프라인 전체 재구성 중단

- 어디서: 단국대 9번째 전공 처리 중 내부 24자리 레코드 ID 검증
- 왜: 전화번호 탐지 정규식이 내부 24자리 16진수 ID 일부를 전화번호처럼
  오인했고, 그 오류 문장이 외부 실패 레코드에 다시 포함됨. 실제 연락처가
  저장된 것은 아님
- 해결: 스키마가 생성하는 정확한 24자리 16진수 `id`만 개인정보 값 검사에서
  제외
- 예방: 전화번호처럼 시작하는 24자리 내부 ID는 통과하고 실제 연락처 키·URL
  쿼리는 계속 거부하는 회귀 테스트 추가

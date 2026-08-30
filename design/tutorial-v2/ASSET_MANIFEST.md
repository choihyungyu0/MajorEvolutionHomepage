# 튜토리얼 v2 자산 명세

| 파일 | 역할 | 제작 방식 | 런타임 |
| --- | --- | --- | --- |
| `public/brand/nyp-v04/logo/nyp-logo-symbol-generated-v01.png` | 공식 컬러 심벌 | OpenAI ImageGen 생성 후 투명 여백 제거·512px 최적화 | 헤더, 사이드바, 로딩 |
| `design/tutorial-v2/assets/nyp-logo-symbol-generated-source-v01.png` | 로고 생성 원본 | OpenAI ImageGen | 미사용, 제작 근거 보관 |
| `public/brand/nyp-v04/logo/nyp-logo-mark-mono-white-v02.svg` | 어두운 배경용 단색 심벌 | 코드 벡터 대체안 | 푸터 |
| `public/brand/nyp-v04/scenes/tutorial/nyp-scene-tutorial-first-path-16x9-v01.webp` | 튜토리얼 보조 장면 | OpenAI ImageGen 편집 후 WebP 최적화 | 데스크톱·모바일 튜토리얼 |
| `design/tutorial-v2/concepts/tutorial-desktop-1440x900-v01.png` | 데스크톱 UI 기준 시안 | OpenAI ImageGen | 미사용, 구현 기준 |
| `design/tutorial-v2/concepts/tutorial-mobile-390x844-v01.png` | 모바일 UI 기준 시안 | OpenAI ImageGen | 미사용, 구현 기준 |

## 생성 프롬프트 요약

- 로고: 대학생의 고민이 교수와의 첫 대화로 이어지는 두 인물·대화 연결 심벌. 네이비·보라·민트만 사용하고 로봇, 뇌, 회로, 학사모, 네온, 텍스트를 제외하도록 요청했다.
- 튜토리얼 장면: 기존 공식 캠퍼스·학생·가이드 무드를 참고하고 홀로그램 요소를 제거해 자연스러운 캠퍼스와 얇은 민트-보라 경로만 남겼다.
- UI 시안: 흰색 기반 2열 데스크톱과 단일 열 모바일, 실제 입력 필드, 얇은 테두리, 최소 그림자로 구성하고 보라색 전체 패널·글래스모피즘·가짜 통계를 제외했다.

## 사용 원칙

- 생성형 이미지 안에는 실제 UI 텍스트를 넣지 않는다.
- 한 화면에서 캐릭터나 로봇을 반복 사용하지 않는다.
- 생성형 심벌은 코드 기반 한글 워드마크와 결합해 가독성을 확보한다.
- 외부 배포 전 팀의 최종 상표·사용권 검토를 거친다.

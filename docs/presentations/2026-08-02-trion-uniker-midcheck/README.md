# 트리온 UNIKER 1기 중간점검 발표자료

2026년 8월 2일 발표에 사용한 웹 슬라이드 자료입니다.

## 운영 주소

- https://trion-uniker-midcheck-20260802.vercel.app/

## 구성

- `index.html`: 발표 슬라이드 전체 코드
- `styles.css`: 데스크톱·모바일 반응형 레이아웃과 발표 디자인
- `deck.js`: 슬라이드 이동, 해시 주소, 발표자 노트, 전체화면 제어
- `assets/`: 발표에 사용한 PNG 이미지 20개
- Vercel Web Analytics 추적 스크립트 포함
- Google Analytics 4는 측정 ID 발급 후 연결 예정

## 조작법

- 좌우 방향키 또는 화면 버튼으로 슬라이드 이동
- 주소의 `#slide-N` 형식으로 특정 슬라이드 바로 열기

## 배포

이 폴더를 Vercel 정적 프로젝트의 루트로 지정하면 배포할 수 있습니다. `index.html`, `styles.css`, `deck.js`, `assets/`를 항상 함께 배포해야 이미지와 모바일 레이아웃이 정상 표시됩니다.

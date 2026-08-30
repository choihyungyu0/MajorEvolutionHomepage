# 프론트 디자인 리서치 노트

## 목적

생성형 AI로 만든 웹사이트처럼 보이는 반복 패턴을 제거하고, `너의 교수님은?`의 서비스 목적에 맞는 일관된 UI 규칙을 만든다. 커뮤니티 의견은 문제 징후를 찾는 참고 자료로만 사용하고, 실제 수치와 구현 규칙은 디자인 시스템·UX 전문 자료로 교차 확인했다.

## 반복적으로 발견된 문제

1. **모든 것을 카드로 감싸는 구조**
   - 둥근 카드, 옅은 그림자, 칩과 배지가 한 화면에 반복되면 각각은 깔끔해도 전체가 템플릿처럼 보인다.
   - HPE Design System은 구분선을 계속 추가하기보다 여백·타이포·배경색으로 위계를 만들도록 권한다.
2. **화면마다 달라지는 시각 규칙**
   - DEV Community의 UI 일관성 글은 반경, 그림자, 강조색, 간격, 아이콘, 타입 스케일, 동작 시간처럼 축마다 한 가족을 정하고 토큰으로 반복해야 한다고 정리한다.
3. **보라 그라데이션과 균일한 카드 배열**
   - 개발자 커뮤니티에서 AI 템플릿의 흔한 징후로 보라-파랑 그라데이션, 큰 둥근 카드, 동일한 3열 배열, 균일한 패딩이 반복해서 지적됐다.
4. **강약 없는 정보**
   - Nielsen Norman Group은 상대적 크기로 중요도를 보여주고, 한 화면에서 2~3개의 타입 크기로 시선을 안내하도록 권한다.
   - DesignCourse도 제목·보조 문구·설명이 같은 무게로 보일 때 크기, 굵기, 색, 간격으로 역할을 분리하라고 설명한다.
5. **자의적인 이미지 크기**
   - UCLA와 Material 가이드는 화면마다 임의 높이를 쓰지 말고 16:9, 3:2, 4:3, 1:1 등 정해진 비율을 반복해 레이아웃 리듬을 유지하도록 안내한다.
6. **기준 없는 여백**
   - Atlassian과 Material은 8px를 기본 단위로 사용한다. 모바일 좌우 여백은 16px, 터치 대상은 최소 48×48px을 기본값으로 잡았다.
7. **주 행동이 콘텐츠와 떨어지는 문제**
   - Toss Design System Mobile은 강한 `fill` 버튼을 주요 행동에 쓰고, 모바일에서는 부모 너비를 채우는 `full` 표시와 Bottom CTA·SafeArea가 함께 동작하도록 설계한다.
   - 따라서 첫 화면은 이미지와 설명을 하나의 시작 장면으로 합치고, 주 버튼은 전체 너비·안전 영역을 고려한 하단 행동으로 유지했다.

## 이번 구현에 적용한 결정

- 페이지 기본 배경은 실제 흰색으로 통일한다.
- 8px 기본 간격과 4px 보조 단위만 사용한다.
- 반경은 `8 / 12 / 16px` 세 단계로 제한하고, pill은 실제 상태·태그에만 쓴다.
- 기본 카드 그림자는 제거하고, 구조가 필요할 때만 1px 선 또는 왼쪽 강조선을 쓴다.
- 기본 CTA는 단색 보라로 통일하고 그라데이션과 발광 그림자를 제거한다.
- 아이콘은 Lucide 2px outline 계열로 통일한다.
- 일반 튜토리얼 장면은 16:9로 고정하고, 모바일 첫 시작 장면만 제목·설명을 이미지 위에 합친 제한 높이 배너로 쓴다. 390×844 첫 화면에서 CTA를 가리지 않는지를 우선했다.
- 튜토리얼 이미지에서 로봇과 발광 경로를 제거해 ‘AI 도우미’ 장식보다 학생의 실제 고민 맥락이 먼저 보이게 했다.
- 첫 화면에서 진행 상태와 제목이 이미 역할을 설명하므로, 중복되는 `첫 교수 연결 튜토리얼` 라벨은 제거했다.

## 참고 자료

- DesignCourse, *Understanding Visual Hierarchy in UI Design*: https://www.youtube.com/watch?v=ZYs0_t_Gdhk
- DesignCourse, *Typographic Visual Hierarchy in UI Design*: https://designcourse.com/blog/post/typographic-visual-hierarchy-in-ui-design-4-examples
- Flux Academy 영상 요약, *The details that make or break your web design*: https://designingforuncertainty.com/2024/10/25/the-details-that-make-or-break-your-web-design/
- Nielsen Norman Group, *Visual Design Principles*: https://media.nngroup.com/media/articles/attachments/Principles_Visual_Design-A4.pdf
- Atlassian Design System, *Spacing*: https://atlassian.design/foundations/grid-beta/applying-grid
- Material Design, *Metrics & keylines*: https://m1.material.io/layout/metrics-keylines.html
- Toss Design System Mobile, *Button*: https://tossmini-docs.toss.im/tds-mobile/components/button/
- Toss Design System Mobile, *useToast / BottomCTA와 SafeArea 고려*: https://tossmini-docs.toss.im/tds-mobile/hooks/OverlayExtension/use-toast/
- UCLA Design System, *Images*: https://designsystem.brand.ucla.edu/build/v2.1.0/docs/style-guide/images.html
- HPE Design System, *Spacing*: https://design-system.hpe.design/foundation/spacing
- DEV Community, *Why AI-Generated UIs Look Off*: https://dev.to/kiwibreaksme/why-ai-generated-uis-look-off-and-the-one-principle-that-fixes-it-4j20
- DEV Community, *Why Every AI-Generated Template Looks the Same*: https://dev.to/binbreeze/why-every-ai-generated-template-looks-the-same-and-how-im-fighting-it-3lo2
- r/UXDesign 토론, *AI-generated UI proves people value design, but not designers*: https://www.reddit.com/r/UXDesign/comments/1tvt03p/aigenerated_ui_proves_people_value_design_but_not/

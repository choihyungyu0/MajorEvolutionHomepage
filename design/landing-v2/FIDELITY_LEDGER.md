# Landing v2 Fidelity Ledger

## Accepted visual references

- `concepts/landing-hero-concept-v1.png`
- `concepts/landing-flow-concept-v1.png`
- `concepts/landing-trust-cta-concept-v1.png`

The concepts are visual references only. Runtime copy, controls, and layout are implemented in code, while illustrations use the confirmed official `public/brand/nyp-v03` assets.

## Comparison results

1. **Above-the-fold copy — pass**
   - H1: `막막한 전공·진로 고민, 이제 누구와 이야기할지부터 찾으세요.`
   - Support: `고민을 정리하고, 학교 공식 정보로 교수를 찾고, 첫 질문과 다음 행동까지 준비합니다.`
   - CTAs: `3분 방향 찾기`, `서비스 흐름 보기`
   - Trust line: `학교 공식 정보 기반 · 교수에게 자동으로 연락하지 않아요`
   - No extra eyebrow, badge, metric, or unverified claim was added above the fold.

2. **Hero composition — pass**
   - Desktop retains the accepted text-left, official-campus-scene-right composition.
   - Mobile stacks copy, actions, trust line, and image in the intended reading order.

3. **Brand palette — pass**
   - True white, deep navy, violet, and mint match the confirmed brand system.
   - Gradients are restricted to accents and CTAs rather than washing over the official artwork.

4. **Typography and hierarchy — pass**
   - Pretendard is used throughout.
   - The desktop H1 stays compact and high contrast; the mobile H1 wraps without clipping or horizontal overflow.
   - Section labels, headings, body copy, and cards retain a clear hierarchy.

5. **Official asset fidelity — pass**
   - The hero and section imagery come from `public/brand/nyp-v03` rather than generated UI screenshots.
   - Generated concepts are not shipped as product UI and contain no runtime text.

6. **Narrative rhythm — pass**
   - The implemented order is problem, promise, three-step flow, concrete outcomes, trust principles, audience, and closing CTA.
   - This preserves the conventional landing-page funnel represented by the accepted concepts.

7. **Interaction and destination clarity — pass**
   - Primary CTA opens the guided direction-finding tutorial at `/tutorial`.
   - `서비스 흐름 보기` moves to `#flow`.
   - Returning users enter the internal product home at `/home`.
   - The mobile navigation opens, exposes the same anchors, and closes correctly.

8. **Responsive implementation — pass**
   - Verified at 1440 x 900 and 390 x 844.
   - No horizontal overflow was observed, and all official images loaded after scrolling.

## Intentional deviations

- The header combines the official brand mark with a code-native wordmark and tagline; the footer retains the official monochrome wordmark.
- The concept's partial next-section card at the bottom of the hero was replaced by a compact `왜 필요한가요?` scroll cue so the first viewport remains focused on one decision.
- The closing section uses the official `next-seed` growth scene rather than the concept's professor-door illustration, keeping the ending focused on the student's next action.
- The header action is labeled `이어하기` rather than a generic `로그인`, because an existing user is returning to the internal service home.

## Verification evidence

- Desktop: `verification/landing-desktop-1440x900.png`
- Desktop full page: `verification/landing-desktop-full.png`
- Mobile: `verification/landing-mobile-390x844.png`
- Mobile full page: `verification/landing-mobile-full.png`
- Additional flow, trust, and closing-section screenshots are stored in `verification/`.

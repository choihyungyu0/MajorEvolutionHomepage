# Design QA — Journey Stage Heroes

- source visual truth: `docs/qa/journey-stage-heroes-2026-08-30/source-visual-target.png`
- implementation comparison: `docs/qa/journey-stage-heroes-2026-08-30/source-vs-implementation-v02.png`
- desktop viewport: `1440 x 1024` CSS px, device scale factor 1
- mobile viewport: `390 x 844` CSS px, device scale factor 1
- source pixels: `1487 x 1058`
- implementation hero pixels / CSS size:
  - project: `1073 x 288`
  - recommendation: `1113 x 288`
  - meeting: `1089 x 288`
- state: stored project candidate and project mentor available; project execution draft seeded for persistence QA

## Full-view evidence

- project: `docs/qa/journey-stage-heroes-2026-08-30/final-project-hero-desktop.png`
- recommendation: `docs/qa/journey-stage-heroes-2026-08-30/final-recommend-hero-desktop.png`
- meeting: `docs/qa/journey-stage-heroes-2026-08-30/final-meeting-hero-desktop.png`
- mobile recommendation: `docs/qa/journey-stage-heroes-2026-08-30/final-recommend-hero-mobile.png`
- mobile meeting: `docs/qa/journey-stage-heroes-2026-08-30/final-meeting-hero-mobile.png`
- project execution home: `docs/qa/journey-stage-heroes-2026-08-30/project-execution-desktop.png`
- project advisory desktop: `docs/qa/journey-stage-heroes-2026-08-30/project-meeting-desktop.png`
- project advisory mobile: `docs/qa/journey-stage-heroes-2026-08-30/project-meeting-mobile.png`

## Focused comparison evidence

A focused comparison was required because the source visual specifies only the three stage headers, while the real routes continue into different functional content. The comparison board places the selected source and the three implementation hero crops together at normalized width:

- `docs/qa/journey-stage-heroes-2026-08-30/source-vs-implementation-v02.png`

## Required fidelity surfaces

- fonts and typography: existing Pretendard typography is preserved. Live H1 text uses `31–46px`, high optical weight, balanced wrapping and navy foreground. Mobile titles reflow without clipping.
- spacing and layout rhythm: all three heroes share `288px` desktop height, `26px` radius, consistent internal padding and stage-label placement. Existing page container widths remain intentionally different by route.
- colors and visual tokens: project uses lavender `#6847e8`, recommendation uses mint `#138f82`, and meeting uses coral `#e86c4d`. Page tint, hero label, active navigation and primary action inherit the stage accent.
- image quality and asset fidelity: each stage uses a dedicated generated `1600 x 560` WebP. Assets are decorative with empty alt text, use a left copy-safe area and retain crisp focal motifs at desktop and mobile crops.
- copy and content: source placeholder copy is replaced with the existing dynamic service copy. Meaning, progress stage and CTA behavior are preserved.

## Interaction and accessibility checks

- meeting → project and meeting → recommendation navigation works.
- project result keeps its existing focused top bar and sticky result action instead of adding a second persistent bottom control.
- mobile horizontal overflow: none on all three routes.
- browser console errors and warnings: none.
- stage identity is communicated by label, icon, imagery and color; color is not the only cue.
- decorative background images are excluded from the accessibility tree.
- project recommendation CTA opens `/project-execution`, and the execution home opens `/project-meeting`.
- project advisory goal and material checklist persist under a project-only `topicId + professorId` key after page reload.
- general professor meeting and project advisory professor selections coexist without overwriting one another.
- project advisory mobile action dock ends above the bottom navigation and no element exceeds the 390px viewport.

## Project execution flow extension

- recommendation remains the evidence-led professor selection surface.
- execution home is a resumable dashboard, not a second recommendation page: it shows the selected project, selected advisor, four-stage progress and one editable next action.
- project advisory is visually tied to the lavender project family while its title, purpose notice and storage contract clearly distinguish it from the coral general meeting flow.
- direct entry without a project or project advisor returns a useful recovery card instead of rendering invented context.
- the project navigation destination changes to the execution home only when the selected topic, recommendation response and selected professor still match.

## Annotation closeout QA

### Project design entry

- before: `docs/qa/annotation-closeout-2026-08-30/research-entry-two-modes-audit.png`
- guided review evidence: `docs/qa/annotation-closeout-2026-08-30/research-entry-guided-review.png`
- direct-form evidence: `docs/qa/annotation-closeout-2026-08-30/research-entry-direct-form.png`
- desktop final: `docs/qa/annotation-closeout-2026-08-30/final-research-entry-desktop.png`
- mobile final: `docs/qa/annotation-closeout-2026-08-30/final-research-entry-mobile.png`
- two equal entry cards were replaced by one adaptive start/resume action. Saved-condition editing remains a lower-emphasis utility and opens `/research/conditions?view=review` directly.

### Co-design studio

- desktop final: `docs/qa/annotation-closeout-2026-08-30/final-co-design-desktop.png`
- mobile final: `docs/qa/annotation-closeout-2026-08-30/final-co-design-mobile.png`
- dedicated 1600×1000 background asset is visibly retained after the shared app-shell rules.
- mode identity changes by text, selected state and accent token: free=mint, trend=lavender, fusion=coral.
- cards keep high-opacity surfaces over the decorative canvas so body copy and inputs remain legible.

### Professor matching

- desktop final: `docs/qa/annotation-closeout-2026-08-30/final-professor-match-desktop.png`
- mobile final: `docs/qa/annotation-closeout-2026-08-30/final-professor-match-mobile.png`
- cobalt search/compass hero distinguishes professor discovery from mint project recommendation and coral meeting preparation.
- hero crop keeps the copy-safe left side readable at 1440px, 1075px and 390px.

### Closeout checks

- saved-condition utility lands on the review summary, not the first step.
- mobile horizontal overflow: zero on project entry, co-design and professor matching at 360px, 390px and 430px.
- browser console errors and warnings: zero after final navigation.
- no project input, professor selection or existing result was cleared by the visual changes.

## Project and growth hub closeout QA

### Project design home

- desktop final: `docs/qa/project-growth-hubs-2026-08-30/final-project-design-home-desktop.png`
- mobile final: `docs/qa/project-growth-hubs-2026-08-30/final-project-design-home-mobile.png`
- `/research` is now a state-aware project home instead of opening the condition editor immediately.
- the primary action resumes the user's furthest valid stage; explicit condition editing remains available at `/research/conditions`.
- four visible stages, the saved-condition summary, candidate preview and one next-action card make the project journey readable without inventing data.
- the project item in the shared navigation always returns to this home, while task-specific controls link to the editor or current result.

### Growth journey home

- desktop final: `docs/qa/project-growth-hubs-2026-08-30/final-growth-hub-desktop.png`
- mobile final: `docs/qa/project-growth-hubs-2026-08-30/final-growth-hub-mobile.png`
- a dedicated warm-ivory growth canvas and compact progress summary distinguish the growth tab from matching, meeting and project execution.
- the existing AI professor card remains the main action; the new summary shows recorded milestones, project state, professor connection state and the next record without adding a competing CTA.
- both pages render without horizontal overflow at 360px, 390px and 430px, and keep their main action visible and readable at 1440px.

## Comparison history

### Iteration 1

- [P2] Meeting background looked like interior photography while project and recommendation used airy editorial illustration.
- Fix: regenerated the meeting asset as low-texture flat + soft-3D editorial illustration while preserving the two-chair, notebook and calendar composition.

### Iteration 2

- Post-fix comparison shows one consistent illustration family across all three stages.
- No actionable P0, P1 or P2 findings remain.

## Follow-up polish

- [P3] The project motif is intentionally quieter than the selected concept so the longer live candidate title remains readable.
- [P3] The source concept includes the bottom navigation inside every board row; the project result route intentionally retains its existing focused stepper and sticky action instead of stacking two persistent controls.

## Implementation checklist

- [x] Three distinct stage background assets
- [x] Shared responsive hero component
- [x] Stage-specific page tint and active navigation color
- [x] Desktop and 390px mobile capture
- [x] Source-versus-implementation focused comparison
- [x] P2 visual inconsistency fixed and rechecked
- [x] Separate project execution home and project advisory preparation screens
- [x] Project-only autosave, recovery states and dynamic navigation return
- [x] Desktop and 390px project advisory interaction QA
- [x] Single adaptive project-entry flow and review-editor recovery
- [x] Co-design background plus three mode-specific accent states
- [x] Professor-matching cobalt hero at desktop and mobile
- [x] State-aware project design home with a separate condition editor route
- [x] Distinct growth journey canvas and responsive progress summary

final result: passed

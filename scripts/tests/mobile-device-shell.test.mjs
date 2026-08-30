import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const layoutSource = read("../../app/layout.tsx");
const manifestSource = read("../../app/manifest.ts");
const globalStyleSource = read("../../app/globals.css");
const viewportSyncSource = read("../../components/app/mobile-viewport-sync.tsx");
const aiProfessorStyleSource = read("../../components/screens/ai-professor-screen.module.css");
const professorTutorialStyleSource = read("../../components/tutorial/professor-tutorial.module.css");

test("mobile app shell keeps the viewport edge-to-edge and installable", () => {
  assert.match(layoutSource, /viewportFit:\s*["']cover["']/);
  assert.match(layoutSource, /<MobileViewportSync\s*\/>/);
  assert.match(manifestSource, /display:\s*["']standalone["']/);
  assert.match(manifestSource, /orientation:\s*["']portrait["']/);
  assert.match(manifestSource, /purpose:\s*["']maskable["']/);
});

test("visual viewport changes update keyboard and visible-height tokens", () => {
  assert.match(viewportSyncSource, /window\.visualViewport/);
  assert.match(viewportSyncSource, /--app-visual-viewport-height/);
  assert.match(viewportSyncSource, /--app-keyboard-inset/);
  assert.match(viewportSyncSource, /addEventListener\(["']resize["'],\s*syncViewport/);
  assert.match(viewportSyncSource, /addEventListener\(["']scroll["'],\s*syncViewport/);
  assert.match(viewportSyncSource, /activeElement\.matches\(['"]input, textarea, select, \[contenteditable=/);
  assert.match(viewportSyncSource, /keyboardInset\s*>\s*96\s*\|\|\s*\(isMobileWidth\s*&&\s*isEditing\)/);
  assert.match(viewportSyncSource, /addEventListener\(["']focusin["'],\s*syncViewport/);
  assert.match(viewportSyncSource, /removeEventListener\(["']scroll["'],\s*syncViewport\)/);
});

test("mobile controls, safe areas, and fixed navigation remain usable", () => {
  assert.match(globalStyleSource, /--app-safe-top:\s*env\(safe-area-inset-top/);
  assert.match(globalStyleSource, /--app-safe-bottom:\s*env\(safe-area-inset-bottom/);
  assert.match(globalStyleSource, /@supports\s*\(height:\s*100dvh\)/);
  assert.match(globalStyleSource, /@media\s*\(max-width:\s*767px\)[\s\S]*?:is\(input[^}]+font-size:\s*16px/);
  assert.match(globalStyleSource, /html\[data-app-keyboard-open\]\s+\.service-bottom-nav/);
  assert.match(globalStyleSource, /html:has\(input:focus,\s*textarea:focus,\s*select:focus\)\s+\.service-bottom-nav/);
  assert.match(globalStyleSource, /touch-action:\s*manipulation/);
});

test("conversation and tutorials use the visible viewport on short phones", () => {
  assert.match(aiProfessorStyleSource, /var\(--app-visual-viewport-height,\s*100dvh\)/);
  assert.match(aiProfessorStyleSource, /@media\s*\(max-width:\s*719px\)\s*and\s*\(max-height:\s*700px\)/);
  assert.match(aiProfessorStyleSource, /@media\s*\(max-width:\s*719px\)[\s\S]*?calc\(var\(--app-visual-viewport-height,\s*100dvh\)\s*-\s*410px\)/);
  assert.match(aiProfessorStyleSource, /html\[data-app-keyboard-open\][\s\S]*?\.conversation/);
  assert.match(aiProfessorStyleSource, /scroll-padding-bottom:\s*calc\(24px\s*\+\s*var\(--app-keyboard-inset/);
  assert.match(professorTutorialStyleSource, /min-height:\s*var\(--app-visual-viewport-height,\s*100dvh\)/);
  assert.match(professorTutorialStyleSource, /var\(--app-safe-top,\s*0px\)/);
});

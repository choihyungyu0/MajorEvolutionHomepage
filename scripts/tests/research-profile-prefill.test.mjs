import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadAcademicOptions() {
  const source = readFileSync(new URL("../../data/academic-options.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", compiled)(loaded.exports, loaded);
  return loaded.exports;
}

const academic = loadAcademicOptions();

test("저장된 프로젝트 조건이 비어 있으면 프로필의 학교 전공 관심사를 기본값으로 사용한다", () => {
  assert.equal(typeof academic.mergeAcademicProfileDefaults, "function");

  const merged = academic.mergeAcademicProfileDefaults({
    school: "",
    majorArea: null,
    major: null,
    interests: [],
  }, {
    school: "단국대학교",
    major: "컴퓨터공학과",
    interests: ["교육·학습", "미디어·콘텐츠", "언어·커뮤니케이션", "경제·금융"],
  });

  assert.deepEqual(merged, {
    school: "단국대학교",
    majorArea: "공학·IT",
    major: "컴퓨터공학과",
    interests: ["교육·학습", "미디어·콘텐츠", "언어·커뮤니케이션"],
  });
});

test("이미 저장된 프로젝트 조건은 프로필보다 우선한다", () => {
  const merged = academic.mergeAcademicProfileDefaults({
    school: "서울대학교",
    majorArea: "사회·정책",
    major: "행정학과",
    interests: ["정책 효과"],
  }, {
    school: "단국대학교",
    major: "컴퓨터공학과",
    interests: ["AI·머신러닝"],
  });

  assert.deepEqual(merged, {
    school: "서울대학교",
    majorArea: "사회·정책",
    major: "행정학과",
    interests: ["정책 효과"],
  });
});

test("전공명은 비어 있고 계열만 남아 있으면 프로필 전공명과 일치하는 계열로 함께 보정한다", () => {
  const merged = academic.mergeAcademicProfileDefaults({
    school: "단국대학교",
    majorArea: "사회·정책",
    major: null,
    interests: [],
  }, {
    school: "단국대학교",
    major: "컴퓨터공학과",
    interests: ["AI·머신러닝"],
  });

  assert.equal(merged.major, "컴퓨터공학과");
  assert.equal(merged.majorArea, "공학·IT");
});

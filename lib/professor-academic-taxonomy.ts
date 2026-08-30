export type ProfessorAcademicCollege = {
  name: string;
  departments: string[];
};

export type ProfessorAcademicTaxonomy = {
  university: "단국대학교";
  officialProfessorCount: number;
  colleges: ProfessorAcademicCollege[];
  unmappedDepartments: string[];
};

export type ProfessorAcademicAffiliationRecord = {
  college: string;
  departments: string[];
};

const COMBINED_AFFILIATION_SEPARATOR = " · ";

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function comparableDepartmentName(value: string): string {
  return clean(value)
    .replace(/\s+/g, "")
    .replace(/학과$/u, "학")
    .replace(/학부$/u, "")
    .replace(/전공$/u, "");
}

/**
 * 런타임 교수 데이터는 다중 소속의 단과대와 학과를 각각 합쳐 저장합니다.
 * 두 배열의 정확한 대응 관계를 추측하지 않기 위해 단일 단과대 레코드만
 * 공식 종속 선택지로 만들고, 나머지는 직접 입력 후보로 분리합니다.
 */
export function buildProfessorAcademicTaxonomy(
  records: ProfessorAcademicAffiliationRecord[],
  officialProfessorCount: number,
  coverageGapDepartments: string[] = [],
): ProfessorAcademicTaxonomy {
  const collegeDepartments = new Map<string, Set<string>>();
  const allDepartments = new Set<string>();

  for (const record of records) {
    const college = clean(record.college);
    const departments = record.departments.map(clean).filter(Boolean);
    departments.forEach((department) => allDepartments.add(department));

    if (!college || college.includes(COMBINED_AFFILIATION_SEPARATOR)) continue;
    const bucket = collegeDepartments.get(college) ?? new Set<string>();
    departments.forEach((department) => bucket.add(department));
    collegeDepartments.set(college, bucket);
  }

  coverageGapDepartments.map(clean).filter(Boolean).forEach((department) => {
    allDepartments.add(department);
  });

  const mappedDepartments = new Set(
    [...collegeDepartments.values()].flatMap((departments) => [...departments]),
  );
  const colleges = [...collegeDepartments.entries()]
    .map(([name, departments]) => ({
      name,
      departments: [...departments].sort((left, right) => left.localeCompare(right, "ko-KR")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));

  return {
    university: "단국대학교",
    officialProfessorCount,
    colleges,
    unmappedDepartments: [...allDepartments]
      .filter((department) => !mappedDepartments.has(department))
      .sort((left, right) => left.localeCompare(right, "ko-KR")),
  };
}

export function findAcademicSelection(
  taxonomy: ProfessorAcademicTaxonomy,
  major: string,
): { college: string; department: string } | null {
  const comparable = comparableDepartmentName(major);
  if (!comparable) return null;

  const matches = taxonomy.colleges.flatMap((college) =>
    college.departments
      .filter((department) => comparableDepartmentName(department) === comparable)
      .map((department) => ({ college: college.name, department })),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function getDepartmentsForCollege(
  taxonomy: ProfessorAcademicTaxonomy,
  college: string,
): string[] {
  return taxonomy.colleges.find((item) => item.name === college)?.departments ?? [];
}

export function countMappedDepartments(taxonomy: ProfessorAcademicTaxonomy): number {
  return new Set(taxonomy.colleges.flatMap((college) => college.departments)).size;
}

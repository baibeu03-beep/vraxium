import { NextResponse } from "next/server";
import schoolDataJson from "@/data/korea-schools.json";
import { createAdminClient } from "@/lib/supabase-server";

const schoolData: { [key: string]: string[] } = schoolDataJson;

// 한글 학력 라벨 → DB school_type 영문 매핑.
// 단일 소스: Supabase schools.school_type 컬럼 분포에 맞춤.
//   elementary 6347 / middle 3311 / high 2389 / university 476
const SCHOOL_TYPE_MAP: { [key: string]: string } = {
  초등학교: "elementary",
  중학교: "middle",
  고등학교: "high",
  대학교: "university",
};

// NEIS API fallback 시 SCHUL_KND_SC_NM 한글 매핑 (Supabase 실패 + NEIS key 있을 때만 사용).
const NEIS_SCHOOL_KIND: { [key: string]: string } = {
  초등학교: "초등학교",
  중학교: "중학교",
  고등학교: "고등학교",
};

type SchoolItem = {
  id: string;
  name: string;
  school_name: string;
  schoolType: string;
  school_type: string;
  region: string | null;
};

// 문자열만 들어오는 fallback 경로(NEIS / 정적 JSON)에서 object shape으로 통일.
function toItem(name: string, schoolType: string, region?: string | null, idHint?: string): SchoolItem {
  return {
    id: idHint ?? `${schoolType}:${name}`,
    name,
    school_name: name,
    schoolType,
    school_type: schoolType,
    region: region ?? null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const eduLevel = searchParams.get("eduLevel") || "";

  if (query.length < 2) {
    return NextResponse.json({ success: true, schools: [] });
  }

  const schoolType = SCHOOL_TYPE_MAP[eduLevel];

  // ─────────────────────────────────────────────
  // 1순위: Supabase schools 테이블 (총 12,523행, 초/중/고/대 4종).
  //   - eduLevel "대학원" 은 university 결과를 가져와 ' 대학원' suffix 부여.
  //   - 한글 eduLevel 미매핑 (예: "전문대학") 은 Supabase 건너뛰고 정적 JSON 사용.
  // ─────────────────────────────────────────────
  if (schoolType || eduLevel === "대학원") {
    const targetType = eduLevel === "대학원" ? "university" : schoolType;
    const queryClean = eduLevel === "대학원"
      ? query.replace(/\s*대학원\s*$/, "").trim()
      : query.trim();

    if (queryClean.length >= 2) {
      try {
        const sb = createAdminClient();
        const { data, error } = await sb
          .from("schools")
          .select("id, school_name, school_type, region")
          .eq("school_type", targetType)
          .ilike("school_name", `%${queryClean}%`)
          .order("school_name", { ascending: true })
          .limit(50);

        if (!error && Array.isArray(data)) {
          const items: SchoolItem[] = data.map((row) => ({
            id: row.id,
            name: eduLevel === "대학원" ? `${row.school_name} 대학원` : row.school_name,
            school_name: eduLevel === "대학원" ? `${row.school_name} 대학원` : row.school_name,
            schoolType: row.school_type,
            school_type: row.school_type,
            region: row.region ?? null,
          }));
          return NextResponse.json({ success: true, schools: items });
        }
        if (error) {
          console.error("[/api/schools/search] supabase error:", error.message);
        }
      } catch (err) {
        console.error("[/api/schools/search] supabase exception:", err);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 2순위 (fallback): 초/중/고 NEIS open API — Supabase 결과 비었을 때만.
  //   key 미설정 시 빈 배열.
  // ─────────────────────────────────────────────
  const schulKind = NEIS_SCHOOL_KIND[eduLevel];
  if (schulKind) {
    const apiKey = process.env.NEIS_API_KEY;
    if (apiKey) {
      try {
        const url = new URL("https://open.neis.go.kr/hub/schoolInfo");
        url.searchParams.set("KEY", apiKey);
        url.searchParams.set("Type", "json");
        url.searchParams.set("pIndex", "1");
        url.searchParams.set("pSize", "20");
        url.searchParams.set("SCHUL_NM", query);
        url.searchParams.set("SCHUL_KND_SC_NM", schulKind);

        const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
        const data = await res.json();
        const rows = data?.schoolInfo?.[1]?.row;
        if (Array.isArray(rows)) {
          const seen = new Set<string>();
          const items: SchoolItem[] = [];
          for (const r of rows) {
            const name: string = r?.SCHUL_NM;
            if (!name || seen.has(name)) continue;
            seen.add(name);
            items.push(toItem(name, schoolType, r?.LCTN_SC_NM ?? null, `neis:${r?.SD_SCHUL_CODE ?? name}`));
          }
          return NextResponse.json({ success: true, schools: items });
        }
      } catch (err) {
        console.error("[/api/schools/search] NEIS exception:", err);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 3순위 (fallback): 정적 JSON — Supabase / NEIS 둘 다 실패 + 전문대학·기타 라벨.
  //   대학원은 정적 JSON 기반으로 ' 대학원' suffix.
  // ─────────────────────────────────────────────
  if (eduLevel === "대학원") {
    const list = schoolData["대학교"] || [];
    const queryLower = query.toLowerCase().replace(/ 대학원$/, "").replace(/대학원$/, "");
    const filtered = list
      .filter((s) => s.toLowerCase().includes(queryLower))
      .map((s) => `${s} 대학원`);
    const items = filtered.map((n) => toItem(n, "university"));
    return NextResponse.json({ success: true, schools: items });
  }

  const list = schoolData[eduLevel] || [];
  if (list.length > 0) {
    const filtered = list.filter((s) => s.toLowerCase().includes(query.toLowerCase()));
    const fallbackType = schoolType ?? eduLevel;
    const items = filtered.map((n) => toItem(n, fallbackType));
    return NextResponse.json({ success: true, schools: items });
  }

  return NextResponse.json({ success: true, schools: [] });
}

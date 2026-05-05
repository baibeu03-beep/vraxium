import { NextResponse } from "next/server";
import schoolDataJson from "@/data/korea-schools.json";

const schoolData: { [key: string]: string[] } = schoolDataJson;

// NEIS API에서 사용하는 학교종류 매핑
const neisSchoolKind: { [key: string]: string } = {
  "초등학교": "초등학교",
  "중학교": "중학교",
  "고등학교": "고등학교",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const eduLevel = searchParams.get("eduLevel") || "";

  // 2글자 미만이면 빈 배열
  if (query.length < 2) {
    return NextResponse.json({ success: true, schools: [] });
  }

  // 대학교: 정적 JSON에서 필터링
  if (eduLevel === "대학교") {
    const list = schoolData["대학교"] || [];
    const filtered = list.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
    return NextResponse.json({ success: true, schools: filtered });
  }

  // 대학원: 대학교 목록 기반으로 " 대학원" 붙여서 반환
  if (eduLevel === "대학원") {
    const list = schoolData["대학교"] || [];
    const queryLower = query.toLowerCase().replace(/ 대학원$/, "").replace(/대학원$/, "");
    const filtered = list
      .filter((s) => s.toLowerCase().includes(queryLower))
      .map((s) => `${s} 대학원`);
    return NextResponse.json({ success: true, schools: filtered });
  }

  // 초/중/고: NEIS API 호출
  const schulKind = neisSchoolKind[eduLevel];
  if (schulKind) {
    const apiKey = process.env.NEIS_API_KEY;
    if (!apiKey) {
      // API 키 미설정 시 빈 배열 반환 (fallback: 직접 입력만 가능)
      return NextResponse.json({ success: true, schools: [], fallback: true });
    }

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
      if (!rows || !Array.isArray(rows)) {
        return NextResponse.json({ success: true, schools: [] });
      }

      const schools = rows.map((r: { SCHUL_NM: string }) => r.SCHUL_NM);
      // 중복 제거
      const unique = [...new Set(schools)];
      return NextResponse.json({ success: true, schools: unique });
    } catch (error) {
      console.error("NEIS API 호출 오류:", error);
      return NextResponse.json({ success: true, schools: [], fallback: true });
    }
  }

  // 전문대학/기타: 정적 JSON에서 필터링 시도
  const list = schoolData[eduLevel] || [];
  if (list.length > 0) {
    const filtered = list.filter((s) =>
      s.toLowerCase().includes(query.toLowerCase())
    );
    return NextResponse.json({ success: true, schools: filtered });
  }

  return NextResponse.json({ success: true, schools: [] });
}

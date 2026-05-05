import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CrewListViewRow {
  id: string;
  name?: string | null;
  display_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  profile_img?: string | null;
  profile_photo_url?: string | null;
  university?: string | null;
  school_name?: string | null;
  major?: string | null;
  major_name_1?: string | null;
  team?: string | null;
  team_name?: string | null;
  part?: string | null;
  part_name?: string | null;
  nickname?: string | null;
  vision?: string | null;
  club?: string | null;
  status?: string | null;
  growth_status?: string | null;
  total_stars?: number | null;
  approved_weeks?: number | null;
  cumulative_weeks?: number | null;
}

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

function toAge(birthDate: string | null | undefined) {
  if (!birthDate) return "-";

  const birthYear = new Date(birthDate).getFullYear();
  if (Number.isNaN(birthYear)) return "-";

  return new Date().getFullYear() - birthYear;
}

function toCrewRow(row: CrewListViewRow) {
  const schoolName = row.school_name ?? row.university ?? "-";
  const majorName = row.major_name_1 ?? row.major ?? "-";

  return {
    id: row.id,
    name: row.display_name ?? row.name ?? "-",
    gender: row.gender ?? "-",
    age: toAge(row.birth_date),
    profileImg: row.profile_photo_url ?? row.profile_img ?? "",
    university: schoolName,
    major: majorName,
    team: row.team_name ?? row.team ?? "-",
    part: row.part_name ?? row.part ?? "-",
    nickname: row.vision ?? row.nickname ?? "-",
    club: row.club ?? "-",
    universityMajor: [schoolName, majorName].filter((value) => value && value !== "-").join(" ") || "-",
    status: row.status ?? "-",
    growthStatus: row.growth_status ?? "-",
    totalStars: row.total_stars ?? 0,
    approvedWeeks: row.approved_weeks ?? 0,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeUserId = searchParams.get("excludeUserId");

    const supabase = createAdminClient();

    let query = supabase
      .from("crew_list_view")
      .select("*")
      .order("cumulative_weeks", { ascending: true })
      .order("approved_weeks", { ascending: false })
      .order("display_name", { ascending: true, nullsFirst: false });

    if (excludeUserId && isValidUUID(excludeUserId)) {
      query = query.neq("id", excludeUserId);
    }

    const { data, error } = await query.returns<CrewListViewRow[]>();

    if (error) {
      console.error("Failed to fetch crew list from crew_list_view:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Failed to fetch crews.", detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(toCrewRow),
    });
  } catch (error) {
    console.error("Crew list API error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

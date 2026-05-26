import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import type {
  Cluster4LineDetailDto,
  Cluster4LinePartType,
  Cluster4VisibleLineDto,
  Cluster4LineSubmissionDto,
} from "@/lib/cluster4LinesTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPartType(v: string | null): v is Cluster4LinePartType {
  return v === "info" || v === "experience" || v === "competency" || v === "career";
}

type LineTargetRow = {
  id: string;
  line_id: string;
  week_id: string;
  target_mode: "user" | "rule";
  target_user_id: string | null;
  target_rule: Record<string, unknown> | null;
  cluster4_lines: {
    id: string;
    part_type: Cluster4LinePartType;
    main_title: string;
    output_link_1: string | null;
    submission_opens_at: string;
    submission_closes_at: string;
    is_active: boolean;
  } | null;
};

type SubmissionRow = {
  id: string;
  line_target_id: string;
  subtitle: string | null;
  output_link_2: string | null;
  output_link_3: string | null;
  output_link_4: string | null;
  output_link_5: string | null;
  submitted_at: string;
  updated_at: string;
};

const TARGET_SELECT = `
  id,
  line_id,
  week_id,
  target_mode,
  target_user_id,
  target_rule,
  cluster4_lines!inner(
    id,
    part_type,
    main_title,
    output_link_1,
    submission_opens_at,
    submission_closes_at,
    is_active
  )
`;

function toVisibleLine(row: LineTargetRow): Cluster4VisibleLineDto {
  const l = row.cluster4_lines!;
  return {
    lineId: l.id,
    lineTargetId: row.id,
    partType: l.part_type,
    targetMode: row.target_mode,
    mainTitle: l.main_title,
    outputLink1: l.output_link_1,
    submissionOpensAt: l.submission_opens_at,
    submissionClosesAt: l.submission_closes_at,
  };
}

function toSubmissionDto(row: SubmissionRow): Cluster4LineSubmissionDto {
  return {
    id: row.id,
    lineTargetId: row.line_target_id,
    subtitle: row.subtitle,
    outputLink2: row.output_link_2,
    outputLink3: row.output_link_3,
    outputLink4: row.output_link_4,
    outputLink5: row.output_link_5,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const weekId = request.nextUrl.searchParams.get("weekId")?.trim() || null;
  const partType = request.nextUrl.searchParams.get("partType")?.trim() || null;

  if (!weekId || !UUID_RE.test(weekId)) {
    return NextResponse.json({ success: false, error: "weekId must be a valid UUID." }, { status: 400 });
  }
  if (!isPartType(partType)) {
    return NextResponse.json({ success: false, error: "partType must be one of info|experience|competency|career." }, { status: 400 });
  }

  const { profile, error } = await getUserProfile<{ user_id: string }>("user_id");
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const profileUserId = profile.user_id;

  try {
    const { data, error: dbError } = await supabaseAdmin
      .from("cluster4_line_targets")
      .select(TARGET_SELECT)
      .eq("week_id", weekId)
      .eq("cluster4_lines.part_type", partType)
      .eq("cluster4_lines.is_active", true)
      .order("created_at", { ascending: false });

    if (dbError) {
      return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as LineTargetRow[];
    const supported = rows.filter((r) => r.target_mode === "user");
    const matched = supported.find((r) => r.target_user_id === profileUserId) ?? null;

    if (!matched) {
      const result: Cluster4LineDetailDto = { status: "void", partType, line: null, submission: null };
      return NextResponse.json({ success: true, data: result });
    }

    const line = toVisibleLine(matched);

    const { data: subData, error: subError } = await supabaseAdmin
      .from("cluster4_line_submissions")
      .select("id,line_target_id,subtitle,output_link_2,output_link_3,output_link_4,output_link_5,submitted_at,updated_at")
      .eq("line_target_id", matched.id)
      .eq("user_id", profileUserId)
      .maybeSingle();

    if (subError) {
      return NextResponse.json({ success: false, error: subError.message }, { status: 500 });
    }

    if (subData) {
      const result: Cluster4LineDetailDto = {
        status: "success",
        partType,
        line,
        submission: toSubmissionDto(subData as unknown as SubmissionRow),
      };
      return NextResponse.json({ success: true, data: result });
    }

    const isClosed = new Date().getTime() > new Date(line.submissionClosesAt).getTime();
    const result: Cluster4LineDetailDto = {
      status: isClosed ? "fail" : "pending",
      partType,
      line,
      submission: null,
    };
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[cluster4/lines/detail GET]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load line detail." },
      { status: 500 },
    );
  }
}

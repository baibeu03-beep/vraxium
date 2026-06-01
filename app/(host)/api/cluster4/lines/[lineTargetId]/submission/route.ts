import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserProfile } from "@/lib/get-user-profile";
import { triggerAdminSnapshotRecompute } from "@/lib/triggerAdminSnapshotRecompute";
import type {
  Cluster4LinePartType,
  Cluster4LineSubmissionDto,
} from "@/lib/cluster4LinesTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LineTargetRow = {
  id: string;
  target_mode: "user" | "rule";
  target_user_id: string | null;
  cluster4_lines: {
    id: string;
    part_type: Cluster4LinePartType;
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
  target_mode,
  target_user_id,
  cluster4_lines!inner(
    id,
    part_type,
    submission_opens_at,
    submission_closes_at,
    is_active
  )
`;

function toDto(row: SubmissionRow): Cluster4LineSubmissionDto {
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

function normalizeTextField(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function parseBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const b = body as Record<string, unknown>;
  return {
    subtitle: normalizeTextField(b.subtitle),
    output_link_2: normalizeTextField(b.output_link_2),
    output_link_3: normalizeTextField(b.output_link_3),
    output_link_4: normalizeTextField(b.output_link_4),
    output_link_5: normalizeTextField(b.output_link_5),
  };
}

type Ctx = { params: Promise<{ lineTargetId: string }> };

const SUB_SELECT = "id,line_target_id,subtitle,output_link_2,output_link_3,output_link_4,output_link_5,submitted_at,updated_at";

async function getAuthProfileAndTarget(lineTargetId: string) {
  const { profile, error } = await getUserProfile<{ user_id: string }>("user_id");
  if (error) {
    return { error: NextResponse.json({ success: false, error: error.message }, { status: error.status }) };
  }
  if (!supabaseAdmin) {
    return { error: NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 }) };
  }
  if (!UUID_RE.test(lineTargetId)) {
    return { error: NextResponse.json({ success: false, error: "lineTargetId must be a UUID." }, { status: 400 }) };
  }

  const profileUserId = profile.user_id;

  const { data, error: dbErr } = await supabaseAdmin
    .from("cluster4_line_targets")
    .select(TARGET_SELECT)
    .eq("id", lineTargetId)
    .eq("cluster4_lines.is_active", true)
    .maybeSingle();

  if (dbErr) {
    return { error: NextResponse.json({ success: false, error: dbErr.message }, { status: 500 }) };
  }
  if (!data) {
    return { error: NextResponse.json({ success: false, error: "Line target not found." }, { status: 404 }) };
  }

  const row = data as unknown as LineTargetRow;
  if (row.target_mode === "rule") {
    return { error: NextResponse.json({ success: false, error: "Rule-based targets not supported." }, { status: 501 }) };
  }
  if (row.target_user_id !== profileUserId) {
    return { error: NextResponse.json({ success: false, error: "This line target is not accessible." }, { status: 403 }) };
  }

  const line = row.cluster4_lines!;
  const now = Date.now();
  const opens = new Date(line.submission_opens_at).getTime();
  const closes = new Date(line.submission_closes_at).getTime();
  const isOpen = opens <= now && now <= closes;

  return { profileUserId, lineTargetId, isOpen };
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { lineTargetId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ success: false, error: "Request body must be a JSON object." }, { status: 400 });
  }

  const auth = await getAuthProfileAndTarget(lineTargetId);
  if ("error" in auth) return auth.error;

  if (!auth.isOpen) {
    return NextResponse.json({ success: false, error: "Submission window is closed." }, { status: 410 });
  }

  const { data: existing } = await supabaseAdmin!
    .from("cluster4_line_submissions")
    .select("id")
    .eq("line_target_id", auth.lineTargetId)
    .eq("user_id", auth.profileUserId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: false, error: "Submission already exists." }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin!
    .from("cluster4_line_submissions")
    .insert({
      line_target_id: auth.lineTargetId,
      user_id: auth.profileUserId,
      ...parsed,
    })
    .select(SUB_SELECT)
    .single();

  if (error || !data) {
    console.error("[cluster4/lines/:id/submission POST]", error);
    return NextResponse.json({ success: false, error: error?.message ?? "Failed to create submission." }, { status: 500 });
  }

  // 저장 성공 후 제출자 snapshot 재계산 트리거 (best-effort, 실패해도 저장은 성공).
  await triggerAdminSnapshotRecompute([auth.profileUserId]);

  return NextResponse.json({ success: true, data: { submission: toDto(data as unknown as SubmissionRow) } }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { lineTargetId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ success: false, error: "Request body must be a JSON object." }, { status: 400 });
  }

  const auth = await getAuthProfileAndTarget(lineTargetId);
  if ("error" in auth) return auth.error;

  if (!auth.isOpen) {
    return NextResponse.json({ success: false, error: "Submission window is closed." }, { status: 410 });
  }

  const { data: existing, error: findErr } = await supabaseAdmin!
    .from("cluster4_line_submissions")
    .select("id")
    .eq("line_target_id", auth.lineTargetId)
    .eq("user_id", auth.profileUserId)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ success: false, error: findErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin!
    .from("cluster4_line_submissions")
    .update(parsed)
    .eq("id", existing.id)
    .eq("user_id", auth.profileUserId)
    .select(SUB_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[cluster4/lines/:id/submission PATCH]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });
  }

  // 수정 성공 후 제출자 snapshot 재계산 트리거 (best-effort, 실패해도 수정은 성공).
  await triggerAdminSnapshotRecompute([auth.profileUserId]);

  return NextResponse.json({ success: true, data: { submission: toDto(data as unknown as SubmissionRow) } });
}

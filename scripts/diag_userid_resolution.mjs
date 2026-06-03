// Readonly diagnostic: userId resolution audit for Kakao login vs demoUserId.
// Usage: node --env-file=.env.local scripts/diag_userid_resolution.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const line = (s = "") => console.log(s);

// 1) user_profiles schema
{
  const { data } = await sb.from("user_profiles").select("*").limit(1);
  line("=== user_profiles columns ===");
  line((data?.[0] ? Object.keys(data[0]).sort() : []).join(", "));
  line("");
}

// 2) snapshot table schema + sample header fields
let snapTable = "cluster4_weekly_card_snapshots";
{
  const { data, error } = await sb.from(snapTable).select("*").limit(1);
  line(`=== ${snapTable} columns ===`);
  if (error) { line("ERROR: " + error.message); }
  else line((data?.[0] ? Object.keys(data[0]).sort() : []).join(", "));
  line("");
}

// 3) Kakao-logged-in users: auth_email set. Check user_id format + snapshot existence.
{
  const { data: profs } = await sb
    .from("user_profiles")
    .select("user_id, display_name, auth_email, contact_email")
    .not("auth_email", "is", null)
    .limit(2000);
  const total = profs?.length ?? 0;
  let nonUuid = 0;
  const sample = [];
  for (const p of profs ?? []) {
    if (!UUID.test(String(p.user_id))) nonUuid++;
  }
  line("=== Kakao-logged-in profiles (auth_email NOT NULL) ===");
  line(`count=${total}  user_id non-UUID=${nonUuid}`);

  // snapshot coverage for these users
  const ids = (profs ?? []).map(p => p.user_id);
  let withSnap = 0, staleSnap = 0;
  const snapCols = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: snaps, error } = await sb.from(snapTable).select("*").in("user_id", chunk);
    if (error) { line("snap query err: " + error.message); break; }
    for (const s of snaps ?? []) {
      withSnap++;
      Object.keys(s).forEach(k => snapCols.add(k));
      if (s.is_stale === true) staleSnap++;
    }
  }
  line(`snapshot rows for these users: ${withSnap} / ${total}  (stale=${staleSnap})`);
  line("");

  // 4) Show a few concrete kakao users w/ snapshot header values
  line("=== sample Kakao users: profile vs snapshot header ===");
  for (const p of (profs ?? []).slice(0, 8)) {
    const { data: snap } = await sb.from(snapTable).select("*").eq("user_id", p.user_id).maybeSingle();
    let team = null, part = null, ml = null, tagline = null, dto = null, stale = null, cardCount = null;
    if (snap) {
      dto = snap.dto_version ?? snap.dtoVersion ?? null;
      stale = snap.is_stale ?? null;
      const cards = Array.isArray(snap.cards) ? snap.cards : (Array.isArray(snap.data?.cards) ? snap.data.cards : []);
      cardCount = cards.length;
      const h = cards[0] || {};
      team = h.team ?? h.teamName ?? h.header?.team ?? null;
      part = h.part ?? h.partName ?? h.header?.part ?? null;
      ml = h.membershipLevel ?? h.header?.membershipLevel ?? null;
      tagline = h.profileTagline ?? h.header?.profileTagline ?? null;
    }
    line(`  ${String(p.display_name).padEnd(10)} uid=${p.user_id} uuid=${UUID.test(String(p.user_id))} | snap=${!!snap} dto=${dto} stale=${stale} cards=${cardCount} team=${team} part=${part} ml=${ml}`);
  }
  line("");
}

// 5) membership / team-part source check for a kakao user (what /api/profile enriches)
{
  const { data: profs } = await sb
    .from("user_profiles")
    .select("user_id, display_name")
    .not("auth_email", "is", null)
    .limit(5);
  line("=== user_memberships presence (team/part SoT for /api/profile) ===");
  for (const p of profs ?? []) {
    const { data: m } = await sb
      .from("user_memberships")
      .select("team_name, part_name, membership_level, is_current")
      .eq("user_id", p.user_id);
    const cur = (m ?? []).find(x => x.is_current) ?? (m ?? [])[0] ?? null;
    line(`  ${String(p.display_name).padEnd(10)} memberships=${(m ?? []).length} team=${cur?.team_name ?? "-"} part=${cur?.part_name ?? "-"} ml=${cur?.membership_level ?? "-"}`);
  }
}

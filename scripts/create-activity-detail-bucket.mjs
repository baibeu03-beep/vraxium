// Supabase Storage 버킷 'activity-detail-images' 생성 (1회용 스크립트)
// 실행: node scripts/create-activity-detail-bucket.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env.local");

const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx), l.slice(idx + 1)];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "activity-detail-images";

const { data: list, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("버킷 목록 조회 실패:", listErr.message);
  process.exit(1);
}

const existing = list.find((b) => b.name === BUCKET);
if (existing) {
  console.log(`이미 존재: ${BUCKET} (public=${existing.public})`);
  if (!existing.public) {
    const { error: updErr } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (updErr) {
      console.error("public 전환 실패:", updErr.message);
      process.exit(1);
    }
    console.log("→ public=true 로 업데이트 완료");
  }
  process.exit(0);
}

const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
});

if (createErr) {
  console.error("버킷 생성 실패:", createErr.message);
  process.exit(1);
}

console.log(`✓ 버킷 생성 완료: ${BUCKET} (public, 5MB, jpg/png/webp/gif)`);
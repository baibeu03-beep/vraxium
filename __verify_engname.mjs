// 임시 검증 스크립트 (read-only). 실행 후 삭제.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1) english_name 기준 조회 (정규 컬럼)
const a = await sb
  .from("user_profiles")
  .select("display_name, english_name")
  .ilike("display_name", "%한지민%")
  .limit(10);
console.log("[english_name]", JSON.stringify(a.data ?? a.error, null, 2));

// 2) eng_name 컬럼 존재 여부 확인 (레거시)
const b = await sb
  .from("user_profiles")
  .select("display_name, eng_name")
  .ilike("display_name", "%한지민%")
  .limit(3);
console.log("[eng_name]", JSON.stringify(b.data ?? { error: b.error?.message }, null, 2));

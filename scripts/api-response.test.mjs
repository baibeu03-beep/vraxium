// 공통 API 응답 파서 단위 테스트.
// 실행: node --experimental-strip-types scripts/api-response.test.mjs
import assert from "node:assert/strict";
import { readJsonSafe, ApiRequestError, apiErrorMessage, friendlyStatusMessage, MAX_UPLOAD_IMAGE_BYTES } from "../lib/api-response.ts";

let pass = 0;
async function t(name, fn) {
  await fn();
  pass++;
  console.log("  ✓", name);
}

// 최소 Response 목킹 (Web Response 대신 헤더/텍스트/상태만).
function mockResponse({ status = 200, contentType = "application/json", body = "" }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

console.log("readJsonSafe — 성공");
await t("JSON 200 → 파싱 객체", async () => {
  const r = await readJsonSafe(mockResponse({ status: 200, body: JSON.stringify({ success: true, url: "/x.png" }) }));
  assert.deepEqual(r, { success: true, url: "/x.png" });
});
await t("본문 없는 200 → null", async () => {
  assert.equal(await readJsonSafe(mockResponse({ status: 200, body: "" })), null);
});

console.log("readJsonSafe — 실패(핵심: Unexpected token 미전파)");
await t("413 plain-text 'Request Entity Too Large' → ApiRequestError(413), JSON 파싱오류 없음", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 413, contentType: "text/plain", body: "Request Entity Too Large" })),
    (e) => {
      assert.ok(e instanceof ApiRequestError);
      assert.equal(e.status, 413);
      assert.ok(!/Unexpected token/i.test(e.message)); // 내부 파싱 문구 미노출
      assert.ok(e.message.includes("이미지")); // 친절 문구
      return true;
    },
  );
});
await t("500 HTML 오류페이지 → ApiRequestError(500), 친절 문구", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 500, contentType: "text/html", body: "<html>Internal Server Error</html>" })),
    (e) => e instanceof ApiRequestError && e.status === 500 && !/Unexpected token/i.test(e.message) && !e.message.includes("<html>"),
  );
});
await t("JSON error 메시지 → 그 메시지 사용", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 400, body: JSON.stringify({ error: "잘못된 카드 인덱스입니다." }) })),
    (e) => e instanceof ApiRequestError && e.status === 400 && e.message === "잘못된 카드 인덱스입니다.",
  );
});
await t("JSON error 가 enum(EDIT_WINDOW_CLOSED) → code 로 노출, message 는 친절 문구", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 403, body: JSON.stringify({ error: "EDIT_WINDOW_CLOSED" }) })),
    (e) => {
      assert.equal(e.code, "EDIT_WINDOW_CLOSED");
      assert.equal(e.status, 403);
      assert.ok(!e.message.includes("EDIT_WINDOW_CLOSED")); // enum 을 사용자에게 그대로 노출하지 않음
      return true;
    },
  );
});
await t("message 가 enum error 와 HTTP 403 문구보다 우선", async () => {
  const message = "관리자 허가를 받은 기간에만 작성할 수 있습니다. ";
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 403, body: JSON.stringify({ success: false, error: "EDIT_WINDOW_CLOSED", message }) })),
    (e) => e instanceof ApiRequestError && e.code === "EDIT_WINDOW_CLOSED" && e.message === message && apiErrorMessage(e) === message,
  );
});
await t("message 없는 사용자 문구형 error 가 상태 문구보다 우선", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 400, body: JSON.stringify({ error: "필수값을 입력해주세요." }) })),
    (e) => e instanceof ApiRequestError && e.message === "필수값을 입력해주세요.",
  );
});
await t("알 수 없는 HTTP 오류는 최종 저장 fallback", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 418, body: JSON.stringify({ error: "SOME_CODE" }) })),
    (e) => e instanceof ApiRequestError && e.message === "저장에 실패했습니다. 다시 시도해주세요.",
  );
});
await t("네트워크/내부 예외 메시지는 사용자에게 노출하지 않음", async () => {
  assert.equal(apiErrorMessage(new TypeError("Failed to fetch: secret endpoint")), "저장에 실패했습니다. 다시 시도해주세요.");
});
await t("413 JSON(code PAYLOAD_TOO_LARGE) → code+메시지", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 413, body: JSON.stringify({ ok: false, code: "PAYLOAD_TOO_LARGE", error: "첨부한 이미지의 용량이 너무 큽니다." }) })),
    (e) => e.code === "PAYLOAD_TOO_LARGE" && e.message.includes("용량"),
  );
});
await t("깨진 JSON 본문(선언만 application/json) → SyntaxError 미전파, 친절 문구", async () => {
  await assert.rejects(
    () => readJsonSafe(mockResponse({ status: 502, contentType: "application/json", body: "Bad Gateway <not json>" })),
    (e) => e instanceof ApiRequestError && !/Unexpected token/i.test(e.message),
  );
});

console.log("friendlyStatusMessage");
await t("413 → 이미지 용량 문구", async () => assert.ok(friendlyStatusMessage(413).includes("용량")));
await t("401 → 로그인 문구", async () => assert.ok(friendlyStatusMessage(401).includes("로그인")));
await t("500 → 서버 오류 문구", async () => assert.ok(friendlyStatusMessage(500).includes("서버")));

console.log("MAX_UPLOAD_IMAGE_BYTES");
await t("4MB = 4*1024*1024", async () => assert.equal(MAX_UPLOAD_IMAGE_BYTES, 4 * 1024 * 1024));
await t("Vercel 한도(4.5MB) 미만", async () => assert.ok(MAX_UPLOAD_IMAGE_BYTES < 4.5 * 1024 * 1024));

console.log(`\n${pass} assertions passed ✅`);

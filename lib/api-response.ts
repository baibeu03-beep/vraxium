// =============================================
// 공통 API 응답 파서 (SoT)
//
// 목적: fetch 응답을 곧바로 response.json() 으로 읽다가, 서버/리버스 프록시/
// 배포 플랫폼(Vercel 등)이 반환한 **비-JSON** 응답(예: 413 "Request Entity
// Too Large" 일반 텍스트, HTML 오류 페이지)에서 `Unexpected token 'R' ...`
// 같은 파싱 오류가 사용자에게 노출되는 것을 막는다.
//
// - 성공: Content-Type 이 JSON 이면 파싱 결과, 본문 없으면 null 반환.
// - 실패(!ok): ApiRequestError 로 throw. 서버가 준 사용자 메시지가 있으면 그것을,
//   없으면(413 등 프록시 차단 포함) 상태코드 기반 친절 메시지를 사용.
// - 어떤 경우에도 JSON.parse 예외를 호출부로 전파하지 않는다.
//
// 관련 단위 테스트: scripts/api-response.test.mjs
// =============================================

// 업로드 이미지 1장 최대 크기.
// Vercel serverless 요청 본문 한도(~4.5MB) 아래로 잡아, 플랫폼이 앱 도달 전
// plain-text 413("Request Entity Too Large") 를 반환하는 상황 자체를 예방한다.
// 클라이언트 사전검증 + 서버 라우트 검증이 같은 값을 공유한다.
export const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
export const MAX_UPLOAD_IMAGE_LABEL = "4MB";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload: unknown;

  constructor(message: string, status: number, opts?: { code?: string; payload?: unknown }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = opts?.code;
    this.payload = opts?.payload;
  }
}

// 상태코드 기반 사용자용 기본 문구 (서버가 별도 메시지를 안 준 경우).
export function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return "로그인이 필요합니다.";
    case 403:
      return "수정 권한이 없습니다.";
    case 413:
      return "첨부한 이미지의 전체 용량이 너무 큽니다.\n이미지 수나 파일 크기를 줄인 뒤 다시 시도해주세요.";
    default:
      if (status >= 500) return "서버 오류로 저장하지 못했습니다. 잠시 후 다시 시도해주세요.";
      return "저장에 실패했습니다. 다시 시도해주세요.";
  }
}

// API가 명시적으로 보낸 사용자용 메시지만 화면에 노출한다. 네트워크 예외,
// JSON 파싱 예외, stack trace 등은 호출부의 안전한 fallback으로 숨긴다.
export function apiErrorMessage(
  error: unknown,
  fallback = "저장에 실패했습니다. 다시 시도해주세요.",
): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

// 오류 코드가 될 만한 UPPER_SNAKE_CASE 문자열인지.
function looksLikeCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]+$/.test(value);
}

function extractString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

// fetch 응답을 상태/Content-Type 에 따라 안전 파싱.
//  - !ok → ApiRequestError throw (호출부에서 status/code 로 분기 + message 로 표시)
//  - ok  → JSON 이면 파싱값, 본문 없으면 null
// 절대 response.json() 을 곧바로 호출하지 않음 → "Unexpected token" 유출 방지.
export async function readJsonSafe(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text().catch(() => "");
  const isJson = contentType.includes("application/json");

  let payload: unknown = null;
  if (rawText && isJson) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null; // JSON 선언이지만 깨진 본문 — 파싱 오류를 전파하지 않는다.
    }
  }

  if (!response.ok) {
    let code: string | undefined;
    let serverMessage: string | undefined;

    if (payload && typeof payload === "object") {
      const obj = payload as Record<string, unknown>;
      // code 우선순위: 명시적 code → error 가 enum 형태면 그것.
      code = extractString(obj, "code") ?? (looksLikeCode(obj.error) ? (obj.error as string) : undefined);
      // 사용자 메시지: message → (enum 이 아닌) error.
      serverMessage = extractString(obj, "message") ?? (looksLikeCode(obj.error) ? undefined : extractString(obj, "error"));
    }

    throw new ApiRequestError(serverMessage ?? friendlyStatusMessage(response.status), response.status, { code, payload });
  }

  if (!rawText) return null;
  return payload;
}

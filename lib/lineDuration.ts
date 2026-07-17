import type { LineDurationMinutes } from "@/shared/cluster4.contracts";

// ─────────────────────────────────────────────────────────────────────
// 라인 예상 소요 시간 표시 formatter — 고객앱 단일 출처.
//
//   ⚠ vraxium-admin `lib/adminLineRegistrationsTypes.ts`.formatLineDuration 의 **미러**다.
//     라인 등록 폼·라인 정보 목록·수정 팝업(어드민)과 Detail Log 라인 탭(고객앱)이 같은 표기를
//     쓰도록 하기 위한 것 — 두 레포는 별도 배포라 함수를 공유할 수 없다. 표기를 바꾸면 양쪽을 함께 고칠 것.
//
//   DB/DTO 는 분(minutes) 정수만 다룬다(30|60|90|120). 부동소수점 시간(0.5/1.5)은 표시 전용이라
//   여기서만 만든다 — 화면 컴포넌트가 자체 포맷을 만들지 말 것.
//
//   NULL(미설정·원장 브리지 없음) = "-". 0 처럼 보이는 값을 만들지 않는다.
// ─────────────────────────────────────────────────────────────────────

export const EMPTY_LINE_DURATION_LABEL = "-";

export function formatLineDuration(
  value: LineDurationMinutes | number | null | undefined,
): string {
  switch (value) {
    case 30:
      return "0.5 h";
    case 60:
      return "1 h";
    case 90:
      return "1.5 h";
    case 120:
      return "2 h";
    default:
      return EMPTY_LINE_DURATION_LABEL;
  }
}

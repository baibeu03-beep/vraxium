// user_edit_windows 기반 작성 기간이 닫혀 있을 때 사용자에게 노출하는 단일 안내 문구.
//   - 사유(not_started / expired / not_granted / closed)와 무관하게 동일 문구로 표시한다.
//   - expiresAt 도 잠금 상태에서는 노출하지 않는다 (열린 상태일 때만 별도 안내).
//   - 사용처: cluster2 Club Review Link, cluster3 Output Cards, cluster3 Detail Cards.
//   - 서버가 EDIT_WINDOW_CLOSED 를 반환했을 때의 사용자 alert 도 이 문구로 통일한다.
export const EDIT_WINDOW_LOCKED_MESSAGE =
  "관리자 허가를 받은 기간에만 작성할 수 있습니다. 😊";

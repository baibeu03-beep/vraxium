// 스크립트 실행 전용 no-op 스텁 — Next 런타임 밖에서 `import "server-only"` 를 해석시키기 위함.
// 프로덕션 번들에는 포함되지 않는다(scripts/ 는 앱 그래프 밖).
module.exports = {};

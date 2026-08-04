# 서버 렌더용 한글 폰트

증명서 PNG/PDF 는 서버에서 생성되며, 한글 글리프를 벡터 path 로 굽기 위해
**실제 폰트 바이너리**가 필요하다.

## 현재 등록된 폰트

```
Pretendard-Regular.otf   (SIL Open Font License 1.1 — OFL.txt 참조)
```

- 출처: https://github.com/orioncactus/pretendard
- 라이선스 전문: 같은 디렉터리의 `OFL.txt`
- 앱 CSS 가 곳곳에서 `font-family: 'Pretendard'` 를 참조하므로 화면 서체와 증명서
  서체가 같은 계열로 맞춰진다.

## 탐색 순서

1. `CERTIFICATE_FONT_PATH` 환경변수 — 설정되면 **그 경로만** 사용한다.
   (오타/오설정 시 번들 기본값으로 조용히 폴백하지 않고 503 으로 실패시켜
    설정 오류를 즉시 드러내기 위함.)
2. `public/fonts/NotoSansKR-Regular.ttf`
3. `public/fonts/Pretendard-Regular.otf`  ← 현재 이 파일이 사용된다

하나도 없으면 증명 발급 API 가 **503** 과
`{ code: "FONT_MISSING", error: "증명서 한글 폰트가 등록되지 않았습니다." }` 를 반환하고,
`/certificate` 페이지는 안내 문구를 띄우며 미리보기/발급 버튼을 막는다(500·두부 렌더 없음).

## 주의

- 폰트를 교체하면 글자 폭(advance width)이 달라져 좁은 칸에서 축소·초과가 발생할 수 있다.
  `lib/certificates/activityCertificateTemplate.ts` 의 `fontSize`/`maxWidth` 를 다시 확인할 것.
  특히 `activityWeeks`(maxWidth 32) 와 `activityPeriod`(maxWidth 275) 가 가장 빡빡하다.
- 가변 폰트(VF)도 파싱은 되지만 opentype.js 는 **기본 인스턴스만** 렌더한다.
  굵기를 지정하려면 정적(static) 인스턴스 파일을 쓸 것.
- Vercel 배포 시 이 디렉터리는 `next.config.mjs` 의
  `experimental.outputFileTracingIncludes` 로 서버리스 함수 번들에 포함된다.
  경로를 바꾸면 그쪽 설정도 같이 고쳐야 한다.

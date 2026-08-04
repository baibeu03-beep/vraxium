"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { usePopup } from "@/components/ui/popup";
import { useDemoUserMode } from "@/hooks/useDemoUserMode";
import {
  CERTIFICATE_DATE_FIELDS,
  CERTIFICATE_FIELD_LABELS,
  CERTIFICATE_INPUT_FIELDS,
  CERTIFICATE_INPUT_MAX_LENGTH,
  CERTIFICATE_NUMERIC_FIELDS,
  type CertificateInputField,
} from "@/lib/certificates/activityCertificateTemplate";
import {
  emptyCertificateInput,
  todayIsoKst,
  validateActivityCertificateInput,
  type ActivityCertificateInput,
  type CertificateFieldError,
} from "@/lib/certificates/activityCertificateValidation";

// /certificate — 활동 증명서 발급(엥크레).
// ─────────────────────────────────────────────────────────────────────────────
// · 레이아웃/헤더/사이드바/푸터/테마는 (main-layout)/layout.tsx 에서 상속받는다.
// · 미리보기는 **서버가 만든 PNG 를 그대로 <img> 로** 띄운다. 브라우저 canvas 합성이
//   없으므로 미리보기와 다운로드본이 어긋날 수 없다.
// · 검증은 서버와 동일한 validateActivityCertificateInput 를 그대로 import 해 쓴다.
// · 발급 대상·QR 목적지·발급 자격은 전부 서버가 결정한다 — 요청 body 에 userId/resumeUrl/
//   organizationSlug 계열 키를 절대 넣지 않는다(서버가 존재만으로 400).
// ─────────────────────────────────────────────────────────────────────────────

interface CertificateContextDto {
  success: true;
  user: {
    userId: string;
    name: string | null;
    birthDate: string | null;
    organizationName: string | null;
    organizationSlug: string | null;
  };
  defaults: Record<CertificateInputField, string | null>;
  sources: Record<string, "db" | "preset" | "manual">;
  eligibility: {
    allowed: boolean;
    requiredOrganizationName: string;
    reason: string;
    message: string | null;
  };
  template: {
    templateId: string;
    previewUrl: string;
    width: number;
    height: number;
    available: boolean;
    reason: string;
    message: string | null;
    templateAvailable: boolean;
    fontAvailable: boolean;
  };
  limits: {
    maxLength: Record<CertificateInputField, number>;
    maxWeeks: number;
    presets: { clubName: string; industryField: string };
  };
}

const FIELD_PLACEHOLDER: Record<CertificateInputField, string> = {
  clubName: "엥크레",
  industryField: "엔터테인먼트/미디어",
  name: "이름",
  birthDate: "",
  clubEliteCode: "예) 036003-1254053",
  graduationGrade: "예) 정규 / 심화(에이전트)",
  activityStartDate: "",
  activityEndDate: "",
  activityWeeks: "예) 30",
  activityForm: "예) 온라인 / 오프라인",
  issueDate: "",
};

const SOURCE_BADGE: Record<string, { text: string; className: string }> = {
  db: { text: "자동 조회", className: "certificate-badge--auto" },
  preset: { text: "서식 기본값", className: "certificate-badge--preset" },
  manual: { text: "직접 입력", className: "certificate-badge--manual" },
};

function CertificateContent() {
  const searchParams = useSearchParams();
  const demo = useDemoUserMode();
  const popup = usePopup();

  const [dto, setDto] = useState<CertificateContextDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityCertificateInput>(() => emptyCertificateInput());
  const [errors, setErrors] = useState<CertificateFieldError[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "png" | "pdf">(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const previewUrlRef = useRef<string | null>(null);
  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const orgQuery = searchParams?.get("org") ?? null;
  const themeClass = useMemo(() => {
    const slug = orgQuery ?? dto?.user.organizationSlug ?? null;
    return slug === "encre" ? "certificate-encre" : "";
  }, [orgQuery, dto]);

  /** 서버 defaults 로 폼을 채운다. 자동값이 없는 필드는 빈 칸으로 두어 사용자가 입력한다. */
  const applyDefaults = useCallback((json: CertificateContextDto) => {
    const next = emptyCertificateInput();
    for (const key of CERTIFICATE_INPUT_FIELDS) next[key] = json.defaults[key] ?? "";
    if (!next.issueDate) next.issueDate = todayIsoKst();
    setForm(next);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(demo.appendDemoUserParams("/api/certificates/activity/context/"), {
          cache: "no-store",
        });
        const json = (await res.json()) as CertificateContextDto | { error?: string };
        if (!alive) return;
        if (!res.ok || !("success" in json)) {
          setLoadError(("error" in json && json.error) || "증명 발급 정보를 불러오지 못했습니다.");
          setDto(null);
          return;
        }
        setLoadError(null);
        setDto(json);
        applyDefaults(json);
      } catch {
        if (alive) setLoadError("증명 발급 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyDefaults, demo]);

  const errorFor = useCallback(
    (key: CertificateInputField) => errors.find((e) => e.field === key)?.message ?? null,
    [errors],
  );

  const handleChange = useCallback((key: CertificateInputField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== key));
  }, []);

  const applyServerError = useCallback(async (res: Response): Promise<string> => {
    let message = "요청을 처리하지 못했습니다.";
    try {
      const json = (await res.json()) as {
        error?: string;
        fieldErrors?: CertificateFieldError[];
      };
      if (Array.isArray(json.fieldErrors) && json.fieldErrors.length > 0) {
        setErrors(json.fieldErrors);
        message = json.fieldErrors[0].message;
      } else if (json.error) {
        message = json.error;
      }
    } catch {
      /* 비-JSON 응답 — 기본 메시지 유지 */
    }
    return message;
  }, []);

  const eligible = dto?.eligibility.allowed ?? false;
  const templateReady = dto?.template.available ?? false;
  const canIssue = eligible && templateReady && !loading;

  const submit = useCallback(
    async (kind: "preview" | "png" | "pdf") => {
      if (busy) return;
      const local = validateActivityCertificateInput(form);
      if (!local.ok) {
        setErrors(local.errors);
        await popup.alert(local.errors[0].message);
        return;
      }
      setErrors([]);
      setBusy(kind);
      try {
        const path =
          kind === "preview"
            ? "/api/certificates/activity/preview/"
            : `/api/certificates/activity/issue/?format=${kind}`;
        const res = await fetch(demo.appendDemoUserParams(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ⚠️ userId / resumeUrl / organizationSlug 계열 키를 절대 싣지 않는다.
          body: JSON.stringify(local.value),
          cache: "no-store",
        });

        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !/^(image|application\/pdf)/.test(contentType)) {
          const message = await applyServerError(res);
          await popup.alert(message);
          return;
        }

        const blob = await res.blob();
        if (kind === "preview") {
          setPreview(URL.createObjectURL(blob));
          return;
        }
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `활동증명서_${local.value.name || "크루"}_${local.value.issueDate}.${kind}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } catch {
        await popup.alert("요청 중 오류가 발생했습니다.");
      } finally {
        setBusy(null);
      }
    },
    [applyServerError, busy, demo, form, popup, setPreview],
  );

  const handleReset = useCallback(async () => {
    const ok = await popup.confirm("입력한 내용을 자동 조회값으로 되돌릴까요?");
    if (!ok) return;
    setErrors([]);
    setPreview(null);
    if (dto) applyDefaults(dto);
    else setForm(emptyCertificateInput());
  }, [applyDefaults, dto, popup, setPreview]);

  const renderField = (key: CertificateInputField) => {
    const label = CERTIFICATE_FIELD_LABELS[key];
    const isDate = (CERTIFICATE_DATE_FIELDS as readonly string[]).includes(key);
    const isNumeric = (CERTIFICATE_NUMERIC_FIELDS as readonly string[]).includes(key);
    const message = errorFor(key);
    const badge = SOURCE_BADGE[dto?.sources[key] ?? "manual"];
    const maxLength = dto?.limits.maxLength[key] ?? CERTIFICATE_INPUT_MAX_LENGTH[key];

    return (
      <div className="certificate-field" key={key}>
        <label className="certificate-field__label" htmlFor={`cert-${key}`}>
          <span>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
            {label}
          </span>
          <span className={`certificate-badge ${badge.className}`}>{badge.text}</span>
        </label>
        <input
          id={`cert-${key}`}
          type={isDate ? "date" : "text"}
          inputMode={isNumeric ? "numeric" : undefined}
          className={`certificate-input${message ? " is-invalid" : ""}`}
          value={form[key]}
          placeholder={FIELD_PLACEHOLDER[key]}
          maxLength={isDate ? undefined : maxLength}
          disabled={!eligible}
          onChange={(e) => handleChange(key, e.target.value)}
        />
        <div className="certificate-field__foot">
          {message ? (
            <span className="certificate-field__error">{message}</span>
          ) : (
            <span className="certificate-field__hint">&nbsp;</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className={`nftg-content nftg-content-home certificate-page ${themeClass}`}>
      <Animations />
      <Breadcrumb title="활동 증명 발급" />
      <section className="pb-120" style={{ paddingTop: 24 }}>
        <div className="container">
          {/* 제목 배너 → Hero 순서(/vacation 과 동일하게 배너가 먼저 온다). */}
          <header className="certificate-banner">
            <span className="certificate-banner__badge">
              <i className="ti ti-certificate" aria-hidden="true"></i>CLUB CERTIFICATE
            </span>
            <h1 className="certificate-banner__title">활동 증명서 발급</h1>
            <span className="certificate-banner__bar" aria-hidden="true"></span>
            <p className="certificate-banner__subtitle">
              현재 활동 정보를 확인하고 나만의 증명서를 발급하세요
            </p>
          </header>

          {/* Hero — 순수 장식(텍스트 미겹침). 로드 실패 시 is-fallback 으로 그라데이션만 남아
              높이가 유지되므로 아래 폼 레이아웃이 밀리지 않는다. */}
          <section
            className={`certificate-hero${heroFailed ? " is-fallback" : ""}`}
            aria-hidden="true"
          >
            {!heroFailed ? (
              <Image
                src="/images/0/certificate.png"
                alt=""
                fill
                priority
                sizes="(max-width: 860px) 100vw, 1200px"
                className="certificate-hero__image"
                onError={() => setHeroFailed(true)}
              />
            ) : null}
          </section>

          {loadError ? (
            <div className="certificate-notice certificate-notice--error">
              <i className="ti ti-alert-triangle" aria-hidden="true"></i>
              <span>{loadError}</span>
            </div>
          ) : null}

          {!loading && dto && !eligible ? (
            <div className="certificate-notice certificate-notice--warn">
              <i className="ti ti-lock" aria-hidden="true"></i>
              <span>{dto.eligibility.message}</span>
            </div>
          ) : null}

          {!loading && dto && eligible && !templateReady ? (
            <div className="certificate-notice certificate-notice--warn">
              <i className="ti ti-photo-off" aria-hidden="true"></i>
              <span>{dto.template.message ?? "증명서 템플릿 이미지가 등록되지 않았습니다."}</span>
            </div>
          ) : null}

          <div className="certificate-layout">
            <div className="certificate-form">
              <p className="certificate-form__hint">
                <span className="certificate-badge certificate-badge--auto">자동 조회</span>
                는 현재 로그인 정보에서 가져온 값이고,
                <span className="certificate-badge certificate-badge--manual">직접 입력</span>
                은 확정된 데이터 원천이 없어 직접 채워야 하는 항목입니다. 모두 수정할 수 있습니다.
              </p>
              <div className="certificate-form__grid">
                {CERTIFICATE_INPUT_FIELDS.map(renderField)}
              </div>
              <div className="certificate-actions">
                <button
                  type="button"
                  className="certificate-btn certificate-btn--primary"
                  disabled={!canIssue || busy !== null}
                  onClick={() => submit("preview")}
                >
                  {busy === "preview" ? "생성 중…" : "미리보기"}
                </button>
                <button
                  type="button"
                  className="certificate-btn"
                  disabled={busy !== null || !eligible}
                  onClick={handleReset}
                >
                  입력 초기화
                </button>
              </div>
            </div>

            <div className="certificate-preview">
              {previewUrl ? (
                <>
                  <figure className="certificate-preview__figure">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="활동 증명서 미리보기" />
                  </figure>
                  <div className="certificate-actions certificate-actions--preview">
                    <button
                      type="button"
                      className="certificate-btn"
                      disabled={busy !== null}
                      onClick={() => setPreview(null)}
                    >
                      수정하기
                    </button>
                    <button
                      type="button"
                      className="certificate-btn certificate-btn--primary"
                      disabled={busy !== null}
                      onClick={() => submit("png")}
                    >
                      {busy === "png" ? "생성 중…" : "PNG 다운로드"}
                    </button>
                    <button
                      type="button"
                      className="certificate-btn certificate-btn--primary"
                      disabled={busy !== null}
                      onClick={() => submit("pdf")}
                    >
                      {busy === "pdf" ? "생성 중…" : "PDF 다운로드"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="certificate-preview__empty">
                  <i className="ti ti-file-certificate" aria-hidden="true"></i>
                  <p>
                    내용을 확인한 뒤 <strong>미리보기</strong>를 누르면
                    <br />
                    증명서 이미지가 여기에 표시됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const CertificatePage = () => (
  <Suspense fallback={null}>
    <CertificateContent />
  </Suspense>
);

export default CertificatePage;

"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { usePopup } from "@/components/ui/popup";
import { useDemoUserMode } from "@/hooks/useDemoUserMode";
import { resolveCurrentOrgSlug, type OrgSlug } from "@/lib/orgNav";
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
import {
  CAREER_CERTIFICATE_DATE_FIELDS,
  CAREER_CERTIFICATE_FIELD_LABELS,
  CAREER_CERTIFICATE_INPUT_FIELDS,
  CAREER_CERTIFICATE_INPUT_MAX_LENGTH,
  CAREER_CERTIFICATE_MULTILINE_FIELDS,
  type CareerCertificateInputField,
} from "@/lib/certificates/careerCertificateTemplate";
import {
  emptyCareerCertificateInput,
  validateCareerCertificateInput,
  type CareerCertificateInput,
} from "@/lib/certificates/careerCertificateValidation";

// /certificate — 증명서 발급(활동 증명서 · 경력 증명서 탭).
// ─────────────────────────────────────────────────────────────────────────────
// · 레이아웃/헤더/사이드바/푸터/테마는 (main-layout)/layout.tsx 에서 상속받는다.
// · 두 탭은 완전히 독립된 폼 상태·오류·미리보기를 갖는다(공유 X). 탭을 감추는 방식은
//   unmount 가 아니라 CSS 로만 숨긴다 — 그래야 탭을 오갈 때 입력값이 초기화되지 않는다.
// · 미리보기는 **서버가 만든 PNG 를 그대로 <img> 로** 띄운다. 브라우저 canvas 합성이
//   없으므로 미리보기와 다운로드본이 어긋날 수 없다.
// · 검증은 서버와 동일한 validate*Input 을 그대로 import 해 쓴다.
// · 발급 대상·조직 자격은 전부 서버가 결정한다 — 요청 body 에 userId/organizationSlug/org
//   계열 키를 절대 넣지 않는다(서버가 존재만으로 400).
// · 조직(org) 판정은 이 페이지가 독자적으로 만들지 않는다 — 사이드바가 /certificate
//   링크를 생성할 때 쓰는 것과 동일한 lib/orgNav.ts 의 resolveCurrentOrgSlug 를 그대로
//   써서 ?org= 쿼리(> cluster path suffix)를 해석한다(/crews·/weekly-ranking·/vacation
//   과 동일 규약). 별도 encre/oranke/phalanx 파서를 이 페이지에서 새로 만들지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

type CertTab = "activity" | "career";

/** 현재 URL 의 데모/테스트 모드 파라미터(mode·actAsTestUserId)를 보존해 쿼리에 합친다. */
function useModeQuery() {
  const searchParams = useSearchParams();
  return useMemo(() => {
    const mode = searchParams?.get("mode") ?? null;
    const actAs = mode === "test" ? searchParams?.get("actAsTestUserId") ?? null : null;
    const parts: string[] = [];
    if (mode) parts.push(`mode=${encodeURIComponent(mode)}`);
    if (actAs) parts.push(`actAsTestUserId=${encodeURIComponent(actAs)}`);
    return parts.length > 0 ? `&${parts.join("&")}` : "";
  }, [searchParams]);
}

// ── 활동 증명서 탭 ────────────────────────────────────────────────────────────

interface ActivityCertificateContextDto {
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

const ACTIVITY_FIELD_PLACEHOLDER: Record<CertificateInputField, string> = {
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

function ActivityCertificatePanel({ visible }: { visible: boolean }) {
  const demo = useDemoUserMode();
  const modeQuery = useModeQuery();
  const popup = usePopup();

  const [dto, setDto] = useState<ActivityCertificateContextDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityCertificateInput>(() => emptyCertificateInput());
  const [errors, setErrors] = useState<CertificateFieldError[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "png" | "pdf">(null);

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

  const applyDefaults = useCallback((json: ActivityCertificateContextDto) => {
    const next = emptyCertificateInput();
    for (const key of CERTIFICATE_INPUT_FIELDS) next[key] = json.defaults[key] ?? "";
    if (!next.issueDate) next.issueDate = todayIsoKst();
    setForm(next);
  }, []);

  // ⚠️ demo(useDemoUserMode()의 반환 객체)를 그대로 의존성에 넣지 않는다 — useSearchParams()
  //    기반이라 tab= 같은 무관한 쿼리 변경에도 새 객체가 나와, 그걸 의존성으로 쓰는 effect가
  //    탭 전환마다 재실행되어 폼을 defaults 로 덮어써 버린다(실측: Playwright 라운드트립
  //    테스트에서 재현). demoUserId 원시값만 의존성으로 써서 값이 실제로 바뀔 때만 갱신한다.
  const demoUserId = demo.demoUserId;
  const withMode = useCallback(
    (path: string) => {
      let q = path;
      if (demoUserId) q += `${q.includes("?") ? "&" : "?"}demoUserId=${encodeURIComponent(demoUserId)}`;
      return q + modeQuery;
    },
    [demoUserId, modeQuery],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(withMode("/api/certificates/activity/context/"), { cache: "no-store" });
        const json = (await res.json()) as ActivityCertificateContextDto | { error?: string };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDefaults, withMode]);

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
      const json = (await res.json()) as { error?: string; fieldErrors?: CertificateFieldError[] };
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
        const res = await fetch(withMode(path), {
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
    [applyServerError, busy, form, popup, setPreview, withMode],
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
        <label className="certificate-field__label" htmlFor={`cert-activity-${key}`}>
          <span>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
            {label}
          </span>
          <span className={`certificate-badge ${badge.className}`}>{badge.text}</span>
        </label>
        <input
          id={`cert-activity-${key}`}
          type={isDate ? "date" : "text"}
          inputMode={isNumeric ? "numeric" : undefined}
          className={`certificate-input${message ? " is-invalid" : ""}`}
          value={form[key]}
          placeholder={ACTIVITY_FIELD_PLACEHOLDER[key]}
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
    <div className="certificate-tabpanel" hidden={!visible}>
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
          <div className="certificate-form__grid">{CERTIFICATE_INPUT_FIELDS.map(renderField)}</div>
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
              <p className="certificate-preview__pdf-note">
                <i className="ti ti-info-circle" aria-hidden="true"></i>
                PDF는 A4 인쇄용으로 생성되며 사방에 약 12.7mm의 안전 여백이 포함됩니다.
              </p>
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
  );
}

// ── 경력 증명서 탭 ────────────────────────────────────────────────────────────

interface CareerCertificateContextDto {
  success: true;
  user: { userId: string; name: string | null; birthDate: string | null };
  /** 서버(resolveOrgFromLocation)가 확정한 조직 — canonical + 표시용 slug/한글명. */
  org: { organization: string; orgSlug: OrgSlug; displayNameKo: string } | null;
  defaults: Record<CareerCertificateInputField, string | null>;
  sources: Record<string, "db" | "manual">;
  eligibility: { allowed: boolean; reason: string; message: string | null };
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
  limits: { maxLength: Record<CareerCertificateInputField, number> };
}

const CAREER_FIELD_PLACEHOLDER: Record<CareerCertificateInputField, string> = {
  name: "이름",
  birthDate: "",
  affiliation: "예) 주식회사 아우름",
  education: "예) 경영학과",
  taskName: "예) SNS 콘텐츠 기획 및 운영",
  careerStartDate: "",
  careerEndDate: "",
  careerDescription: "담당했던 업무 내용을 입력해주세요.",
  issueDate: "",
};

const CAREER_DATE_SET = new Set<string>(CAREER_CERTIFICATE_DATE_FIELDS);
const CAREER_MULTILINE_SET = new Set<string>(CAREER_CERTIFICATE_MULTILINE_FIELDS);

function CareerCertificatePanel({ visible, org }: { visible: boolean; org: OrgSlug | null }) {
  const demo = useDemoUserMode();
  const modeQuery = useModeQuery();
  const popup = usePopup();

  const [dto, setDto] = useState<CareerCertificateContextDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<CareerCertificateInput>(() => emptyCareerCertificateInput());
  const [errors, setErrors] = useState<CertificateFieldError[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "png" | "pdf">(null);

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

  const applyDefaults = useCallback((json: CareerCertificateContextDto) => {
    const next = emptyCareerCertificateInput();
    for (const key of CAREER_CERTIFICATE_INPUT_FIELDS) next[key] = json.defaults[key] ?? "";
    if (!next.issueDate) next.issueDate = todayIsoKst();
    setForm(next);
  }, []);

  // org 는 요청 body 가 아니라 쿼리로만 서버에 전달한다(careerCertificateApi.ts 가
  // body.org 계열 키 존재 자체를 400 으로 거부하므로 body 로 보내면 안 된다).
  //
  // ⚠️ demo(useDemoUserMode()의 반환 객체)를 그대로 의존성에 넣지 않는다 — activity 탭과
  //    동일 이유(위 withMode 주석 참고): tab= 쿼리 변경만으로도 재계산되는 effect 가 폼을
  //    defaults 로 덮어써 탭 전환 시 입력값이 사라지는 회귀가 생긴다.
  const demoUserId = demo.demoUserId;
  const withOrgAndMode = useCallback(
    (path: string) => {
      const orgParam = org ? `org=${encodeURIComponent(org)}` : "";
      const sep = path.includes("?") ? "&" : "?";
      let q = orgParam ? `${path}${sep}${orgParam}` : path;
      if (demoUserId) q += `${q.includes("?") ? "&" : "?"}demoUserId=${encodeURIComponent(demoUserId)}`;
      return q + modeQuery;
    },
    [demoUserId, modeQuery, org],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(withOrgAndMode("/api/certificates/career/context/"), { cache: "no-store" });
        const json = (await res.json()) as CareerCertificateContextDto | { error?: string };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDefaults, withOrgAndMode]);

  const errorFor = useCallback(
    (key: CareerCertificateInputField) => errors.find((e) => e.field === key)?.message ?? null,
    [errors],
  );

  const handleChange = useCallback((key: CareerCertificateInputField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== key));
  }, []);

  const applyServerError = useCallback(async (res: Response): Promise<string> => {
    let message = "요청을 처리하지 못했습니다.";
    try {
      const json = (await res.json()) as { error?: string; fieldErrors?: CertificateFieldError[] };
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
      const local = validateCareerCertificateInput(form);
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
            ? "/api/certificates/career/preview/"
            : `/api/certificates/career/issue/?format=${kind}`;
        const res = await fetch(withOrgAndMode(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ⚠️ userId / organizationSlug / org 계열 키를 절대 싣지 않는다(조직은 쿼리로만).
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
        a.download = `경력증명서_${local.value.name || "크루"}_${local.value.issueDate}.${kind}`;
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
    [applyServerError, busy, form, popup, setPreview, withOrgAndMode],
  );

  const handleReset = useCallback(async () => {
    const ok = await popup.confirm("입력한 내용을 자동 조회값으로 되돌릴까요?");
    if (!ok) return;
    setErrors([]);
    setPreview(null);
    if (dto) applyDefaults(dto);
    else setForm(emptyCareerCertificateInput());
  }, [applyDefaults, dto, popup, setPreview]);

  const renderField = (key: CareerCertificateInputField) => {
    const label = CAREER_CERTIFICATE_FIELD_LABELS[key];
    const isDate = CAREER_DATE_SET.has(key);
    const isMultiline = CAREER_MULTILINE_SET.has(key);
    const message = errorFor(key);
    const badge = SOURCE_BADGE[dto?.sources[key] ?? "manual"];
    const maxLength = dto?.limits.maxLength[key] ?? CAREER_CERTIFICATE_INPUT_MAX_LENGTH[key];

    return (
      <div className={`certificate-field${isMultiline ? " certificate-field--wide" : ""}`} key={key}>
        <label className="certificate-field__label" htmlFor={`cert-career-${key}`}>
          <span>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
            {label}
          </span>
          <span className={`certificate-badge ${badge.className}`}>{badge.text}</span>
        </label>
        {isMultiline ? (
          <textarea
            id={`cert-career-${key}`}
            className={`certificate-input certificate-textarea${message ? " is-invalid" : ""}`}
            value={form[key]}
            placeholder={CAREER_FIELD_PLACEHOLDER[key]}
            maxLength={maxLength}
            disabled={!eligible}
            onChange={(e) => handleChange(key, e.target.value)}
          />
        ) : (
          <input
            id={`cert-career-${key}`}
            type={isDate ? "date" : "text"}
            className={`certificate-input${message ? " is-invalid" : ""}`}
            value={form[key]}
            placeholder={CAREER_FIELD_PLACEHOLDER[key]}
            maxLength={isDate ? undefined : maxLength}
            disabled={!eligible}
            onChange={(e) => handleChange(key, e.target.value)}
          />
        )}
        <div className="certificate-field__foot">
          {message ? (
            <span className="certificate-field__error">{message}</span>
          ) : (
            <span className="certificate-field__hint">&nbsp;</span>
          )}
          {isMultiline ? (
            <span className="certificate-field__count">
              {form[key].length}/{maxLength}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="certificate-tabpanel" hidden={!visible}>
      {loadError ? (
        <div className="certificate-notice certificate-notice--error">
          <i className="ti ti-alert-triangle" aria-hidden="true"></i>
          <span>{loadError}</span>
        </div>
      ) : null}

      {!loading && !eligible ? (
        <div className="certificate-notice certificate-notice--warn">
          <i className="ti ti-lock" aria-hidden="true"></i>
          <span>
            {dto?.eligibility.message ??
              "이 페이지는 조직 경로(엥크레/오랑캐/팔랑크스)로 접속해야 경력 증명서를 발급할 수 있습니다."}
          </span>
        </div>
      ) : null}

      {!loading && eligible && !templateReady ? (
        <div className="certificate-notice certificate-notice--warn">
          <i className="ti ti-photo-off" aria-hidden="true"></i>
          <span>{dto?.template.message ?? "증명서 템플릿 이미지가 등록되지 않았습니다."}</span>
        </div>
      ) : null}

      <div className="certificate-layout">
        <div className="certificate-form">
          <p className="certificate-form__hint">
            <span className="certificate-badge certificate-badge--auto">자동 조회</span>
            는 현재 로그인 정보에서 가져온 값이고,
            <span className="certificate-badge certificate-badge--manual">직접 입력</span>
            은 확정된 데이터 원천이 없어 직접 채워야 하는 항목입니다. 모두 수정할 수 있습니다.
            하단 증명 문구의 소속 표기는 현재 접속한 조직 경로 기준으로 서버가 자동 생성합니다.
          </p>
          <div className="certificate-form__grid">{CAREER_CERTIFICATE_INPUT_FIELDS.map(renderField)}</div>
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
                <img src={previewUrl} alt="경력 증명서 미리보기" />
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
              <p className="certificate-preview__pdf-note">
                <i className="ti ti-info-circle" aria-hidden="true"></i>
                PDF는 A4 인쇄용으로 생성되며 사방에 약 12.7mm의 안전 여백이 포함됩니다.
              </p>
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
  );
}

// ── 페이지(탭 전환) ───────────────────────────────────────────────────────────

function CertificateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [heroFailed, setHeroFailed] = useState(false);

  // 조직 판정은 사이드바가 /certificate 링크를 만들 때 쓰는 것과 동일한 resolver다
  // (lib/orgNav.ts, resolveCurrentOrgSlug = ?org= 쿼리 > cluster path suffix).
  // 이 페이지가 별도 encre/oranke/phalanx 파서를 갖지 않는다.
  const orgQuery = searchParams?.get("org") ?? null;
  const org = useMemo(() => resolveCurrentOrgSlug(pathname, orgQuery), [pathname, orgQuery]);
  const tabParam = searchParams?.get("tab");
  const tab: CertTab = tabParam === "career" ? "career" : "activity";

  const themeClass = useMemo(() => (org === "encre" ? "certificate-encre" : ""), [org]);

  const switchTab = useCallback(
    (next: CertTab) => {
      if (next === tab) return;
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, tab],
  );

  return (
    <main className={`nftg-content nftg-content-home certificate-page ${themeClass}`}>
      <Animations />
      <Breadcrumb title="증명서 발급" />
      <section className="pb-120" style={{ paddingTop: 24 }}>
        <div className="container">
          <header className="certificate-banner">
            <span className="certificate-banner__badge">
              <i className="ti ti-certificate" aria-hidden="true"></i>CLUB CERTIFICATE
            </span>
            <h1 className="certificate-banner__title">증명서 발급</h1>
            <span className="certificate-banner__bar" aria-hidden="true"></span>
            <p className="certificate-banner__subtitle">
              활동 증명서와 경력 증명서를 확인하고 나만의 증명서를 발급하세요
            </p>
          </header>

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

          <div className="certificate-tabs" role="tablist" aria-label="증명서 종류">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "activity"}
              className={`certificate-tab${tab === "activity" ? " is-active" : ""}`}
              onClick={() => switchTab("activity")}
            >
              <i className="ti ti-file-certificate" aria-hidden="true"></i>
              활동증명서
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "career"}
              className={`certificate-tab${tab === "career" ? " is-active" : ""}`}
              onClick={() => switchTab("career")}
            >
              <i className="ti ti-briefcase" aria-hidden="true"></i>
              경력증명서
            </button>
          </div>

          {/* 두 탭 모두 항상 mount 되어 있다 — hidden 속성으로만 감춰 폼 상태가 서로
              섞이거나 탭 전환 시 초기화되지 않게 한다. */}
          <ActivityCertificatePanel visible={tab === "activity"} />
          <CareerCertificatePanel visible={tab === "career"} org={org} />
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

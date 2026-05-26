"use client";

import { useEffect, useState, useCallback } from "react";
import { useDataMasking } from "@/hooks/useDataMasking";

export type HelpKey =
  | "seasonReputation"
  | "seasonReview"
  | "colleague"
  | "workInfo"
  | "reputation"
  | "weeklyReview"
  | "exp"
  | "ability"
  | "career";

const PLACEHOLDER = "도움말 내용은 추후 추가됩니다.";

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;
const subscribers = new Set<(map: Record<string, string>) => void>();

async function fetchAll(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/help-contents", { cache: "no-store" })
    .then((r) => r.json())
    .then((j) => {
      const data = (j?.data ?? {}) as Record<string, string>;
      cache = data;
      return data;
    })
    .catch(() => ({} as Record<string, string>))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function notify(map: Record<string, string>) {
  cache = map;
  subscribers.forEach((cb) => cb(map));
}

/**
 * 도움말 모달 본문.
 * - 일반 사용자: 저장된 본문(없으면 placeholder) 노출.
 * - 어드민(마더 계정): 본문 우상단에 ✏️ 편집 버튼 → textarea 인라인 편집/저장.
 */
export default function HelpModalBody({ helpKey }: { helpKey: HelpKey }) {
  const { isAdmin } = useDataMasking();
  const [body, setBody] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAll().then((map) => {
      if (!mounted) return;
      setBody(map[helpKey] ?? "");
      setLoaded(true);
    });
    const cb = (map: Record<string, string>) => {
      setBody(map[helpKey] ?? "");
    };
    subscribers.add(cb);
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, [helpKey]);

  const startEdit = useCallback(() => {
    setDraft(body);
    setEditing(true);
  }, [body]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft("");
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/help-contents/${helpKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "저장 실패");
        return;
      }
      const next = { ...(cache ?? {}), [helpKey]: draft };
      notify(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [helpKey, draft]);

  const display = body && body.trim().length > 0 ? body : PLACEHOLDER;

  if (!loaded) {
    return <div className="help-modal-body">{PLACEHOLDER}</div>;
  }

  if (isAdmin && editing) {
    return (
      <div className="help-modal-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={8}
          style={{
            width: "100%",
            padding: 8,
            fontSize: 14,
            lineHeight: 1.6,
            border: "1px solid #ccc",
            borderRadius: 4,
            resize: "vertical",
            background: "#fff",
            color: "#000",
          }}
          placeholder="도움말 내용을 입력하세요"
          disabled={saving}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            style={{ padding: "6px 12px", fontSize: 13, border: "1px solid #ccc", borderRadius: 4, background: "#fff", color: "#333", cursor: "pointer" }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ padding: "6px 12px", fontSize: 13, border: "none", borderRadius: 4, background: "#333", color: "#fff", cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="help-modal-body" style={{ position: "relative", whiteSpace: "pre-wrap" }}>
      {isAdmin && (
        <button
          type="button"
          onClick={startEdit}
          aria-label="도움말 편집"
          title="편집"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            padding: "2px 6px",
            fontSize: 13,
            border: "1px solid #ddd",
            borderRadius: 4,
            background: "#fff",
            color: "#333",
            cursor: "pointer",
            lineHeight: 1.2,
          }}
        >
          ✏️ 편집
        </button>
      )}
      {display}
    </div>
  );
}

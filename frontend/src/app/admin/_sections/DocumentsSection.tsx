"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDocuments } from "@/services/documents";
import { AdminAuthError, AdminDocument, updateDocuments, uploadResume } from "@/services/admin";
import {
  addButtonStyle,
  cardStyle,
  Field,
  inputStyle,
  itemCardStyle,
  labelStyle,
  Message,
  primaryButtonStyle,
  removeButtonStyle,
} from "./shared";

type DocForm = {
  title: string;
  body: string;
  asset_url: string;
};

const emptyDoc: DocForm = { title: "", body: "", asset_url: "" };

const DOC_TYPES = ["resume", "blog", "certificate"] as const;
type DocType = (typeof DOC_TYPES)[number];

function toForm(d: Awaited<ReturnType<typeof fetchDocuments>>[number]): DocForm {
  return { title: d.title, body: d.body, asset_url: d.asset_url ?? "" };
}

function toApi(d: DocForm, display_order: number): AdminDocument {
  return { title: d.title, body: d.body, asset_url: d.asset_url || null, display_order };
}

/** Keyed by docType from the parent so switching tabs remounts this fresh —
 * no manual state reset needed inside an effect. */
function DocTypeEditor({
  docType,
  adminKey,
  onAuthError,
}: {
  docType: DocType;
  adminKey: string;
  onAuthError: () => void;
}) {
  const [items, setItems] = useState<DocForm[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments(docType)
      .then((docs) => setItems(docs.map(toForm)))
      .catch(() => setLoadError(`Could not load ${docType} documents from the API.`));
  }, [docType]);

  const handleResumeUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      await uploadResume(adminKey, file);
      const docs = await fetchDocuments("resume");
      setItems(docs.map(toForm));
      setMessage({ type: "success", text: "Resume replaced and re-extracted. Run `make ingest` to pick it up in chat." });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setMessage({ type: "error", text: "Admin key was rejected — locking." });
        onAuthError();
      } else {
        setMessage({ type: "error", text: "Upload failed — check the file is a PDF and the API is running." });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const update = (index: number, patch: Partial<DocForm>) => {
    if (!items) return;
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const remove = (index: number) => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== index));
  };
  const add = () => {
    if (!items) return;
    setItems([...items, { ...emptyDoc }]);
  };

  const save = async () => {
    if (!items) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = items.map((it, i) => toApi(it, i));
      await updateDocuments(adminKey, docType, payload);
      setMessage({ type: "success", text: `${docType} documents updated.` });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setMessage({ type: "error", text: "Admin key was rejected — locking." });
        onAuthError();
      } else {
        setMessage({ type: "error", text: "Save failed — check the API is running." });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!items) {
    return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>{loadError ?? "Loading…"}</div>;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={labelStyle}>
          {docType} ({items.length})
        </label>
        <button type="button" onClick={add} style={addButtonStyle}>
          + Add {docType}
        </button>
      </div>

      {docType === "resume" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleResumeUpload(file);
            }}
            style={{ fontSize: 12, color: "var(--text-muted)" }}
          />
          {uploading && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Uploading…</span>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((d, i) => (
          <div key={i} style={itemCardStyle}>
            <Field label="Title">
              <input style={inputStyle} value={d.title} onChange={(e) => update(i, { title: e.target.value })} />
            </Field>
            <Field label="Body (used for chat retrieval — plain text/markdown)">
              <textarea
                style={{ ...inputStyle, minHeight: 160, resize: "vertical", fontFamily: "inherit" }}
                value={d.body}
                onChange={(e) => update(i, { body: e.target.value })}
              />
            </Field>
            <Field label="Asset URL (optional — e.g. where the resume PDF or certificate file lives)">
              <input style={inputStyle} value={d.asset_url} onChange={(e) => update(i, { asset_url: e.target.value })} />
            </Field>
            <button type="button" onClick={() => remove(i)} style={removeButtonStyle}>
              Remove
            </button>
          </div>
        ))}
      </div>

      {message && (
        <p style={{ fontSize: 13, color: message.type === "success" ? "var(--green)" : "#f87171" }}>{message.text}</p>
      )}

      <button onClick={save} disabled={saving} style={primaryButtonStyle(saving)}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </>
  );
}

export default function DocumentsSection({
  adminKey,
  onAuthError,
}: {
  adminKey: string;
  onAuthError: () => void;
}) {
  const [docType, setDocType] = useState<DocType>("resume");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", gap: 8 }}>
        {DOC_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDocType(t)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: t === docType ? "var(--accent)" : "transparent",
              color: t === docType ? "#fff" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <DocTypeEditor key={docType} docType={docType} adminKey={adminKey} onAuthError={onAuthError} />
    </div>
  );
}

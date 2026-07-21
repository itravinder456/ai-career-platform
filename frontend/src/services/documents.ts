const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface DocumentRow {
  id: number;
  doc_type: string;
  title: string;
  body: string;
  asset_url: string | null;
  display_order: number;
}

export async function fetchDocuments(docType?: string): Promise<DocumentRow[]> {
  const url = docType
    ? `${API_BASE}/api/v1/documents?doc_type=${encodeURIComponent(docType)}`
    : `${API_BASE}/api/v1/documents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load documents: ${res.status}`);
  return res.json();
}

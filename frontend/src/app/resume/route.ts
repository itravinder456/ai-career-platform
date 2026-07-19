import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Stopgap: serves the PDF straight from the monorepo's data/ folder (the same
// file services/ingestion indexes for RAG) so there's one file to update, not
// two. Once the resume is hosted externally (Drive/S3), just change `resume_url`
// in Postgres (PUT /api/v1/profile) to that URL — no code change needed, this
// route simply stops being linked to.
const FILENAME = "Varikuppala-Ravinder-Senior-AI-Platform-Engineer.pdf";

// cwd is /app in the production image (Dockerfile.frontend copies data/resume
// there) but is frontend/ under `next dev` (monorepo checkout) — try both.
const CANDIDATES = [
  path.join(process.cwd(), "data", "resume", FILENAME),
  path.join(process.cwd(), "..", "data", "resume", FILENAME),
];

export async function GET() {
  const filePath = CANDIDATES.find(existsSync);
  if (!filePath) {
    return NextResponse.json({ error: "Resume file not found" }, { status: 404 });
  }

  const file = await readFile(filePath);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${FILENAME}"`,
    },
  });
}

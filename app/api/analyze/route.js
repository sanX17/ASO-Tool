import { NextResponse } from "next/server";
import fs from "fs/promises";
import * as XLSX from "xlsx";
import { analyzeReviewRows } from "@/lib/review-analysis";
import { resolveDefaultWorkbookPath } from "@/lib/local-workbook";

function analyzeWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Workbook does not contain any sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: ""
  });

  return analyzeReviewRows(rawRows);
}

export async function GET() {
  try {
    const workbookPath = await resolveDefaultWorkbookPath();
    const buffer = await fs.readFile(workbookPath);
    const analyzed = analyzeWorkbookBuffer(buffer);

    return NextResponse.json({
      ...analyzed,
      source: workbookPath
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to read the local workbook." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Excel file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const analyzed = analyzeWorkbookBuffer(buffer);
    return NextResponse.json(analyzed);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to analyze the workbook." },
      { status: 500 }
    );
  }
}

import fs from "fs/promises";
import { NextResponse } from "next/server";
import { resolveNamedWorkbookPath } from "@/lib/local-workbook";
import { analyzeDashboardWorkbook } from "@/lib/dashboard-analysis";

export async function GET() {
  try {
    const workbookPath = await resolveNamedWorkbookPath("android v anr");
    const buffer = await fs.readFile(workbookPath);
    const dashboard = analyzeDashboardWorkbook(buffer);

    return NextResponse.json({
      ...dashboard,
      source: workbookPath
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Failed to read the dashboard workbook." },
      { status: 500 }
    );
  }
}

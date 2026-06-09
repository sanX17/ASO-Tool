import fs from "fs/promises";
import path from "path";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls"]);

function isExcelFile(fileName) {
  return EXCEL_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function findExcelInDirectory(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const excelEntry = entries.find((entry) => entry.isFile() && isExcelFile(entry.name));

  if (!excelEntry) {
    return null;
  }

  return path.join(directoryPath, excelEntry.name);
}

async function getSearchDirectories() {
  const workspaceRoot = process.cwd();
  const publicDirectory = path.join(workspaceRoot, "public");
  const directories = [publicDirectory, workspaceRoot];

  const existingDirectories = await Promise.all(
    directories.map(async (directoryPath) => {
      try {
        const stats = await fs.stat(directoryPath);
        return stats.isDirectory() ? directoryPath : null;
      } catch {
        return null;
      }
    })
  );

  return existingDirectories.filter(Boolean);
}

export async function resolveNamedWorkbookPath(nameFragment) {
  const normalizedFragment = nameFragment.toLowerCase().replace(/\s+/g, " ").trim();
  const searchDirectories = await getSearchDirectories();

  for (const directoryPath of searchDirectories) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const workbookEntry = entries.find((entry) => {
      if (!entry.isFile() || !isExcelFile(entry.name) || entry.name.startsWith("~$")) {
        return false;
      }

      const normalizedName = entry.name.toLowerCase().replace(/\s+/g, " ").trim();
      return normalizedName.includes(normalizedFragment);
    });

    if (workbookEntry) {
      return path.join(directoryPath, workbookEntry.name);
    }
  }

  throw new Error(`Could not find a workbook matching "${nameFragment}".`);
}

export async function resolveDefaultWorkbookPath() {
  const workspaceRoot = process.cwd();
  const preferredDirectory = path.join(workspaceRoot, "ASO reviews");

  try {
    const stats = await fs.stat(preferredDirectory);

    if (stats.isDirectory()) {
      const fileFromDirectory = await findExcelInDirectory(preferredDirectory);

      if (fileFromDirectory) {
        return fileFromDirectory;
      }
    }
  } catch {
    // Fall back to matching workbook names in the workspace root.
  }

  const searchDirectories = await getSearchDirectories();

  for (const directoryPath of searchDirectories) {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const workbookEntry = entries.find((entry) => {
      if (!entry.isFile() || !isExcelFile(entry.name)) {
        return false;
      }

      const normalizedName = entry.name.toLowerCase().replace(/\s+/g, " ").trim();
      return normalizedName.includes("aso reviews");
    });

    if (workbookEntry) {
      return path.join(directoryPath, workbookEntry.name);
    }
  }

  throw new Error(
    'Could not find an Excel file in the "ASO reviews" folder, "public" folder, or a workbook named like "ASO Reviews".'
  );
}

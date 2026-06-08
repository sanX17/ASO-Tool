import * as XLSX from "xlsx";

const VERSION_KEYS = ["android16", "android15", "android14"];

const METRIC_HEADER_MAP = {
  acquisition: "User acquisition",
  uninstall: "Uninstall",
  anr: "ANRs",
  crash: "Crashes"
};

const VERSION_HEADER_MAP = {
  acquisition: {
    android16: "User acquisition Android 16",
    android15: "User acquisition Android 15",
    android14: "User acquisition Android 14"
  },
  uninstall: {
    android16: "Uninstall events Android 16",
    android15: "Uninstall events Android 15",
    android14: "Uninstall events Android 14"
  },
  anr: {
    android16: "ANRs Android 16",
    android15: "ANRs Android 15",
    android14: "ANRs Android 14"
  },
  crash: {
    android16: "Crashes Android 16",
    android15: "Crashes Android 15",
    android14: "Crashes Android 14"
  }
};

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function safeDivide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
}

function toDateLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function movingAverage(rows, key, windowSize = 7) {
  return rows.map((_, index) => {
    const slice = rows.slice(Math.max(0, index - windowSize + 1), index + 1);
    const sum = slice.reduce((total, row) => total + row[key], 0);
    return round(sum / slice.length);
  });
}

function pearsonCorrelation(points, xKey, yKey) {
  const valid = points.filter((point) => Number.isFinite(point[xKey]) && Number.isFinite(point[yKey]));

  if (valid.length < 2) {
    return 0;
  }

  const meanX = valid.reduce((sum, point) => sum + point[xKey], 0) / valid.length;
  const meanY = valid.reduce((sum, point) => sum + point[yKey], 0) / valid.length;

  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  valid.forEach((point) => {
    const dx = point[xKey] - meanX;
    const dy = point[yKey] - meanY;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  });

  if (!denominatorX || !denominatorY) {
    return 0;
  }

  return round(numerator / Math.sqrt(denominatorX * denominatorY), 3);
}

function mapHeaders(headerRow) {
  const headers = headerRow.map((header) => String(header ?? "").trim());
  const indexOf = (label) => headers.findIndex((header) => header === label);

  return {
    date: indexOf("Date"),
    acquisition: indexOf(METRIC_HEADER_MAP.acquisition),
    uninstall: indexOf(METRIC_HEADER_MAP.uninstall),
    anr: indexOf(METRIC_HEADER_MAP.anr),
    crash: indexOf(METRIC_HEADER_MAP.crash),
    acquisitionVersions: Object.fromEntries(
      VERSION_KEYS.map((version) => [version, indexOf(VERSION_HEADER_MAP.acquisition[version])])
    ),
    uninstallVersions: Object.fromEntries(
      VERSION_KEYS.map((version) => [version, indexOf(VERSION_HEADER_MAP.uninstall[version])])
    ),
    anrVersions: Object.fromEntries(
      VERSION_KEYS.map((version) => [version, indexOf(VERSION_HEADER_MAP.anr[version])])
    ),
    crashVersions: Object.fromEntries(
      VERSION_KEYS.map((version) => [version, indexOf(VERSION_HEADER_MAP.crash[version])])
    )
  };
}

function numberAt(row, index) {
  const value = Number(row[index] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function analyzeDashboardWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Dashboard workbook does not contain any sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: ""
  });

  if (rawRows.length < 2) {
    throw new Error("Dashboard workbook does not contain enough rows.");
  }

  const headerMap = mapHeaders(rawRows[0]);

  const rows = rawRows
    .slice(1)
    .filter((row) => row[headerMap.date])
    .map((row) => {
      const dateValue = row[headerMap.date];
      const acquisition = numberAt(row, headerMap.acquisition);
      const uninstall = numberAt(row, headerMap.uninstall);
      const anr = numberAt(row, headerMap.anr);
      const crash = numberAt(row, headerMap.crash);
      const netGrowth = acquisition - uninstall;
      const uninstallRate = round(safeDivide(uninstall * 100, acquisition));
      const anrRate = round(safeDivide(anr * 100, acquisition));
      const crashRate = round(safeDivide(crash * 100, acquisition));
      const impactIndex = round(safeDivide((crash + anr) * 100, acquisition));
      const stabilityScore = round(Math.max(0, 100 - crashRate * 0.7 - anrRate * 0.3));

      return {
        date: toDateLabel(dateValue),
        dateValue: toIsoDate(dateValue),
        acquisition,
        acquisitionAndroid16: numberAt(row, headerMap.acquisitionVersions.android16),
        acquisitionAndroid15: numberAt(row, headerMap.acquisitionVersions.android15),
        acquisitionAndroid14: numberAt(row, headerMap.acquisitionVersions.android14),
        uninstall,
        uninstallAndroid16: numberAt(row, headerMap.uninstallVersions.android16),
        uninstallAndroid15: numberAt(row, headerMap.uninstallVersions.android15),
        uninstallAndroid14: numberAt(row, headerMap.uninstallVersions.android14),
        anr,
        anrAndroid16: numberAt(row, headerMap.anrVersions.android16),
        anrAndroid15: numberAt(row, headerMap.anrVersions.android15),
        anrAndroid14: numberAt(row, headerMap.anrVersions.android14),
        crash,
        crashAndroid16: numberAt(row, headerMap.crashVersions.android16),
        crashAndroid15: numberAt(row, headerMap.crashVersions.android15),
        crashAndroid14: numberAt(row, headerMap.crashVersions.android14),
        netGrowth,
        uninstallRate,
        anrRate,
        crashRate,
        impactIndex,
        stabilityScore
      };
    });

  const totalAcquisition = rows.reduce((sum, row) => sum + row.acquisition, 0);
  const totalUninstall = rows.reduce((sum, row) => sum + row.uninstall, 0);
  const totalCrashes = rows.reduce((sum, row) => sum + row.crash, 0);
  const totalAnrs = rows.reduce((sum, row) => sum + row.anr, 0);

  const worstDay = rows.reduce((worst, row) => (row.stabilityScore < worst.stabilityScore ? row : worst), rows[0]);
  const bestDay = rows.reduce((best, row) => (row.stabilityScore > best.stabilityScore ? row : best), rows[0]);

  const rolling = rows.map((row, index) => ({
    date: row.date,
    dateValue: row.dateValue,
    acquisition: movingAverage(rows, "acquisition")[index],
    uninstall: movingAverage(rows, "uninstall")[index],
    crashRate: movingAverage(rows, "crashRate")[index],
    anrRate: movingAverage(rows, "anrRate")[index]
  }));

  const uninstallShare = rows.map((row) => ({
    date: row.date,
    android16: round(safeDivide(row.uninstallAndroid16 * 100, row.uninstall)),
    android15: round(safeDivide(row.uninstallAndroid15 * 100, row.uninstall)),
    android14: round(safeDivide(row.uninstallAndroid14 * 100, row.uninstall))
  }));

  const acquisitionVsCrashesScatter = rows.flatMap((row) =>
    VERSION_KEYS.map((version) => {
      const suffix = version === "android16" ? "Android16" : version === "android15" ? "Android15" : "Android14";
      return {
        label: row.date,
        version: version.replace("android", "Android "),
        x: row[`acquisition${suffix}`],
        y: row[`crash${suffix}`]
      };
    })
  );

  const crashVsUninstall = rows.map((row) => ({
    label: row.date,
    x: row.crash,
    y: row.uninstall
  }));

  const anrVsUninstall = rows.map((row) => ({
    label: row.date,
    x: row.anr,
    y: row.uninstall
  }));

  const heatmap = [
    { metric: "Acquisition", values: rows.map((row) => row.acquisition) },
    { metric: "Uninstall", values: rows.map((row) => row.uninstall) },
    { metric: "ANRs", values: rows.map((row) => row.anr) },
    { metric: "Crashes", values: rows.map((row) => row.crash) }
  ];

  const kpis = {
    totalAcquisition,
    totalUninstall,
    uninstallRate: round(safeDivide(totalUninstall * 100, totalAcquisition)),
    totalCrashes,
    crashRate: round(safeDivide(totalCrashes * 100, totalAcquisition)),
    totalAnrs,
    anrRate: round(safeDivide(totalAnrs * 100, totalAcquisition)),
    worstDay: worstDay.date,
    bestDay: bestDay.date,
    netGrowth: totalAcquisition - totalUninstall,
    stabilityScore: round(rows.reduce((sum, row) => sum + row.stabilityScore, 0) / rows.length)
  };

  return {
    sourceSheet: sheetName,
    rows,
    rolling,
    uninstallShare,
    acquisitionVsCrashesScatter,
    crashVsUninstall,
    anrVsUninstall,
    heatmap,
    kpis,
    correlations: {
      crashVsUninstall: pearsonCorrelation(crashVsUninstall, "x", "y"),
      anrVsUninstall: pearsonCorrelation(anrVsUninstall, "x", "y")
    }
  };
}

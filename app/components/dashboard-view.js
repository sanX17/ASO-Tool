"use client";

import { useEffect, useMemo, useState } from "react";

const SERIES_COLORS = {
  acquisition: "#a64b2a",
  acquisitionAndroid16: "#bf6a3d",
  acquisitionAndroid15: "#e08f4f",
  acquisitionAndroid14: "#f0b56e",
  uninstall: "#6c5b46",
  uninstallRate: "#9f7b32",
  netGrowth: "#2f7d4a",
  anr: "#b65e3c",
  anrRate: "#bc5a2f",
  anrAndroid16: "#cb6d47",
  anrAndroid15: "#de8b5b",
  anrAndroid14: "#efad7f",
  crash: "#a12b2b",
  crashRate: "#bd4040",
  crashAndroid16: "#b33b3b",
  crashAndroid15: "#cd5b5b",
  crashAndroid14: "#e58989",
  android16: "#c85b39",
  android15: "#d98f49",
  android14: "#e5b96d",
  stabilityScore: "#2f7d4a",
  impactIndex: "#7c341a"
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatPercent(value) {
  return `${formatNumber(value)}%`;
}

function getSeriesExtents(data, seriesKeys) {
  const values = data.flatMap((row) => seriesKeys.map((key) => Number(row[key] ?? 0)));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  return { min, max };
}

function buildLinePath(data, key, min, max, width, height) {
  return data
    .map((row, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const value = Number(row[key] ?? 0);
      const ratio = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - ratio * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(data, key, min, max, width, height) {
  const line = buildLinePath(data, key, min, max, width, height);
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

function ChartCard({ title, subtitle, children, tall = false }) {
  return (
    <article className={`viz-card${tall ? " viz-card-tall" : ""}`}>
      <div className="viz-card-head">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </article>
  );
}

function buildHeatmapRows(rows) {
  return [
    { metric: "Acquisition", values: rows.map((row) => row.acquisition) },
    { metric: "Uninstall", values: rows.map((row) => row.uninstall) },
    { metric: "ANRs", values: rows.map((row) => row.anr) },
    { metric: "Crashes", values: rows.map((row) => row.crash) }
  ];
}

function KPIGrid({ kpis }) {
  const cards = [
    { label: "Total Acquisition", value: formatNumber(kpis.totalAcquisition) },
    { label: "Total Uninstall", value: formatNumber(kpis.totalUninstall) },
    { label: "Uninstall Rate", value: formatPercent(kpis.uninstallRate) },
    { label: "Total Crashes", value: formatNumber(kpis.totalCrashes) },
    { label: "Crash Rate", value: formatPercent(kpis.crashRate) },
    { label: "Total ANRs", value: formatNumber(kpis.totalAnrs) },
    { label: "ANR Rate", value: formatPercent(kpis.anrRate) },
    { label: "Worst Day", value: kpis.worstDay },
    { label: "Best Day", value: kpis.bestDay }
  ];

  return (
    <section className="kpi-grid">
      {cards.map((card) => (
        <article className="kpi-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}

function MultiLineChart({ data, lines, valueFormatter = formatNumber, filledKey }) {
  if (!data.length) {
    return <p className="chart-caption">No data available for the selected date range.</p>;
  }

  const width = 720;
  const height = 220;
  const axisHeight = 48;
  const labelStep = data.length > 16 ? 2 : 1;
  const { min, max } = getSeriesExtents(data, lines.map((line) => line.key));

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height + axisHeight}`} className="chart-svg" role="img">
        <g transform="translate(0, 8)">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <line
              key={tick}
              x1="0"
              x2={width}
              y1={height - tick * height}
              y2={height - tick * height}
              className="chart-grid"
            />
          ))}
          {filledKey ? (
            <path
              d={buildAreaPath(data, filledKey, min, max, width, height)}
              fill="rgba(47, 125, 74, 0.12)"
            />
          ) : null}
          {lines.map((line) => (
            <path
              key={line.key}
              d={buildLinePath(data, line.key, min, max, width, height)}
              fill="none"
              stroke={SERIES_COLORS[line.key] || line.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {data.map((row, index) => {
            const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
            if (index % labelStep !== 0 && index !== data.length - 1) {
              return null;
            }
            return (
              <text key={row.date} x={x} y={height + 26} textAnchor="middle" className="chart-axis">
                {row.date}
              </text>
            );
          })}
        </g>
      </svg>
      <div className="chart-legend">
        {lines.map((line) => (
          <span key={line.key}>
            <i style={{ backgroundColor: SERIES_COLORS[line.key] || line.color }} />
            {line.label}
          </span>
        ))}
      </div>
      <p className="chart-caption">
        Latest: {lines.map((line) => `${line.label} ${valueFormatter(data.at(-1)?.[line.key] ?? 0)}`).join(" | ")}
      </p>
    </div>
  );
}

function GroupedBarChart({ data, series, valueFormatter = formatNumber }) {
  if (!data.length) {
    return <p className="chart-caption">No data available for the selected date range.</p>;
  }

  const max = Math.max(
    ...data.flatMap((row) => series.map((item) => Number(row[item.key] ?? 0))),
    1
  );

  return (
    <div className="bar-chart">
      {data.map((row) => (
        <div className="bar-row" key={row.date}>
          <span className="bar-label">{row.date}</span>
          <div className="bar-groups">
            {series.map((item) => {
              const width = `${(Number(row[item.key] ?? 0) / max) * 100}%`;
              return (
                <div className="bar-group" key={item.key}>
                  <div className="bar-fill" style={{ width, backgroundColor: SERIES_COLORS[item.key] || item.color }} />
                  <span>{item.label}: {valueFormatter(row[item.key] ?? 0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StackedBarChart({ data, keys, percent = false }) {
  if (!data.length) {
    return <p className="chart-caption">No data available for the selected date range.</p>;
  }

  return (
    <div className="stacked-chart">
      {data.map((row) => {
        const total = keys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0) || 1;
        return (
          <div className="stacked-row" key={row.date}>
            <span className="bar-label">{row.date}</span>
            <div className="stacked-bar">
              {keys.map((key) => (
                <div
                  key={key}
                  className="stacked-segment"
                  style={{
                    width: `${(Number(row[key] ?? 0) / (percent ? 100 : total)) * 100}%`,
                    backgroundColor: SERIES_COLORS[key]
                  }}
                  title={`${key}: ${percent ? formatPercent(row[key]) : formatNumber(row[key])}`}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="chart-legend">
        {keys.map((key) => (
          <span key={key}>
            <i style={{ backgroundColor: SERIES_COLORS[key] }} />
            {key.replace("android", "Android ")}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScatterPlot({ points, titleX, titleY, coloredByVersion = false }) {
  const width = 720;
  const height = 220;
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);

  return (
    <div className="chart-shell">
      <svg viewBox={`0 0 ${width} ${height + 30}`} className="chart-svg" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1="0"
            x2={width}
            y1={height - tick * height}
            y2={height - tick * height}
            className="chart-grid"
          />
        ))}
        {points.map((point, index) => {
          const x = (point.x / maxX) * width;
          const y = height - (point.y / maxY) * height;
          return (
            <circle
              key={`${point.label}-${index}`}
              cx={x}
              cy={y}
              r="5"
              fill={coloredByVersion ? SERIES_COLORS[point.version.toLowerCase().replace(" ", "")] || "#a64b2a" : "#a64b2a"}
              opacity="0.8"
            />
          );
        })}
        <text x="10" y={height + 20} className="chart-axis">{titleX}</text>
        <text x={width - 10} y="18" textAnchor="end" className="chart-axis">{titleY}</text>
      </svg>
    </div>
  );
}

function Heatmap({ data, dates }) {
  if (!dates.length) {
    return <p className="chart-caption">No data available for the selected date range.</p>;
  }

  const max = Math.max(...data.flatMap((row) => row.values), 1);
  const gridTemplateColumns = `110px repeat(${dates.length}, minmax(34px, 1fr))`;
  return (
    <div className="heatmap">
      <div className="heatmap-header" style={{ gridTemplateColumns }}>
        <span />
        {dates.map((date) => (
          <span key={date}>{date}</span>
        ))}
      </div>
      {data.map((row) => (
        <div className="heatmap-row" key={row.metric} style={{ gridTemplateColumns }}>
          <strong>{row.metric}</strong>
          {row.values.map((value, index) => (
            <span
              key={`${row.metric}-${index}`}
              className="heatmap-cell"
              style={{ opacity: 0.18 + (value / max) * 0.82 }}
              title={`${row.metric}: ${formatNumber(value)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function GaugeCard({ value }) {
  const circumference = 2 * Math.PI * 52;
  const progress = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 140 140" className="gauge-svg">
        <circle cx="70" cy="70" r="52" className="gauge-base" />
        <circle
          cx="70"
          cy="70"
          r="52"
          className="gauge-progress"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="gauge-value">
        <strong>{formatNumber(value)}</strong>
        <span>Health Score</span>
      </div>
    </div>
  );
}

export default function DashboardView({ data, isPending, message }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!data?.rows?.length) {
      return;
    }

    const defaultRows = data.rows.slice(Math.max(0, data.rows.length - 20));
    setStartDate(defaultRows[0].dateValue);
    setEndDate(defaultRows.at(-1).dateValue);
  }, [data]);

  const filteredDashboardRows = useMemo(() => {
    if (!data?.rows?.length || !startDate || !endDate) {
      return data?.rows ?? [];
    }

    const nextRows = data.rows.filter((row) => row.dateValue >= startDate && row.dateValue <= endDate);
    return nextRows.length ? nextRows : data.rows.slice(Math.max(0, data.rows.length - 20));
  }, [data, endDate, startDate]);

  const filteredRollingRows = useMemo(() => {
    if (!data?.rolling?.length || !startDate || !endDate) {
      return data?.rolling ?? [];
    }

    const nextRows = data.rolling.filter((row) => row.dateValue >= startDate && row.dateValue <= endDate);
    return nextRows.length ? nextRows : data.rolling.slice(Math.max(0, data.rolling.length - 20));
  }, [data, endDate, startDate]);

  const filteredHeatmap = useMemo(() => buildHeatmapRows(filteredDashboardRows), [filteredDashboardRows]);

  if (!data) {
    return (
      <section className="hero-card">
        <h1>Android growth and stability dashboard</h1>
        <p className="hero-copy">{isPending ? "Reading Android V ANR.xlsx..." : message}</p>
      </section>
    );
  }

  return (
    <>
      <KPIGrid kpis={data.kpis} />

      <section className="viz-grid">
        <ChartCard title="User Acquisition Trend" subtitle="Growth Metrics">
          <MultiLineChart
            data={data.rows}
            lines={[
              { key: "acquisition", label: "Total Acquisition" },
              { key: "acquisitionAndroid14", label: "Android 14" },
              { key: "acquisitionAndroid15", label: "Android 15" },
              { key: "acquisitionAndroid16", label: "Android 16" }
            ]}
          />
        </ChartCard>

        <ChartCard title="Net User Growth" subtitle="Growth Metrics">
          <MultiLineChart
            data={data.rows}
            lines={[{ key: "netGrowth", label: "Net Growth" }]}
            filledKey="netGrowth"
          />
        </ChartCard>

        <ChartCard title="Acquisition vs Uninstall" subtitle="Growth Metrics">
          <MultiLineChart
            data={data.rows}
            lines={[
              { key: "acquisition", label: "Acquisition" },
              { key: "uninstall", label: "Uninstall" }
            ]}
          />
        </ChartCard>

        <ChartCard title="Uninstall Rate %" subtitle="Retention / Churn">
          <MultiLineChart
            data={data.rows}
            lines={[{ key: "uninstallRate", label: "Uninstall Rate %" }]}
            valueFormatter={formatPercent}
          />
        </ChartCard>

        <ChartCard title="ANR Rate %" subtitle="Stability Metrics">
          <MultiLineChart
            data={data.rows}
            lines={[{ key: "anrRate", label: "ANR Rate %" }]}
            valueFormatter={formatPercent}
          />
        </ChartCard>

        <ChartCard title="Crash Rate %" subtitle="Stability Metrics">
          <MultiLineChart
            data={data.rows}
            lines={[{ key: "crashRate", label: "Crash Rate %" }]}
            valueFormatter={formatPercent}
          />
        </ChartCard>

        <ChartCard title="Stability Score" subtitle="Stability Metrics">
          <GaugeCard value={data.kpis.stabilityScore} />
        </ChartCard>

        <ChartCard title="Crash + ANR Combined Impact" subtitle="Correlation">
          <MultiLineChart
            data={data.rows}
            lines={[{ key: "impactIndex", label: "Impact Index %" }]}
            valueFormatter={formatPercent}
          />
        </ChartCard>

        <ChartCard title="Daily Health Heatmap" subtitle="Heatmaps" tall>
          <div className="filter-row">
            <label className="filter-field">
              <span>Start Date</span>
              <input
                type="date"
                min={data.rows[0]?.dateValue}
                max={data.rows.at(-1)?.dateValue}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="filter-field">
              <span>End Date</span>
              <input
                type="date"
                min={data.rows[0]?.dateValue}
                max={data.rows.at(-1)?.dateValue}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>
          <Heatmap data={filteredHeatmap} dates={filteredDashboardRows.map((row) => row.date)} />
        </ChartCard>

        <ChartCard title="7-Day Average" subtitle="Rolling Averages" tall>
          <MultiLineChart
            data={filteredRollingRows}
            lines={[
              { key: "acquisition", label: "Acquisition" },
              { key: "uninstall", label: "Uninstall" },
              { key: "crashRate", label: "Crash Rate %" },
              { key: "anrRate", label: "ANR Rate %" }
            ]}
          />
        </ChartCard>

        <ChartCard title="Version-wise Uninstall Share" subtitle="Retention / Churn">
          <StackedBarChart data={data.uninstallShare} keys={["android14", "android15", "android16"]} percent />
        </ChartCard>

        <ChartCard title="ANR vs Crash Comparison" subtitle="Stability Metrics">
          <GroupedBarChart
            data={data.rows}
            series={[
              { key: "anr", label: "ANRs" },
              { key: "crash", label: "Crashes" }
            ]}
          />
        </ChartCard>

        <ChartCard title="Crash Distribution by Android Version" subtitle="Version Diagnostics">
          <StackedBarChart data={data.rows} keys={["crashAndroid14", "crashAndroid15", "crashAndroid16"]} />
        </ChartCard>

        <ChartCard title="ANR Distribution by Android Version" subtitle="Version Diagnostics">
          <StackedBarChart data={data.rows} keys={["anrAndroid14", "anrAndroid15", "anrAndroid16"]} />
        </ChartCard>

        <ChartCard title="ANR vs Crash Comparison" subtitle="Stability Metrics">
          <GroupedBarChart
            data={data.rows}
            series={[
              { key: "anr", label: "ANRs" },
              { key: "crash", label: "Crashes" }
            ]}
          />
        </ChartCard>
      </section>
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import DashboardView from "@/app/components/dashboard-view";
import { DEFAULT_TEMPLATES, generateReplyFromTemplate } from "@/lib/review-analysis";

const sentimentTone = {
  positive: "Positive",
  medium: "Medium",
  negative: "Negative"
};

const statusTone = {
  Pending: "status-pending",
  Edited: "status-edited",
  Approved: "status-approved",
  Skipped: "status-skipped"
};

export default function HomePage() {
  const [activeView, setActiveView] = useState("dashboard");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [reviewMessage, setReviewMessage] = useState('Reading local workbook "ASO Reviews .xlsx"...');
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardMessage, setDashboardMessage] = useState('Reading local workbook "Android V ANR.xlsx"...');
  const [isPending, startTransition] = useTransition();

  const templates = DEFAULT_TEMPLATES;

  const applyTemplates = (incomingRows, activeTemplates) =>
    incomingRows.map((row) => ({
      ...row,
      reply: generateReplyFromTemplate(row, activeTemplates),
      status: row.status || "Pending"
    }));

  const updateSummary = (nextRows) => {
    const nextSummary = nextRows.reduce(
      (accumulator, row) => {
        accumulator.total += 1;
        accumulator[row.sentiment] += 1;
        return accumulator;
      },
      { total: 0, positive: 0, medium: 0, negative: 0 }
    );

    setSummary(nextSummary);
  };

  const exportExcel = async () => {
    if (!rows.length) {
      return;
    }

    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        Name: row.name,
        Review: row.review,
        Rating: row.rating,
        Sentiment: sentimentTone[row.sentiment],
        "Auto Reply": row.reply,
        Status: row.status
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Replies");
    XLSX.writeFile(workbook, "aso-review-replies.xlsx");
  };

  const updateRow = (index, updater) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        return typeof updater === "function" ? updater(row) : { ...row, ...updater };
      })
    );
  };

  const loadLocalWorkbook = () => {
    startTransition(async () => {
      setReviewMessage('Reading local workbook "ASO Reviews .xlsx"...');

      try {
        const response = await fetch("/api/analyze");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load the local workbook.");
        }

        const nextRows = applyTemplates(payload.rows, templates);
        setRows(nextRows);
        updateSummary(nextRows);
        setReviewMessage(`Loaded ${payload.rows.length} reviews from ${payload.source}.`);
      } catch (error) {
        setRows([]);
        setSummary(null);
        setReviewMessage(error.message || "Something went wrong while loading the workbook.");
      }
    });
  };

  const loadDashboardWorkbook = () => {
    startTransition(async () => {
      setDashboardMessage('Reading local workbook "Android V ANR.xlsx"...');

      try {
        const response = await fetch("/api/dashboard");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load the dashboard workbook.");
        }

        setDashboardData(payload);
        setDashboardMessage(`Loaded dashboard data from ${payload.source}.`);
      } catch (error) {
        setDashboardData(null);
        setDashboardMessage(error.message || "Something went wrong while loading dashboard data.");
      }
    });
  };

  useEffect(() => {
    loadLocalWorkbook();
    loadDashboardWorkbook();
  }, []);

  const regenerateReply = (index) => {
    updateRow(index, (row) => ({
      ...row,
      reply: generateReplyFromTemplate(row, templates),
      status: row.status === "Skipped" ? "Skipped" : "Pending"
    }));
  };

  const regenerateAllReplies = () => {
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        reply: generateReplyFromTemplate(row, templates),
        status: row.status === "Skipped" ? "Skipped" : "Pending"
      }))
    );
    setReviewMessage("Replies regenerated using the current templates.");
  };

  return (
    <main className="page-shell">
      <div className="dashboard-shell">
        <aside className="sidebar-card">
          <div className="sidebar-section">
            <p className="eyebrow">Workspace</p>
            <h2 className="sidebar-title">Review Tools</h2>
          </div>

          <nav className="sidebar-nav" aria-label="Review tools">
            <button
              className={`sidebar-button${activeView === "dashboard" ? " sidebar-button-active" : ""}`}
              type="button"
              aria-current={activeView === "dashboard" ? "page" : undefined}
              onClick={() => setActiveView("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`sidebar-button${activeView === "autoTool" ? " sidebar-button-active" : ""}`}
              type="button"
              aria-current={activeView === "autoTool" ? "page" : undefined}
              onClick={() => setActiveView("autoTool")}
            >
              Auto Tool
            </button>
          </nav>

          <p className="sidebar-note">
            Dashboard reads <strong>Android V ANR.xlsx</strong>. Auto Tool reads <strong>ASO Reviews .xlsx</strong>.
          </p>
        </aside>

        <div className="content-column">
          {activeView === "dashboard" ? (
            <DashboardView data={dashboardData} isPending={isPending} message={dashboardMessage} />
          ) : (
            <>
              <section className="summary-grid">
                <article className="summary-card">
                  <span>Total Reviews</span>
                  <strong>{summary?.total ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>Positive</span>
                  <strong>{summary?.positive ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>Medium</span>
                  <strong>{summary?.medium ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>Negative</span>
                  <strong>{summary?.negative ?? 0}</strong>
                </article>
              </section>

              <section className="table-card">
                <div className="table-header">
                  <div>
                    <p className="eyebrow">Processed Reviews</p>
                    <h2>Reply-ready output</h2>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Rating</th>
                        <th>Sentiment</th>
                        <th>Review</th>
                        <th>Auto Reply</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? (
                        rows.map((row, index) => (
                          <tr key={`${row.name}-${index}`}>
                            <td data-label="Name">{row.name}</td>
                            <td data-label="Rating">{row.rating}</td>
                            <td data-label="Sentiment">
                              <span className={`badge badge-${row.sentiment}`}>
                                {sentimentTone[row.sentiment]}
                              </span>
                            </td>
                            <td data-label="Review">{row.review}</td>
                            <td data-label="Auto Reply">
                              <textarea
                                className="reply-input"
                                value={row.reply}
                                onChange={(event) =>
                                  updateRow(index, {
                                    reply: event.target.value,
                                    status: row.status === "Skipped" ? "Skipped" : "Edited"
                                  })
                                }
                              />
                            </td>
                            <td data-label="Status">
                              <span className={`status-pill ${statusTone[row.status]}`}>{row.status}</span>
                            </td>
                            <td data-label="Actions">
                              <div className="action-stack">
                                <button
                                  className="table-button"
                                  type="button"
                                  onClick={() => updateRow(index, { status: "Approved" })}
                                >
                                  Approve
                                </button>
                                <button
                                  className="table-button"
                                  type="button"
                                  onClick={() => updateRow(index, { status: "Skipped" })}
                                >
                                  Skip
                                </button>
                                <button className="table-button" type="button" onClick={() => regenerateReply(index)}>
                                  Regenerate
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="empty-state">
                            No reviews processed yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api/client";
import ReviewCard from "../components/ReviewCard";
import CopyButton from "../components/CopyButton";
import { useToast } from "../components/ToastContainer";

// Helper: format review as Markdown for copying
function formatReviewAsMarkdown(review) {
  const lines = [
    `# AI Code Review: ${review.owner}/${review.repo}#${review.pr_number}`,
    "",
    `**PR URL:** ${review.pr_url}`,
    `**Model:** ${review.model || "unknown"}`,
    `**Reviewed at:** ${new Date(review.created_at).toLocaleString()}`,
    `**Issues found:** ${review.comments.length}`,
    "",
    "---",
    "",
  ];

  if (review.was_truncated) {
    lines.push("⚠️ **Note:** Diff was truncated — review covers only the first part.");
    lines.push("");
  }

  if (review.comments.length === 0) {
    lines.push("✅ **No issues found. Clean PR!**");
  } else {
    const bySeverity = { high: [], medium: [], low: [] };
    review.comments.forEach((c) => {
      const sev = c.severity || "medium";
      bySeverity[sev].push(c);
    });

    ["high", "medium", "low"].forEach((sev) => {
      if (bySeverity[sev].length === 0) return;
      const emoji = sev === "high" ? "🔴" : sev === "medium" ? "🟡" : "🟢";
      lines.push(`## ${emoji} ${sev.charAt(0).toUpperCase() + sev.slice(1)} Severity`);
      lines.push("");

      bySeverity[sev].forEach((c, idx) => {
        lines.push(`### ${idx + 1}. ${c.file || "unknown file"}${c.line != null ? `:${c.line}` : ""}`);
        lines.push("");
        lines.push(`**Category:** ${c.category}`);
        lines.push(`**Description:** ${c.description}`);
        if (c.suggested_fix) {
          lines.push("");
          lines.push("**Suggested Fix:**");
          lines.push("```");
          lines.push(c.suggested_fix);
          lines.push("```");
        }
        lines.push("");
        lines.push("---");
        lines.push("");
      });
    });
  }

  return lines.join("\n");
}

// Helper: get PR size label
function getPrSizeLabel(commentCount) {
  if (commentCount === 0) return { label: "Clean", className: "size-clean" };
  if (commentCount <= 3) return { label: "XS", className: "size-xs" };
  if (commentCount <= 8) return { label: "S", className: "size-s" };
  if (commentCount <= 15) return { label: "M", className: "size-m" };
  if (commentCount <= 25) return { label: "L", className: "size-l" };
  return { label: "XL", className: "size-xl" };
}

// History page: list of past reviews; click one to expand its comments
export default function HistoryPage() {
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    api.listReviews()
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id) => {
    if (selected?.id === id) {
      setSelected(null);
      return;
    }
    setError("");
    try {
      setSelected(await api.getReview(id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopy = (review) => {
    const markdown = formatReviewAsMarkdown(review);
    navigator.clipboard.writeText(markdown);
    showToast("Review copied as Markdown", "success");
  };

  if (loading) return <p style={styles.center}>Loading history…</p>;
  if (error) return <p style={styles.error}>Failed to load: {error}</p>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>📜 Review History</h1>

      {reviews.length === 0 ? (
        <p style={styles.center}>No reviews yet — submit a PR on the Home page.</p>
      ) : (
        reviews.map((r) => (
          <div key={r.id} style={styles.row} onClick={() => handleSelect(r.id)}>
            <div style={styles.rowTop}>
              <strong>{r.repo}#{r.pr_number}</strong>
              <span className={`pr-size-badge ${getPrSizeLabel(r.comment_count).className}`}>
                {getPrSizeLabel(r.comment_count).label}
              </span>
              <span style={styles.date}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div style={styles.url}>{r.pr_url}</div>

            {selected?.id === r.id && (
              <div style={styles.detail} onClick={(e) => e.stopPropagation()}>
                <div style={styles.detailHeader}>
                  <div>
                    <strong>{selected.owner}/{selected.repo}#{selected.pr_number}</strong>
                    {selected.model && <span style={styles.modelBadge}>Model: {selected.model}</span>}
                  </div>
                  <CopyButton
                    text={formatReviewAsMarkdown(selected)}
                    label="Copy as Markdown"
                  >
                    📋 Copy as Markdown
                  </CopyButton>
                </div>
                {selected.error ? (
                  <p style={styles.error}>⚠️ {selected.error}</p>
                ) : selected.comments.length === 0 ? (
                  <p style={styles.clean}>✅ No issues found</p>
                ) : (
                  selected.comments.map((c) => <ReviewCard key={c.id} comment={c} />)
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 900, margin: "0 auto", padding: "40px 20px" },
  title: { color: "var(--text)" },
  center: { color: "var(--text-muted)", textAlign: "center", marginTop: 40 },
  row: {
    background: "var(--surface)", borderRadius: "var(--radius)", padding: "14px 16px",
    marginBottom: 10, cursor: "pointer", border: "1px solid var(--border)",
    transition: "border-color 0.15s ease",
  },
  rowTop: { display: "flex", gap: 12, alignItems: "center", color: "var(--text)", flexWrap: "wrap" },
  count: { color: "var(--accent)", fontSize: 13 },
  date: { color: "var(--text-faint)", fontSize: 12, marginLeft: "auto" },
  url: { color: "var(--text-muted)", fontSize: 12, marginTop: 4, fontFamily: "var(--font-mono)" },
  detail: { marginTop: 12, cursor: "default", paddingTop: 12, borderTop: "1px solid var(--border)" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 },
  modelBadge: { color: "var(--text-muted)", fontSize: 12, marginLeft: 12 },
  error: { color: "var(--danger)" },
  clean: { color: "var(--good)" },
};
import { useState, useCallback, useEffect } from "react";
import { api } from "../api/client";
import PRInputForm from "../components/PRInputForm";
import ReviewCard from "../components/ReviewCard";
import LoadingSpinner from "../components/LoadingSpinner";
import CopyButton from "../components/CopyButton";
import { useToast } from "../components/ToastContainer";

// Default fallback options if /models API call fails
const FALLBACK_MODELS = [
  { id: "", label: "Default Model (Server Config)" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
];

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
    // Group by severity
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

// Main page: form at top, review results below
export default function HomePage() {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [selectedModel, setSelectedModel] = useState("");
  const { showToast } = useToast();

  // Load models on mount
  useEffect(() => {
    api.listModels()
      .then((data) => {
        if (data && data.models) {
          const list = [
            { id: "", label: `Default Model (${data.default})` },
            ...data.models.map((m) => ({ id: m, label: m })),
          ];
          setModels(list);
          setSelectedModel(""); // default to server default
        }
      })
      .catch(() => {
        // use fallback models
      });
  }, []);

  const handleSubmit = useCallback(async (prUrl) => {
    setLoading(true);
    setError("");
    setReview(null);
    try {
      const data = await api.createReview(prUrl, selectedModel || null);
      setReview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  const handleCopyMarkdown = useCallback(() => {
    if (!review) return;
    const markdown = formatReviewAsMarkdown(review);
    navigator.clipboard.writeText(markdown);
    showToast("Review copied as Markdown", "success");
  }, [review, showToast]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🤖 AI Code Review Bot</h1>
          <p style={styles.subtitle}>Paste a GitHub PR URL to get an LLM-powered review</p>
        </div>
        <div style={styles.modelSelectWrapper}>
          <label htmlFor="model-select" style={styles.modelLabel}>Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={loading}
            style={styles.modelSelect}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <PRInputForm onSubmit={handleSubmit} loading={loading} />

      {loading && <LoadingSpinner />}

      {error && (
        <div style={styles.errorBox}>
          <strong>Review failed:</strong> {error}
        </div>
      )}

      {review && (
        <>
          <div style={styles.meta}>
            <div style={styles.metaLeft}>
              <strong>{review.owner}/{review.repo}#{review.pr_number}</strong>
              {" — "}
              {review.comments.length} issue{review.comments.length === 1 ? "" : "s"} found
              <span className={`pr-size-badge ${getPrSizeLabel(review.comments.length).className}`}>
                {getPrSizeLabel(review.comments.length).label}
              </span>
            </div>
            <div style={styles.metaRight}>
              <CopyButton
                text={formatReviewAsMarkdown(review)}
                label="Copy as Markdown"
              >
                📋 Copy as Markdown
              </CopyButton>
            </div>
          </div>

          {/* Warn the user if backend truncated a huge diff */}
          {review.was_truncated && (
            <div style={styles.warnBox}>
              ⚠️ Diff was too large — review covers only the first part.
            </div>
          )}

          {review.comments.length === 0 ? (
            <p style={styles.clean}>✅ No issues found. Clean PR!</p>
          ) : (
            // High severity first — most actionable issues on top
            [...review.comments]
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
              })
              .map((c) => <ReviewCard key={c.id} comment={c} />)
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 900, margin: "0 auto", padding: "40px 20px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" },
  title: { color: "var(--text)", marginBottom: 4 },
  subtitle: { color: "var(--text-muted)", marginTop: 0 },
  modelSelectWrapper: { display: "flex", alignItems: "center", gap: 8 },
  modelLabel: { color: "var(--text-muted)", fontSize: 14, whiteSpace: "nowrap" },
  modelSelect: {
    padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", fontSize: 13, minWidth: 220,
  },
  meta: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", margin: "20px 0 12px", flexWrap: "wrap", gap: 12 },
  metaLeft: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  metaRight: { display: "flex", alignItems: "center" },
  errorBox: {
    background: "var(--danger)", color: "var(--text)", padding: "12px 16px",
    borderRadius: "var(--radius)", marginBottom: 16,
  },
  warnBox: {
    background: "rgba(242, 184, 75, 0.15)", border: "1px solid var(--warn)", color: "var(--warn)", padding: "10px 14px",
    borderRadius: "var(--radius)", marginBottom: 16, fontSize: 13,
  },
  clean: { color: "var(--good)" },
};
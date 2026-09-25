// Maps severity/category → colors so issues are scannable at a glance
const SEVERITY_COLORS = { high: "var(--danger)", medium: "var(--warn)", low: "var(--good)" };
const CATEGORY_COLORS = {
  security: "#c56cf0",
  bug: "var(--danger)",
  style: "var(--accent)",
};

// One issue from the LLM: file:line, badges, description, suggested fix
import CopyButton from "./CopyButton";

export default function ReviewCard({ comment }) {
  const sevColor = SEVERITY_COLORS[comment.severity] || "var(--text-muted)";
  const catColor = CATEGORY_COLORS[comment.category] || "var(--text-muted)";

  return (
    <div style={{ ...styles.card, borderLeftColor: sevColor }}>
      {/* Header: file location + badges */}
      <div style={styles.header}>
        <span style={styles.file}>
          {comment.file || "unknown file"}
          {comment.line != null && <span style={styles.line}>:{comment.line}</span>}
        </span>
        <span style={{ ...styles.badge, background: catColor }}>
          {comment.category}
        </span>
        <span style={{ ...styles.badge, background: sevColor }}>
          {comment.severity}
        </span>
      </div>

      <p style={styles.desc}>{comment.description}</p>

      {/* Show fix block only when LLM suggested something */}
      {comment.suggested_fix && (
        <div style={styles.fix}>
          <div style={styles.fixHeader}>
            <strong>Suggested fix:</strong>
            <CopyButton text={comment.suggested_fix} label="Copy fix">
              📋 Copy
            </CopyButton>
          </div>
          <pre style={styles.fixCode}>{comment.suggested_fix}</pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface)", borderRadius: "var(--radius)", padding: "14px 16px",
    marginBottom: 12, borderLeft: "4px solid var(--text-muted)",
    whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)",
  },
  header: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  file: { fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)", flex: 1 },
  line: { color: "var(--text-muted)" },
  badge: {
    color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    padding: "2px 8px", borderRadius: 10,
  },
  desc: { margin: "10px 0 0", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 },
  fix: { marginTop: 10, color: "var(--text-muted)", fontSize: 13 },
  fixHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 },
  fixCode: {
  background: "var(--bg)", padding: 10, borderRadius: 6,
  fontSize: 12, margin: "6px 0 0", color: "var(--good)",
  whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid var(--border)",
},
};
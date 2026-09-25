// Maps severity/category → colors so issues are scannable at a glance
const SEVERITY_COLORS = { high: "#ff5252", medium: "#ffb142", low: "#7bed9f" };
const CATEGORY_COLORS = {
  security: "#c56cf0",
  bug: "#ff6b6b",
  style: "#54a0ff",
};

// One issue from the LLM: file:line, badges, description, suggested fix
export default function ReviewCard({ comment }) {
  const sevColor = SEVERITY_COLORS[comment.severity] || "#999";
  const catColor = CATEGORY_COLORS[comment.category] || "#999";

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
          <strong>Suggested fix:</strong>
          <pre style={styles.fixCode}>{comment.suggested_fix}</pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#1e1e1e", borderRadius: 8, padding: "14px 16px",
    marginBottom: 12, borderLeft: "4px solid #999",
    whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  header: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  file: { fontFamily: "monospace", fontSize: 13, color: "#eee", flex: 1 },
  line: { color: "#888" },
  badge: {
    color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    padding: "2px 8px", borderRadius: 10,
  },
  desc: { margin: "10px 0 0", color: "#ccc", fontSize: 14, lineHeight: 1.5 },
  fix: { marginTop: 10, color: "#bbb", fontSize: 13 },
  fixCode: {
  background: "#111", padding: 10, borderRadius: 6,
  fontSize: 12, margin: "6px 0 0", color: "#7bed9f",
  whiteSpace: "pre-wrap", wordBreak: "break-word",
},
};
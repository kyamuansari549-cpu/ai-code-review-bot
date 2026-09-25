import { useEffect, useState } from "react";
import { api } from "../api/client";
import ReviewCard from "../components/ReviewCard";

// History page: list of past reviews; click one to expand its comments
export default function HistoryPage() {
  const [reviews, setReviews] = useState([]);
  const [selected, setSelected] = useState(null); // expanded review (detail)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the list once on mount
  useEffect(() => {
    api.listReviews()
      .then(setReviews)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Clicking a row fetches full detail (with comments) from the backend
  const handleSelect = async (id) => {
    if (selected?.id === id) {
      setSelected(null); // clicking again collapses it
      return;
    }
    setError("");
    try {
      setSelected(await api.getReview(id));
    } catch (err) {
      setError(err.message);
    }
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
              <span style={styles.count}>
                {r.comment_count} issue{r.comment_count === 1 ? "" : "s"}
              </span>
              <span style={styles.date}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div style={styles.url}>{r.pr_url}</div>

            {/* Expanded detail: error (if failed run) or comment cards */}
            {selected?.id === r.id && (
              <div style={styles.detail} onClick={(e) => e.stopPropagation()}>
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
  page: { maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui" },
  title: { color: "#eee" },
  center: { color: "#888", textAlign: "center", marginTop: 40 },
  row: {
    background: "#1e1e1e", borderRadius: 8, padding: "14px 16px",
    marginBottom: 10, cursor: "pointer",
  },
  rowTop: { display: "flex", gap: 12, alignItems: "center", color: "#ddd" },
  count: { color: "#4f8ef7", fontSize: 13 },
  date: { color: "#777", fontSize: 12, marginLeft: "auto" },
  url: { color: "#666", fontSize: 12, marginTop: 4, fontFamily: "monospace" },
  detail: { marginTop: 12, cursor: "default" },
  error: { color: "#ff9b9b" },
  clean: { color: "#7bed9f" },
};
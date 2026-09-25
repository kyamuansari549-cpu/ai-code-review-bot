import { useState } from "react";
import { api } from "../api/client";
import PRInputForm from "../components/PRInputForm";
import ReviewCard from "../components/ReviewCard";
import LoadingSpinner from "../components/LoadingSpinner";

// Main page: form at top, review results below
export default function HomePage() {
  const [review, setReview] = useState(null); // last completed review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (prUrl) => {
    setLoading(true);
    setError("");
    setReview(null);
    try {
      const data = await api.createReview(prUrl);
      setReview(data);
    } catch (err) {
      setError(err.message); // error message already extracted in client.js
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🤖 AI Code Review Bot</h1>
      <p style={styles.subtitle}>Paste a GitHub PR URL to get an LLM-powered review</p>

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
            <strong>{review.owner}/{review.repo}#{review.pr_number}</strong>
            {" — "}
            {review.comments.length} issue{review.comments.length === 1 ? "" : "s"} found
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
  page: { maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui" },
  title: { color: "#eee", marginBottom: 4 },
  subtitle: { color: "#888", marginTop: 0 },
  meta: { color: "#ccc", margin: "20px 0 12px" },
  errorBox: {
    background: "#3a1d1d", color: "#ff9b9b", padding: "12px 16px",
    borderRadius: 8, marginBottom: 16,
  },
  warnBox: {
    background: "#3a2f1d", color: "#ffd58a", padding: "10px 14px",
    borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
  clean: { color: "#7bed9f" },
};
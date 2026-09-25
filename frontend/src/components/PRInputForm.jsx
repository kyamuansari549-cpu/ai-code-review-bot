import { useState } from "react";

// Form where user pastes a GitHub PR URL and hits Review
export default function PRInputForm({ onSubmit, loading }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();

    // Cheap client-side guard before hitting the API
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/.test(trimmed)) {
      setError("Enter a valid PR URL: https://github.com/owner/repo/pull/123");
      return;
    }
    setError("");
    onSubmit(trimmed); // parent (HomePage) runs the API call
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        placeholder="https://github.com/owner/repo/pull/123"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={loading}
        style={styles.input}
      />
      <button type="submit" disabled={loading || !url.trim()} style={styles.button}>
        {loading ? "Reviewing…" : "Review PR"}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </form>
  );
}

// Inline styles — zero-dependency styling, swap for CSS modules later if you want
const styles = {
  form: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 },
  input: {
    flex: 1, minWidth: 280, padding: "10px 12px", borderRadius: 8,
    border: "1px solid #444", background: "#1e1e1e", color: "#eee",
  },
  button: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#4f8ef7", color: "#fff", cursor: "pointer", fontWeight: 600,
  },
  error: { color: "#ff6b6b", width: "100%", margin: "4px 0 0" },
};
// Pure CSS spinner — no spinner libraries needed
export default function LoadingSpinner({ message = "Analyzing PR…" }) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.spinner} />
      <p style={styles.text}>{message}</p>
      <p style={styles.hint}>The LLM can take 10–60 seconds on large diffs</p>
    </div>
  );
}

const spin = {
  // keyframe injection via <style> string is overkill — use CSS animation prop
  animation: "spin 0.8s linear infinite",
};

// Inject the keyframes once (tiny, avoids a CSS file for one animation)
const styleSheet = document.createElement("style");
styleSheet.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

const styles = {
  wrapper: { textAlign: "center", padding: "40px 0" },
  spinner: {
    ...spin,
    width: 40, height: 40, margin: "0 auto 16px",
    border: "4px solid #333", borderTopColor: "#4f8ef7", borderRadius: "50%",
  },
  text: { color: "#eee", fontSize: 15, margin: 0 },
  hint: { color: "#777", fontSize: 12, margin: "6px 0 0" },
};
import { useState } from "react";
import ChatPage from "./components/ChatPage";
import HomePage from "./components/HomePage";
import HistoryPage from "./components/HistoryPage";

const TABS = [
  { id: "chat", label: "Code chat" },
  { id: "home", label: "PR review" },
  { id: "history", label: "PR history" },
];

// Root component: a top nav plus one page at a time.
// Tab state is enough for a few pages, so no router dependency.
// ChatPage stays mounted (only hidden) so switching tabs doesn't lose the conversation.
// The PR pages remount on every visit, so History re-fetches (good).
export default function App() {
  const [tab, setTab] = useState("chat");

  return (
    <>
      <nav style={styles.nav}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tab, ...(tab === t.id ? styles.active : {}) }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ display: tab === "chat" ? "block" : "none" }}>
        <ChatPage />
      </div>
      {tab === "home" && <HomePage />}
      {tab === "history" && <HistoryPage />}
    </>
  );
}

const styles = {
  nav: {
    display: "flex", gap: 8, justifyContent: "center",
    padding: "16px 20px 0", fontFamily: "system-ui",
  },
  tab: {
    background: "transparent", color: "#888", border: "1px solid #2a2a2a",
    borderRadius: 8, padding: "8px 16px", fontSize: 14, cursor: "pointer",
  },
  active: { background: "#1e1e1e", color: "#4f8ef7", borderColor: "#4f8ef7" },
};

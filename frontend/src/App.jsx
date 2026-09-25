import { useState } from "react";
import "./theme.css";
import "./App.css";
import ChatPage from "./components/ChatPage";
import HomePage from "./components/HomePage";
import HistoryPage from "./components/HistoryPage";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/ToastContainer";
import ThemeToggle from "./components/ThemeToggle";

const TABS = [
  { id: "chat", label: "Code chat" },
  { id: "home", label: "PR review" },
  { id: "history", label: "History" },
];

// Small mark used in the top bar in place of a generic emoji icon:
// two code brackets around a dot, standing in for "review".
function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6 3 12l5 6M16 6l5 6-5 6"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.6" fill="var(--accent)" />
    </svg>
  );
}

// Root component: a top bar (mark + tabs) plus one page at a time.
// Tab state is enough for a few pages, so no router dependency.
// ChatPage stays mounted (only hidden) so switching tabs doesn't lose the conversation.
// The PR pages remount on every visit, so History re-fetches (good).
function AppContent() {
  const [tab, setTab] = useState("chat");

  return (
    <>
      <header className="app-topbar">
        <span className="app-mark">
          <Mark />
          Code Review
        </span>
        <nav className="app-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`app-tab ${tab === t.id ? "app-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <ThemeToggle />
      </header>

      <div style={{ display: tab === "chat" ? "block" : "none" }}>
        <ChatPage />
      </div>
      {tab === "home" && <HomePage />}
      {tab === "history" && <HistoryPage />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

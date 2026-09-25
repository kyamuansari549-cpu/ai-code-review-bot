import { useState, useCallback } from "react";
import { useToast } from "./ToastContainer";

export default function CopyButton({ text, children, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Copied to clipboard", "success", 2000);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      showToast("Failed to copy", "error", 2000);
    }
  }, [text, showToast]);

  return (
    <button
      className={`copy-btn ${copied ? "copied" : ""}`}
      onClick={handleCopy}
      aria-label={label}
      title={copied ? "Copied!" : label}
    >
      {children || (copied ? "✓ Copied" : label)}
    </button>
  );
}
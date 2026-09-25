import { useEffect, useCallback, useRef } from "react";

/**
 * Hook for registering keyboard shortcuts
 * @param {Object} shortcuts - Map of key combinations to callbacks
 *   Keys: "ctrl+enter", "mod+k", "escape", etc.
 *   Values: callback functions
 * @param {Object} options
 *   - enableInInputs: whether shortcuts work when focused in input/textarea
 *   - target: element to attach listener to (default: window)
 */
export function useKeyboardShortcuts(shortcuts, options = {}) {
  const { enableInInputs = false, target = window } = options;
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref current without re-registering listeners
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event) => {
    // Skip if typing in input/textarea unless enabled
    if (!enableInInputs) {
      const tag = event.target.tagName.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || event.target.isContentEditable;
      if (isInput && !(event.ctrlKey || event.metaKey)) return;
    }

    // Build key combination string
    const parts = [];
    if (event.ctrlKey) parts.push("ctrl");
    if (event.metaKey) parts.push("meta");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");
    parts.push(event.key.toLowerCase());

    const combo = parts.join("+");
    const callback = shortcutsRef.current[combo];

    if (callback) {
      event.preventDefault();
      callback(event);
    }
  }, [enableInInputs]);

  useEffect(() => {
    const element = target.current || target;
    element.addEventListener("keydown", handleKeyDown);
    return () => element.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, target]);
}

/**
 * Format a key combination for display (e.g., "ctrl+enter" → "Ctrl+Enter")
 */
export function formatShortcut(combo) {
  return combo
    .split("+")
    .map((part) => {
      const map = {
        ctrl: "Ctrl",
        meta: "⌘",
        alt: "Alt",
        shift: "Shift",
        enter: "Enter",
        escape: "Esc",
        " ": "Space",
        arrowup: "↑",
        arrowdown: "↓",
        arrowleft: "←",
        arrowright: "→",
      };
      return map[part.toLowerCase()] || part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" + ");
}
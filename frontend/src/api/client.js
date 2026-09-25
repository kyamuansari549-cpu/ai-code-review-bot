// Central API layer — every backend call goes through here.
// Vite proxies /reviews and /chats → http://localhost:8000 in dev (vite.config.js),
// so we can use relative URLs with no CORS/config hassle.

const BASE_URL = import.meta.env.VITE_API_URL || ""; // e.g. "" in dev, backend URL in prod

async function request(path, options = {}) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // Always parse body — FastAPI returns {"detail": "..."} on errors
  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = data.detail || `Request failed with status ${resp.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  // ---- PR review ----

  // Submit a PR URL for review → returns full ReviewResponse
  // model is optional; if not provided, backend uses default
  createReview: (prUrl, model = null) =>
    request("/reviews", {
      method: "POST",
      body: JSON.stringify({ pr_url: prUrl, model }),
    }),

  // Recent reviews (lightweight rows for History page)
  listReviews: () => request("/reviews"),

  // One review with all its comments
  getReview: (id) => request(`/reviews/${id}`),

  // ---- Code chat ----

  // Start a chat with pasted code and/or a screenshot (base64 data URL)
  // → returns the chat with its messages
  createChat: (content, image = null, model = null) =>
    request("/chats", { method: "POST", body: JSON.stringify({ content, image, model }) }),

  // Follow-up message (text and/or screenshot) in an existing chat → returns the updated chat
  sendChatMessage: (id, content, image = null, model = null) =>
    request(`/chats/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, image, model }),
    }),

  listChats: () => request("/chats"),

  getChat: (id) => request(`/chats/${id}`),

  deleteChat: (id) => request(`/chats/${id}`, { method: "DELETE" }),

  // ---- Models ----

  // Fetch available models from backend (for the dropdown)
  listModels: () => request("/models"),
};

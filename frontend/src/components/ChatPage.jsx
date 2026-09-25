import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css"; // syntax colors for code blocks
import "./ChatPage.css";
import { api } from "../api/client";
import LoadingSpinner from "./LoadingSpinner";

const MAX_CHARS = 30000; // same limit as the backend (chat_schemas.py)
const MAX_IMAGE_SIDE = 1600; // big screenshots are shrunk before upload
const MAX_IMAGE_CHARS = 3_500_000; // stays under the backend limit (4,000,000)
const SCREENSHOT_MARK = "📷"; // backend starts screenshot messages with this

// One-click follow-ups, shown once a chat has started
const QUICK_REPLIES = [
  "Give me the full fixed code.",
  "Explain the main issue in simple words.",
];

// Shrink a screenshot and return it as a data URL the backend accepts
async function prepareImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // PNG keeps code text sharp; fall back to JPEG only if the PNG is too big
  let url = canvas.toDataURL("image/png");
  if (url.length > MAX_IMAGE_CHARS) url = canvas.toDataURL("image/jpeg", 0.85);
  if (url.length > MAX_IMAGE_CHARS) throw new Error("Image is too large. Try cropping the screenshot.");
  return url;
}

// Plain text of a React node tree (syntax highlighting nests the code in <span>s)
function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return textOf(node.props?.children);
}

// Code block inside a reply: language label + Copy button + highlighted code
function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const className = children?.props?.className || "";
  const lang = (className.match(/language-([\w+#-]+)/) || [])[1] || "code";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked by the browser; nothing to do */
    }
  };

  return (
    <div className="chat-code">
      <div className="chat-code-head">
        <span>{lang}</span>
        <button className="chat-code-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

// Wide tables scroll inside their own box instead of stretching the page
function Table({ children }) {
  return (
    <div className="chat-table-wrap">
      <table>{children}</table>
    </div>
  );
}

function Markdown({ text }) {
  // The LLM sometimes puts <br> inside table cells; markdown would show it as plain text
  const clean = text.replace(/<br\s*\/?>/gi, " ");
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
      components={{ pre: CodeBlock, table: Table }}
    >
      {clean}
    </ReactMarkdown>
  );
}

function Message({ message }) {
  if (message.role === "user") {
    // A screenshot message holds code the backend extracted: show it formatted so it can be checked
    if (message.content.startsWith(SCREENSHOT_MARK)) {
      return (
        <div className="chat-user">
          <div className="chat-md">
            <Markdown text={message.content} />
          </div>
        </div>
      );
    }
    // Pasted text is raw code, so show it as-is (markdown would mangle it)
    return (
      <div className="chat-user">
        <pre>{message.content}</pre>
      </div>
    );
  }
  return (
    <div className="chat-md">
      <Markdown text={message.content} />
    </div>
  );
}

export default function ChatPage() {
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]); // past chats for the dropdown
  const [input, setInput] = useState("");
  const [image, setImage] = useState(null); // attached screenshot (data URL)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachError, setAttachError] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  const loadChats = () => {
    api
      .listChats()
      .then((data) => setChats(Array.isArray(data) ? data : []))
      .catch(() => {}); // the list is optional, ignore failures
  };

  useEffect(loadChats, []);

  // Scroll to the newest message
  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const attach = async (file) => {
    if (!file) return;
    setAttachError("");
    try {
      setImage(await prepareImage(file));
    } catch (err) {
      setAttachError(err.message || "Could not read that image.");
    }
  };

  // Ctrl+V with an image on the clipboard attaches it (normal text paste still works)
  const onPaste = (e) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      attach(item.getAsFile());
    }
  };

  const send = async (text) => {
    const content = text.trim();
    const fromBox = text === input;
    const img = fromBox ? image : null; // quick-reply buttons never carry the screenshot
    if ((!content && !img) || loading) return;

    setLoading(true);
    setError("");
    setAttachError("");
    // Show the user's message right away while we wait for the LLM
    const shown = img
      ? `${SCREENSHOT_MARK} Reading screenshot…${content ? `\n\n${content}` : ""}`
      : content;
    const pending = { id: `tmp-${Date.now()}`, role: "user", content: shown };
    setMessages((m) => [...m, pending]);
    if (fromBox) {
      setInput("");
      setImage(null);
    }

    try {
      const data = chatId
        ? await api.sendChatMessage(chatId, content, img)
        : await api.createChat(content, img);
      setChatId(data.id);
      setMessages(data.messages);
      loadChats();
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      if (fromBox) {
        // give everything back so nothing is lost
        setInput(text);
        setImage(img);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setChatId(null);
    setMessages([]);
    setInput("");
    setImage(null);
    setError("");
    setAttachError("");
  };

  const openChat = async (id) => {
    setError("");
    try {
      const data = await api.getChat(id);
      setChatId(data.id);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeChat = async () => {
    if (!chatId || !window.confirm("Delete this chat?")) return;
    try {
      await api.deleteChat(chatId);
      newChat();
      loadChats();
    } catch (err) {
      setError(err.message);
    }
  };

  const canSend = !loading && (input.trim().length > 0 || image !== null);

  return (
    <div className="chat-page">
      <h1 className="chat-title">💬 Code chat</h1>
      <p className="chat-sub">
        Paste code or a screenshot, get a review, then ask follow-ups or the full fixed code.
      </p>

      <div className="chat-toolbar">
        <button className="chat-btn" onClick={newChat}>New chat</button>
        <select
          className="chat-select"
          value={chatId ?? ""}
          onChange={(e) => (e.target.value ? openChat(Number(e.target.value)) : newChat())}
        >
          <option value="">Past chats…</option>
          {chats.map((c) => (
            <option key={c.id} value={c.id}>#{c.id} {c.title}</option>
          ))}
        </select>
        {chatId && <button className="chat-btn" onClick={removeChat}>Delete</button>}
      </div>

      {messages.map((m) => <Message key={m.id} message={m} />)}

      {loading && <LoadingSpinner />}

      {error && (
        <div className="chat-error">
          <strong>Request failed:</strong> {error}
        </div>
      )}

      {chatId && !loading && (
        <div className="chat-chips">
          {QUICK_REPLIES.map((q) => (
            <button key={q} className="chat-chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      )}

      {image && (
        <div className="chat-attach">
          <img src={image} alt="Attached screenshot" />
          <button
            className="chat-attach-remove"
            onClick={() => setImage(null)}
            aria-label="Remove screenshot"
          >
            ×
          </button>
        </div>
      )}
      {attachError && <div className="chat-error">{attachError}</div>}

      <textarea
        className="chat-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send(input);
          }
        }}
        maxLength={MAX_CHARS}
        rows={chatId || image ? 3 : 10}
        disabled={loading}
        placeholder={
          image
            ? "Add a question about the screenshot (optional)…"
            : chatId
              ? "Ask a follow-up, or paste a screenshot…"
              : "Paste your code here (any language), or paste / attach a screenshot…"
        }
      />
      <div className="chat-footer">
        <div className="chat-footer-left">
          <button className="chat-btn" onClick={() => fileRef.current?.click()} disabled={loading}>
            📎 Screenshot
          </button>
          <span className="chat-hint">Ctrl+Enter to send · Ctrl+V pastes a screenshot</span>
        </div>
        <button className="chat-send" onClick={() => send(input)} disabled={!canSend}>
          Send
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          attach(e.target.files?.[0]);
          e.target.value = ""; // lets the same file be picked again
        }}
      />
      <div ref={bottomRef} />
    </div>
  );
}

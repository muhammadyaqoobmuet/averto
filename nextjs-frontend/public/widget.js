/* ChatEmbed Widget v2.0 — self-contained IIFE, no dependencies */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════════
     CONFIG — read data attributes from the <script> tag
  ════════════════════════════════════════════════════════════════ */
  const script = document.currentScript;

  function attr(name, fallback) {
    const v = script.getAttribute(name);
    return v !== null && v !== "" ? v : fallback;
  }

  const apiKey = attr("data-api-key", "");
  const botName = attr("data-bot-name", "Chat Assistant");
  const welcomeMsg = attr(
    "data-welcome-message",
    "Hi! How can I help you today?",
  );
  const primaryColor = attr("data-primary-color", "#2563eb");
  const bubbleColor = attr("data-bubble-color", primaryColor);
  const chatBgOverride = attr("data-chat-bg", "");
  const blurEnabled = attr("data-blur", "false") === "true";
  const darkMode = attr("data-dark-mode", "false") === "true";
  const position = attr("data-position", "bottom-right");
  const borderKey = attr("data-border-radius", "soft");
  const showBranding = attr("data-show-branding", "true") !== "false";
  const apiUrl = attr("data-api-url", window.location.origin + "/api/chat");

  const RADIUS = { sharp: "6px", soft: "12px", rounded: "16px", pill: "24px" };
  const r = RADIUS[borderKey] || RADIUS.soft;

  /* ════════════════════════════════════════════════════════════════
     SESSION — persist across page loads
  ════════════════════════════════════════════════════════════════ */
  let sessionId = localStorage.getItem("ce_session_id");
  if (!sessionId) {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem("ce_session_id", sessionId);
  }

  /* ════════════════════════════════════════════════════════════════
     DERIVED COLORS
  ════════════════════════════════════════════════════════════════ */
  const isLeft = position === "bottom-left";

  // Chat messages area background
  const chatAreaBg = chatBgOverride || (darkMode ? "#111827" : "#f9fafb");

  // Widget window background (glassmorphism or solid)
  const windowBg = blurEnabled
    ? darkMode
      ? "rgba(18,18,28,0.82)"
      : "rgba(255,255,255,0.82)"
    : darkMode
      ? "#18181b"
      : "#ffffff";

  // Bot message bubble
  const botMsgBg = darkMode ? "#1e1e2e" : "#ffffff";
  const botMsgColor = darkMode ? "#e2e8f0" : "#18181b";
  const botBorder = darkMode ? "rgba(255,255,255,0.08)" : "#e4e4e7";

  // Input surface
  const inputBg = darkMode ? "#1e1e2e" : "#f4f4f5";
  const inputColor = darkMode ? "#f1f5f9" : "#18181b";
  const inputBorderColor = darkMode ? "#2d2d3f" : "#e4e4e7";
  const inputAreaBg = darkMode ? "#111827" : "#ffffff";
  const inputAreaBorder = darkMode ? "rgba(255,255,255,0.07)" : "#e4e4e7";
  const placeholderColor = darkMode ? "rgba(255,255,255,0.32)" : "#a1a1aa";

  // Misc surfaces
  const scrollThumb = darkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
  const dotColor = darkMode ? "rgba(255,255,255,0.35)" : "#a1a1aa";

  // Source pills
  const sourceChipBg = darkMode ? "rgba(255,255,255,0.07)" : "#eff6ff";
  const sourceChipBord = darkMode
    ? "rgba(255,255,255,0.12)"
    : "rgba(37,99,235,0.18)";
  const sourceChipHover = darkMode ? "rgba(255,255,255,0.14)" : "#dbeafe";
  const sourceScoreClr = darkMode ? "rgba(255,255,255,0.35)" : "#9ca3af";

  // Branding
  const brandingColor = darkMode
    ? "rgba(255,255,255,0.22)"
    : "rgba(0,0,0,0.28)";
  const brandingHover = darkMode
    ? "rgba(255,255,255,0.48)"
    : "rgba(0,0,0,0.52)";

  // Tail corner: skip rounding the "chat tail" corner when pill mode is on
  const tailRadius = borderKey === "pill" ? r : "4px";

  /* ════════════════════════════════════════════════════════════════
     SHADOW DOM
  ════════════════════════════════════════════════════════════════ */
  const host = document.createElement("div");
  host.id = "chatembed-root";
  // Ensure the host itself doesn't affect layout
  Object.assign(host.style, { position: "static", width: "0", height: "0" });
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  /* ════════════════════════════════════════════════════════════════
     STYLESHEET (all inside shadow DOM)
  ════════════════════════════════════════════════════════════════ */
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Keyframes ── */
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
      40%           { transform: scale(1);    opacity: 1;    }
    }
    @keyframes streamFade {
      from { filter: blur(6px); opacity: 0; }
      to   { filter: blur(0px); opacity: 1; }
    }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0);   }
    }

    /* ── FAB launcher ── */
    #ce-bubble {
      position: fixed;
      bottom: 24px; ${isLeft ? "left: 24px;" : "right: 24px;"}
      width: 56px; height: 56px;
      border-radius: 50%;
      background: ${bubbleColor};
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.26);
      z-index: 2147483647;
      overflow: hidden;
      transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
                  box-shadow 0.22s ease;
    }
    #ce-bubble:hover {
      transform: translateY(-2px) scale(1.07);
      box-shadow: 0 8px 28px rgba(0,0,0,0.3);
    }
    #ce-bubble:active { transform: scale(0.92); }

    /* FAB icon morph */
    .ce-fab-icon {
      position: absolute;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.22s ease, transform 0.22s ease;
      will-change: opacity, transform;
    }
    .ce-fab-chat  { opacity: 1; transform: scale(1)   rotate(0deg);   }
    .ce-fab-close { opacity: 0; transform: scale(0.4) rotate(-90deg); }
    #ce-bubble.is-open .ce-fab-chat  { opacity: 0; transform: scale(0.4) rotate(90deg); }
    #ce-bubble.is-open .ce-fab-close { opacity: 1; transform: scale(1) rotate(0deg);   }

    /* ── Widget window ── */
    #ce-window {
      position: fixed;
      bottom: 92px; ${isLeft ? "left: 24px;" : "right: 24px;"}
      width: 380px;
      height: 560px;
      max-height: calc(100dvh - 120px);
      max-width: calc(100vw - 48px);
      border-radius: ${r};
      background: ${windowBg};
      ${blurEnabled ? "backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%);" : ""}
      border: 1px solid ${darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"};
      box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif;
      font-size: 13px; line-height: 1.5; color: ${darkMode ? "#e2e8f0" : "#18181b"};

      /* Closed state — use visibility so CSS transitions work */
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px) scale(0.97);
      transition: opacity   0.25s cubic-bezier(0.16,1,0.3,1),
                  transform 0.25s cubic-bezier(0.16,1,0.3,1),
                  visibility 0s linear 0.25s;
    }
    #ce-window.open {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
      transition: opacity   0.25s cubic-bezier(0.16,1,0.3,1),
                  transform 0.25s cubic-bezier(0.16,1,0.3,1),
                  visibility 0s linear 0s;
    }

    /* ── Header ── */
    .ce-header {
      display: flex; align-items: center; gap: 11px;
      padding: 13px 15px;
      background: ${primaryColor};
      color: #fff;
      flex-shrink: 0;
      user-select: none;
    }
    .ce-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(255,255,255,0.22);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; letter-spacing: -0.5px;
      flex-shrink: 0;
    }
    .ce-header-meta { flex: 1; min-width: 0; }
    .ce-header-name {
      font-size: 14px; font-weight: 600; line-height: 1.3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ce-header-status { font-size: 11px; opacity: 0.75; margin-top: 1px; }
    .ce-close-btn {
      background: rgba(255,255,255,0.16); border: none; color: #fff;
      width: 27px; height: 27px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: background 0.15s;
    }
    .ce-close-btn:hover { background: rgba(255,255,255,0.30); }

    /* ── Messages area ── */
    .ce-messages {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 16px 14px;
      display: flex; flex-direction: column; gap: 10px;
      background: ${chatAreaBg};
      ${chatBgOverride ? `background: ${chatBgOverride};` : ""}
      scroll-behavior: smooth;
    }
    .ce-messages::-webkit-scrollbar { width: 4px; }
    .ce-messages::-webkit-scrollbar-track { background: transparent; }
    .ce-messages::-webkit-scrollbar-thumb {
      background: ${scrollThumb}; border-radius: 4px;
    }

    /* ── Message wrappers ── */
    .ce-wrap {
      max-width: 86%;
      align-self: flex-start;
      display: flex; flex-direction: column; gap: 5px;
    }
    .ce-wrap.user { align-self: flex-end; }

    /* ── Bubble base ── */
    .ce-msg {
      padding: 9px 13px;
      border-radius: ${r};
      line-height: 1.57;
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* Bot bubble */
    .ce-bot {
      background: ${botMsgBg};
      color: ${botMsgColor};
      border-bottom-left-radius: ${tailRadius};
      border: 1px solid ${botBorder};
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    /* User bubble */
    .ce-user {
      background: ${primaryColor};
      color: #fff;
      border-bottom-right-radius: ${tailRadius};
    }

    /* Error bubble */
    .ce-error {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-bottom-left-radius: ${tailRadius};
    }

    /* ── Streaming text spans ── */
    .stable { /* no animation — already settled */ }
    .fresh  { animation: streamFade 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }

    /* ── Loading dots ── */
    .ce-dots { display: flex; gap: 5px; padding: 1px 0; align-items: center; }
    .ce-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: ${dotColor};
      animation: bounce 1.4s infinite ease-in-out;
    }
    .ce-dot:nth-child(2) { animation-delay: 0.2s; }
    .ce-dot:nth-child(3) { animation-delay: 0.4s; }

    /* ── Confidence badge ── */
    .ce-badge {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.01em;
      padding: 2px 9px; border-radius: 999px;
      width: fit-content;
      animation: fadeSlideUp 0.3s ease forwards;
    }
    .ce-high { color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; }
    .ce-med  { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
    .ce-low  { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }

    /* ── Source pills ── */
    .ce-sources {
      display: flex; flex-direction: column; gap: 4px;
      animation: fadeSlideUp 0.35s ease forwards;
    }
    .ce-source {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      font-size: 11px; color: ${primaryColor};
      text-decoration: none;
      background: ${sourceChipBg};
      border: 1px solid ${sourceChipBord};
      padding: 4px 9px; border-radius: ${r};
      overflow: hidden;
      transition: background 0.15s;
    }
    .ce-source:hover { background: ${sourceChipHover}; }
    .ce-source-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .ce-source-pct   { flex-shrink: 0; font-size: 10px; color: ${sourceScoreClr}; }

    /* ── Thinking (collapsible) ── */
    .ce-thinking { margin-top: 2px; }
    .ce-thinking summary {
      font-size: 11px; font-weight: 500; cursor: pointer; user-select: none;
      color: ${darkMode ? "rgba(226,232,240,0.4)" : "rgba(0,0,0,0.35)"};
      padding: 2px 4px; list-style: none;
    }
    .ce-thinking summary::-webkit-details-marker { display: none; }
    .ce-thinking summary::before {
      content: "\\25B6"; display: inline-block; margin-right: 5px;
      font-size: 8px; transition: transform 0.2s;
    }
    .ce-thinking[open] summary::before { transform: rotate(90deg); }
    .ce-thinking > div {
      font-size: 12px; line-height: 1.5; white-space: pre-wrap;
      padding: 8px 10px; margin-top: 4px; border-radius: ${r};
      border: 1px solid rgba(99,102,241,0.15);
      background: rgba(99,102,241,0.04);
      color: ${darkMode ? "rgba(226,232,240,0.6)" : "rgba(0,0,0,0.5)"};
    }

    /* ── Input form ── */
    .ce-input-wrap {
      padding: 10px 12px;
      display: flex; align-items: flex-end; gap: 8px;
      background: ${inputAreaBg};
      border-top: 1px solid ${inputAreaBorder};
      flex-shrink: 0;
    }
    .ce-input {
      flex: 1;
      background: ${inputBg};
      color: ${inputColor};
      border: 1px solid ${inputBorderColor};
      border-radius: ${r};
      padding: 9px 12px;
      font-size: 13px; font-family: inherit; line-height: 1.45;
      resize: none; outline: none;
      min-height: 38px; max-height: 110px;
      overflow-y: auto;
      transition: border-color 0.15s;
    }
    .ce-input::placeholder { color: ${placeholderColor}; }
    .ce-input:focus        { border-color: ${primaryColor}; }

    .ce-send {
      background: ${primaryColor}; color: #fff; border: none;
      width: 38px; height: 38px; border-radius: ${r};
      flex-shrink: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s, transform 0.15s;
    }
    .ce-send:hover:not(:disabled)  { opacity: 0.85; transform: scale(1.07); }
    .ce-send:active:not(:disabled) { transform: scale(0.92); }
    .ce-send:disabled { opacity: 0.40; cursor: not-allowed; transform: none; }

    /* ── Branding footer ── */
    .ce-branding {
      text-align: center;
      padding: 5px 8px;
      background: ${inputAreaBg};
      border-top: 1px solid ${darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"};
      flex-shrink: 0;
    }
    .ce-branding a {
      font-size: 10px; letter-spacing: 0.01em;
      color: ${brandingColor};
      text-decoration: none;
      transition: color 0.15s;
    }
    .ce-branding a:hover { color: ${brandingHover}; }
  `;
  shadow.appendChild(styleEl);

  /* ════════════════════════════════════════════════════════════════
     FAB BUTTON
  ════════════════════════════════════════════════════════════════ */
  const fab = document.createElement("button");
  fab.id = "ce-bubble";
  fab.setAttribute("aria-label", "Open chat");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = `
    <span class="ce-fab-icon ce-fab-chat" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <span class="ce-fab-icon ce-fab-close" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </span>`;
  shadow.appendChild(fab);

  /* ════════════════════════════════════════════════════════════════
     WIDGET WINDOW
  ════════════════════════════════════════════════════════════════ */
  const win = document.createElement("div");
  win.id = "ce-window";
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-modal", "true");
  win.setAttribute("aria-label", botName + " chat");
  shadow.appendChild(win);

  /* ── Header ── */
  const headerEl = document.createElement("div");
  headerEl.className = "ce-header";

  const avatarEl = document.createElement("div");
  avatarEl.className = "ce-avatar";
  avatarEl.setAttribute("aria-hidden", "true");
  avatarEl.textContent = botName.charAt(0).toUpperCase();

  const metaEl = document.createElement("div");
  metaEl.className = "ce-header-meta";

  const nameEl = document.createElement("div");
  nameEl.className = "ce-header-name";
  nameEl.textContent = botName;

  const statusEl = document.createElement("div");
  statusEl.className = "ce-header-status";
  statusEl.textContent = "Typically replies instantly";

  metaEl.appendChild(nameEl);
  metaEl.appendChild(statusEl);

  const closeBtnEl = document.createElement("button");
  closeBtnEl.className = "ce-close-btn";
  closeBtnEl.setAttribute("aria-label", "Close chat");
  closeBtnEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

  headerEl.appendChild(avatarEl);
  headerEl.appendChild(metaEl);
  headerEl.appendChild(closeBtnEl);
  win.appendChild(headerEl);

  /* ── Messages area ── */
  const messagesEl = document.createElement("div");
  messagesEl.className = "ce-messages";
  messagesEl.setAttribute("role", "log");
  messagesEl.setAttribute("aria-live", "polite");
  messagesEl.setAttribute("aria-label", "Chat messages");
  win.appendChild(messagesEl);

  /* ── Input form ── */
  const formEl = document.createElement("form");
  formEl.className = "ce-input-wrap";
  formEl.setAttribute("autocomplete", "off");

  const inputEl = document.createElement("textarea");
  inputEl.className = "ce-input";
  inputEl.placeholder = "Ask a question…";
  inputEl.setAttribute("rows", "1");
  inputEl.setAttribute("aria-label", "Type your message");

  const sendEl = document.createElement("button");
  sendEl.type = "submit";
  sendEl.className = "ce-send";
  sendEl.setAttribute("aria-label", "Send message");
  sendEl.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>`;

  formEl.appendChild(inputEl);
  formEl.appendChild(sendEl);
  win.appendChild(formEl);

  /* ── Branding footer ── */
  const brandingEl = document.createElement("div");
  brandingEl.className = "ce-branding";
  brandingEl.innerHTML = `<a href="https://averto.ai" target="_blank" rel="noopener noreferrer">Powered by averto</a>`;
  win.appendChild(brandingEl);

  /* ════════════════════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════════════════════ */
  let isOpen = false;
  let isStreaming = false;

  /* ════════════════════════════════════════════════════════════════
     DOM HELPERS
  ════════════════════════════════════════════════════════════════ */

  function escapeHTML(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMarkdownToHTML(text) {
    if (!text) return "";
    const safeText = escapeHTML(text);
    const lines = safeText.split("\n");
    const processedLines = lines.map(line => {
      const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
      let content = line;
      if (bulletMatch) {
        content = `<span class="ce-bullet" style="opacity: 0.7; margin-right: 6px;">&bull;</span>` + bulletMatch[3];
      }
      content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      
      if (bulletMatch) {
        return `<span style="display: inline-block; padding-left: 8px; margin: 2px 0; width: 100%;">${content}</span>`;
      }
      return content;
    });
    return processedLines.join("<br />");
  }

  function scrollToBottom() {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
  }

  /** Append a plain user message bubble. */
  function appendUserMessage(text) {
    const wrap = document.createElement("div");
    wrap.className = "ce-wrap user";
    const msg = document.createElement("div");
    msg.className = "ce-msg ce-user";
    msg.textContent = text;
    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  /** Append a static bot message (welcome, error). */
  function appendBotMessage(text, isError) {
    const wrap = document.createElement("div");
    wrap.className = "ce-wrap";
    const msg = document.createElement("div");
    msg.className = "ce-msg " + (isError ? "ce-error" : "ce-bot");
    if (isError) {
      msg.textContent = text;
    } else {
      msg.innerHTML = formatMarkdownToHTML(text);
    }
    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  /** Append a loading-dots bot bubble, returns the wrapper for removal. */
  function appendLoadingBubble() {
    const wrap = document.createElement("div");
    wrap.className = "ce-wrap";
    const msg = document.createElement("div");
    msg.className = "ce-msg ce-bot";
    msg.innerHTML = `<div class="ce-dots">
      <div class="ce-dot"></div>
      <div class="ce-dot"></div>
      <div class="ce-dot"></div>
    </div>`;
    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  /**
   * Create a streaming bot bubble.
   * Returns { wrap, pushChunk(chunk), finalize(fullText) }
   *
   * Technique: one `<span class="stable">` holds already-settled text;
   * for each incoming chunk we remove the old `fresh` span, promote its
   * text into stable, then insert a brand-new `fresh` span (DOM remount
   * is what re-triggers the CSS animation).
   */
  function createStreamingBubble() {
    const wrap = document.createElement("div");
    wrap.className = "ce-wrap";

    const msg = document.createElement("div");
    msg.className = "ce-msg ce-bot";

    const stableSpan = document.createElement("span");
    stableSpan.className = "stable";
    msg.appendChild(stableSpan);

    wrap.appendChild(msg);
    messagesEl.appendChild(wrap);
    scrollToBottom();

    let stableText = "";
    let freshSpan = null;

    function pushChunk(chunk) {
      // Promote previous fresh into stable
      if (freshSpan) {
        stableText += freshSpan.innerHTML;
        stableSpan.innerHTML = stableText;
        msg.removeChild(freshSpan);
        freshSpan = null;
      }
      // Mount new fresh span — DOM insertion re-triggers @keyframes
      freshSpan = document.createElement("span");
      freshSpan.className = "fresh";
      freshSpan.innerHTML = formatMarkdownToHTML(chunk);
      msg.appendChild(freshSpan);
      scrollToBottom();
    }

    function finalize(fullText) {
      stableSpan.innerHTML = formatMarkdownToHTML(fullText);
      if (freshSpan && msg.contains(freshSpan)) {
        msg.removeChild(freshSpan);
        freshSpan = null;
      }
      scrollToBottom();
    }

    return { wrap, pushChunk, finalize };
  }

  /** Add a confidence badge below a message wrapper. */
  function addBadge(wrap, confidence) {
    if (typeof confidence !== "number" || confidence <= 0) return;
    const badge = document.createElement("span");
    const pct = Math.round(confidence * 100);
    let cls, label;
    if (confidence >= 0.72) {
      cls = "ce-high";
      label = "High";
    } else if (confidence >= 0.45) {
      cls = "ce-med";
      label = "Medium";
    } else {
      cls = "ce-low";
      label = "Low";
    }
    badge.className = `ce-badge ${cls}`;
    badge.textContent = `${label} \u00b7 ${pct}%`;
    wrap.appendChild(badge);
  }

  /** Add collapsible thinking section ABOVE the message wrapper. */
  function addThinking(wrap, thinking) {
    if (!thinking) return;
    const details = document.createElement("details");
    details.className = "ce-thinking";
    const summary = document.createElement("summary");
    summary.textContent = "Show thinking";
    const content = document.createElement("div");
    content.textContent = thinking;
    details.appendChild(summary);
    details.appendChild(content);
    wrap.insertBefore(details, wrap.firstChild);
  }

  /** Add source pills below a message wrapper (skip upload:// urls, max 3). */
  function addSources(wrap, sources) {
    if (!Array.isArray(sources) || sources.length === 0) return;
    const normalized = sources.map(s => {
      if (typeof s === "string") return { url: s, heading: s, score: null };
      return s;
    });
    const valid = normalized
      .filter(
        (s) => s && typeof s.url === "string" && !s.url.startsWith("upload://"),
      )
      .slice(0, 3);
    if (valid.length === 0) return;
    const container = document.createElement("div");
    container.className = "ce-sources";
    for (const s of valid) {
      const a = document.createElement("a");
      a.className = "ce-source";
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = s.heading || s.title || s.url;

      const labelEl = document.createElement("span");
      labelEl.className = "ce-source-label";
      labelEl.textContent = s.heading || s.title || s.url;
      a.appendChild(labelEl);

      if (typeof s.score === "number") {
        const pctEl = document.createElement("span");
        pctEl.className = "ce-source-pct";
        pctEl.textContent = Math.round(s.score * 100) + "%";
        a.appendChild(pctEl);
      }
      container.appendChild(a);
    }
    wrap.appendChild(container);
  }

  /* ════════════════════════════════════════════════════════════════
     OPEN / CLOSE
  ════════════════════════════════════════════════════════════════ */

  function openWidget() {
    isOpen = true;
    win.classList.add("open");
    fab.classList.add("is-open");
    fab.setAttribute("aria-label", "Close chat");
    fab.setAttribute("aria-expanded", "true");
    setTimeout(() => inputEl.focus(), 270);
  }

  function closeWidget() {
    isOpen = false;
    win.classList.remove("open");
    fab.classList.remove("is-open");
    fab.setAttribute("aria-label", "Open chat");
    fab.setAttribute("aria-expanded", "false");
  }

  fab.addEventListener("click", () => (isOpen ? closeWidget() : openWidget()));
  closeBtnEl.addEventListener("click", closeWidget);

  // Escape key closes the widget
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeWidget();
  });

  /* ════════════════════════════════════════════════════════════════
     INPUT AUTO-RESIZE + KEYBOARD SUBMIT
  ════════════════════════════════════════════════════════════════ */

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true }),
      );
    }
  });

  /* ════════════════════════════════════════════════════════════════
     SSE STREAMING SEND
  ════════════════════════════════════════════════════════════════ */

  async function sendMessage(text) {
    if (isStreaming) return;
    isStreaming = true;
    sendEl.disabled = true;

    appendUserMessage(text);
    const loadingBubble = appendLoadingBubble();

    let streamBubble = null;
    let currentContent = "";
    let currentThinking = "";

    try {
      /* ── Network request ── */
      let res;
      try {
        res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            sessionId,
            apiKey,
            stream: true,
          }),
        });
      } catch {
        loadingBubble.remove();
        appendBotMessage(
          "Sorry, I\u2019m having trouble connecting. Please check your network and try again.",
          true,
        );
        return;
      }

      /* ── HTTP error ── */
      if (!res.ok) {
        loadingBubble.remove();
        let errMsg = "Request failed (" + res.status + ").";
        try {
          const errData = await res.json();
          errMsg = errData.error || errData.message || errMsg;
        } catch {
          /* ignore parse error */
        }
        appendBotMessage(errMsg, true);
        return;
      }

      /* ── No streaming support (shouldn't happen in modern browsers) ── */
      if (!res.body) {
        loadingBubble.remove();
        appendBotMessage(
          "Streaming is not supported in this environment.",
          true,
        );
        return;
      }

      /* ── Begin streaming ── */
      loadingBubble.remove();
      streamBubble = createStreamingBubble();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedDone = false;

      outer: while (true) {
        let done, value;
        try {
          ({ done, value } = await reader.read());
        } catch {
          // Stream read error — finalize with whatever we have
          break;
        }
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          // Each event may have multiple lines; find the data: line(s)
          const lines = event.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();

            // OpenAI-style stream terminator
            if (!raw || raw === "[DONE]") {
              receivedDone = true;
              break;
            }

            let payload;
            try {
              payload = JSON.parse(raw);
            } catch {
              continue; // skip malformed lines silently
            }

            // Chunk of text
            if (typeof payload.chunk === "string" && payload.chunk.length > 0) {
              currentContent += payload.chunk;
              streamBubble.pushChunk(payload.chunk);
            }

            // Thinking content
            if (typeof payload.thinking === "string" && payload.thinking.length > 0) {
              currentThinking = payload.thinking;
            }

            // Done signal — finalize message, attach badge + sources
            if (payload.done === true) {
              receivedDone = true;
              // Use server's full answer if we somehow missed chunks
              const finalText =
                currentContent ||
                (typeof payload.answer === "string" ? payload.answer : "");
              streamBubble.finalize(finalText);
              currentContent = finalText;

              const confidence =
                typeof payload.confidence === "number"
                  ? payload.confidence
                  : null;
              const sources = payload.sources || payload.sourceDetails || null;

              if (confidence !== null) addBadge(streamBubble.wrap, confidence);
              if (currentThinking) addThinking(streamBubble.wrap, currentThinking);
              if (sources) addSources(streamBubble.wrap, sources);
              scrollToBottom();
              break;
            }
          }
          if (receivedDone) break outer;
        }
      }

      // Stream ended without an explicit done signal — finalize gracefully
      if (!receivedDone && streamBubble) {
        streamBubble.finalize(currentContent);
      }

      // Guard against empty response
      if (!currentContent && streamBubble) {
        streamBubble.wrap.remove();
        streamBubble = null;
        appendBotMessage("Received an empty response. Please try again.", true);
      }
    } catch (unexpectedErr) {
      // Catch-all safety net
      if (loadingBubble.parentNode) loadingBubble.remove();
      if (streamBubble && streamBubble.wrap.parentNode)
        streamBubble.wrap.remove();
      appendBotMessage("An unexpected error occurred. Please try again.", true);
    } finally {
      isStreaming = false;
      sendEl.disabled = false;
      inputEl.focus();
    }
  }

  /* ════════════════════════════════════════════════════════════════
     FORM SUBMIT
  ════════════════════════════════════════════════════════════════ */
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;
    inputEl.value = "";
    inputEl.style.height = "";
    await sendMessage(text);
  });

  /* ════════════════════════════════════════════════════════════════
     INITIALISE — render welcome message
  ════════════════════════════════════════════════════════════════ */
  appendBotMessage(welcomeMsg, false);
})();

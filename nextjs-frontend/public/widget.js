(function() {
    const script = document.currentScript;
    const apiKey = script.getAttribute('data-api-key');
    const primaryColor = script.getAttribute('data-primary-color') || '#18181b';
    const botName = script.getAttribute('data-bot-name') || 'Chat Assistant';
    const welcomeMessage = script.getAttribute('data-welcome-message') || 'Hi! How can I help you today?';
    const apiUrl = script.getAttribute('data-api-url') || 'http://localhost:4000/api/chat';

    let isOpen = false;
    let messages = [{ role: 'assistant', content: welcomeMessage }];
    let sessionId = localStorage.getItem('ce_session_id') || Math.random().toString(36).substring(7);
    localStorage.setItem('ce_session_id', sessionId);

    const container = document.createElement('div');
    container.id = 'chatembed-widget-container';
    document.body.appendChild(container);
    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        #widget-bubble {
            position: fixed; bottom: 24px; right: 24px;
            width: 56px; height: 56px; border-radius: 16px;
            background: ${primaryColor}; color: white;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            z-index: 999999; border: none;
        }
        #widget-bubble:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.22); }

        #widget-window {
            position: fixed; bottom: 92px; right: 24px;
            width: 380px; height: 560px; max-height: calc(100vh - 120px);
            background: #ffffff; border-radius: 16px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.12);
            display: none; flex-direction: column;
            overflow: hidden; z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            border: 1px solid rgba(0,0,0,0.06);
        }
        #widget-window.open { display: flex; animation: slideUp 0.25s ease-out; }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .header {
            background: ${primaryColor}; color: white;
            padding: 16px 18px; display: flex; align-items: center; gap: 12px;
        }
        .header-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; font-weight: 600;
        }
        .header-title { font-size: 14px; font-weight: 600; line-height: 1.3; }
        .header-sub { font-size: 11px; opacity: 0.75; margin-top: 1px; }

        .chat-area {
            flex: 1; overflow-y: auto; padding: 16px;
            background: #fafafa; display: flex; flex-direction: column; gap: 10px;
        }
        .message {
            max-width: 85%; line-height: 1.5; font-size: 13px;
            padding: 10px 14px; border-radius: 14px;
        }
        .msg-user {
            background: ${primaryColor}; color: white;
            align-self: flex-end; border-bottom-right-radius: 4px;
        }
        .msg-bot {
            background: white; color: #27272a;
            align-self: flex-start; border-bottom-left-radius: 4px;
            border: 1px solid #e4e4e7; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .msg-wrap { max-width: 85%; align-self: flex-start; display: flex; flex-direction: column; gap: 6px; }
        .msg-wrap.user { align-self: flex-end; }
        .confidence-badge {
            font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
            display: inline-flex; align-items: center; gap: 4px; width: fit-content;
        }
        .conf-high { color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; }
        .conf-med { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
        .conf-low { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }
        .sources { display: flex; flex-direction: column; gap: 4px; }
        .source-link {
            font-size: 11px; color: #2563eb; text-decoration: none;
            background: #eff6ff; padding: 4px 8px; border-radius: 6px;
            display: flex; justify-content: space-between; gap: 8px;
        }
        .source-link:hover { background: #dbeafe; }
        .source-score { color: #a1a1aa; font-size: 10px; }

        .input-area {
            padding: 12px; border-top: 1px solid #e4e4e7;
            display: flex; gap: 8px; background: white;
        }
        input {
            flex: 1; border: 1px solid #e4e4e7; padding: 10px 14px;
            border-radius: 10px; outline: none; font-size: 13px;
            background: #fafafa; color: #18181b;
        }
        input:focus { border-color: #a1a1aa; background: white; }
        button[type="submit"] {
            background: ${primaryColor}; color: white; border: none;
            padding: 10px 16px; border-radius: 10px; cursor: pointer;
            font-size: 13px; font-weight: 600;
        }
        button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }

        .loading-dots { display: flex; gap: 4px; padding: 2px; }
        .dot {
            width: 5px; height: 5px; background: #a1a1aa;
            border-radius: 50%; animation: bounce 1.4s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
    `;
    shadow.appendChild(style);

    const bubble = document.createElement('button');
    bubble.id = 'widget-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

    const win = document.createElement('div');
    win.id = 'widget-window';
    win.innerHTML = `
        <div class="header">
            <div class="header-avatar">${botName.charAt(0).toUpperCase()}</div>
            <div>
                <div class="header-title">${botName}</div>
                <div class="header-sub">Typically replies instantly</div>
            </div>
        </div>
        <div class="chat-area" id="chat-messages"></div>
        <form class="input-area" id="chat-form">
            <input type="text" id="chat-input" placeholder="Ask a question…" autocomplete="off">
            <button type="submit">Send</button>
        </form>
    `;

    shadow.appendChild(bubble);
    shadow.appendChild(win);

    function confClass(score) {
        if (score >= 0.72) return 'conf-high';
        if (score >= 0.45) return 'conf-med';
        return 'conf-low';
    }

    function confLabel(score) {
        if (score >= 0.72) return 'High';
        if (score >= 0.45) return 'Medium';
        return 'Low';
    }

    function renderMessages() {
        const area = shadow.getElementById('chat-messages');
        area.innerHTML = messages.map(m => {
            if (m.role === 'user') {
                return `<div class="msg-wrap user"><div class="message msg-user">${m.content}</div></div>`;
            }
            let html = `<div class="msg-wrap"><div class="message msg-bot">${m.content}</div>`;
            if (m.confidence > 0) {
                html += `<span class="confidence-badge ${confClass(m.confidence)}">${confLabel(m.confidence)} · ${Math.round(m.confidence * 100)}%</span>`;
            }
            if (m.sourceDetails && m.sourceDetails.length > 0) {
                html += '<div class="sources">';
                m.sourceDetails.slice(0, 3).forEach(s => {
                    const label = s.heading || s.url.replace('upload://', '');
                    const href = s.url.startsWith('upload://') ? '#' : s.url;
                    html += `<a class="source-link" href="${href}" target="_blank" rel="noopener"><span>${label}</span><span class="source-score">${Math.round((s.score || 0) * 100)}%</span></a>`;
                });
                html += '</div>';
            }
            html += '</div>';
            return html;
        }).join('');
        area.scrollTop = area.scrollHeight;
    }

    bubble.onclick = () => {
        isOpen = !isOpen;
        win.classList.toggle('open', isOpen);
        if (isOpen) renderMessages();
    };

    const form = shadow.getElementById('chat-form');
    const input = shadow.getElementById('chat-input');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        submitBtn.disabled = true;
        messages.push({ role: 'user', content: text });
        renderMessages();

        const area = shadow.getElementById('chat-messages');
        const loading = document.createElement('div');
        loading.className = 'message msg-bot';
        loading.innerHTML = '<div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
        area.appendChild(loading);
        area.scrollTop = area.scrollHeight;

        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, sessionId, apiKey }),
            });
            const data = await res.json();
            area.removeChild(loading);
            if (!res.ok) {
                messages.push({ role: 'assistant', content: data.error || "Sorry, I couldn't process that." });
            } else {
                messages.push({
                    role: 'assistant',
                    content: data.answer || "Sorry, I couldn't process that.",
                    confidence: data.confidence || 0,
                    sourceDetails: data.sourceDetails || [],
                });
            }
            renderMessages();
        } catch {
            area.removeChild(loading);
            messages.push({ role: 'assistant', content: "Sorry, I'm having trouble connecting." });
            renderMessages();
        } finally {
            submitBtn.disabled = false;
        }
    };
})();

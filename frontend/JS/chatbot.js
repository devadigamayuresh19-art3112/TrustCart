(() => {
    "use strict";

    if (window.__trustCartChatbotInitialized) return;
    window.__trustCartChatbotInitialized = true;

    const launcher = document.createElement("button");
    launcher.id = "tc-ai-launcher";
    launcher.type = "button";
    launcher.setAttribute("aria-label", "Open TrustCart AI chat");
    launcher.setAttribute("aria-expanded", "false");
    launcher.title = "Ask TrustCart AI";
    launcher.innerHTML = '<span class="tc-ai-logo">T</span><span class="tc-ai-spark">✦</span>';

    const panel = document.createElement("section");
    panel.id = "tc-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "TrustCart AI assistant");
    panel.setAttribute("aria-modal", "false");
    panel.innerHTML = `
        <header class="tc-ai-header">
            <div class="tc-ai-header-icon">✦</div>
            <div class="tc-ai-heading">
                <strong>TrustCart AI</strong>
                <span>Shopping help, powered by Gemini</span>
            </div>
            <button id="tc-ai-close" type="button" aria-label="Close chat">×</button>
        </header>
        <div class="tc-ai-messages" id="tc-ai-messages" aria-live="polite">
            <div class="tc-ai-message bot">Hey! 👋 I'm TrustCart AI. Ask me about product comparisons, trust scores, reviews, or smarter shopping.</div>
        </div>
        <div class="tc-ai-suggestions">
            <button type="button" class="tc-ai-suggestion" data-question="Explain this product's trust score.">Explain trust score</button>
            <button type="button" class="tc-ai-suggestion" data-question="What should I check before buying this product?">Buying tips</button>
        </div>
        <form class="tc-ai-form" id="tc-ai-form">
            <textarea id="tc-ai-input" rows="1" maxlength="1500" placeholder="Ask TrustCart AI..." aria-label="Your message"></textarea>
            <button id="tc-ai-send" type="submit" aria-label="Send message">➤</button>
        </form>
        <div class="tc-ai-footer">AI can make mistakes. Verify important product details.</div>
    `;

    document.body.append(launcher, panel);

    const messages = panel.querySelector("#tc-ai-messages");
    const form = panel.querySelector("#tc-ai-form");
    const input = panel.querySelector("#tc-ai-input");
    const sendButton = panel.querySelector("#tc-ai-send");
    const closeButton = panel.querySelector("#tc-ai-close");
    const suggestions = panel.querySelector(".tc-ai-suggestions");

    // Only recent turns are sent to the server.
    const history = [];
    let busy = false;

    function setOpen(open) {
        panel.classList.toggle("tc-ai-open", open);
        launcher.setAttribute("aria-expanded", String(open));
        launcher.setAttribute("aria-label", open ? "Close TrustCart AI chat" : "Open TrustCart AI chat");
        if (open) input.focus();
    }

    launcher.addEventListener("click", () => {
        setOpen(!panel.classList.contains("tc-ai-open"));
    });

    closeButton.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && panel.classList.contains("tc-ai-open")) {
            setOpen(false);
            launcher.focus();
        }
    });

    function addMessage(text, role, extraClass = "") {
        const bubble = document.createElement("div");
        bubble.className = `tc-ai-message ${role} ${extraClass}`.trim();
        // Use textContent to prevent model/user text from injecting HTML.
        bubble.textContent = text;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    function getContext() {
        try {
            if (typeof window.getTrustCartChatContext === "function") {
                const context = window.getTrustCartChatContext();
                if (context && typeof context === "object") return context;
            }
        } catch (_) {
            // Fall back to a minimal context if the page has no product state.
        }

        return { application: "TrustCart", view: "Product Results" };
    }

    async function sendMessage(rawText) {
        const message = String(rawText || "").trim();
        if (!message || busy) return;

        addMessage(message, "user");
        input.value = "";
        input.style.height = "auto";
        suggestions.hidden = true;

        const pending = addMessage("Thinking…", "bot");
        busy = true;
        sendButton.disabled = true;
        input.disabled = true;

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    history: history.slice(-8),
                    context: getContext()
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || `Chat request failed (${response.status}).`);
            }

            const answer = String(data.reply || "").trim();
            if (!answer) throw new Error("The AI returned an empty response. Please try again.");

            pending.textContent = answer;
            history.push({ role: "user", text: message });
            history.push({ role: "model", text: answer });

            // Bound client-side memory.
            if (history.length > 12) history.splice(0, history.length - 12);
        } catch (error) {
            pending.classList.add("error");
            pending.textContent = error.message ||
                "Sorry, I couldn't connect right now. Please try again.";
        } finally {
            busy = false;
            sendButton.disabled = false;
            input.disabled = false;
            input.focus();
            messages.scrollTop = messages.scrollHeight;
        }
    }

    form.addEventListener("submit", event => {
        event.preventDefault();
        sendMessage(input.value);
    });

    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    suggestions.addEventListener("click", event => {
        const button = event.target.closest("[data-question]");
        if (button) sendMessage(button.dataset.question);
    });
})();

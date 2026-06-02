(function () {
  "use strict";

  if (document.getElementById("blog-ai-root")) return;

  var API_CHAT = "/api/chat";
  var LIMIT_MSG = "今日提问次数用完啦，明天再来问我吧～";
  var ERROR_MSG = "小精灵暂时走神了，请稍后再试～";
  var NOT_CONFIGURED_MSG =
    "小精灵还在沉睡中～站长配置 DeepSeek API Key 后就能聊天啦";

  var state = {
    open: false,
    sending: false,
    chatEnabled: true,
    limit: 10,
    used: 0,
    remaining: 10,
    isLogin: false,
  };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function getPageContext() {
    return {
      pageUrl: location.href,
      pageTitle: (document.title || "").trim(),
      pagePath: location.pathname || "/",
    };
  }

  function updatePageHint(hintEl) {
    if (!hintEl) return;
    var ctx = getPageContext();
    var short =
      ctx.pageTitle.length > 36
        ? ctx.pageTitle.slice(0, 36) + "…"
        : ctx.pageTitle;
    hintEl.textContent = "当前页面：" + (short || ctx.pagePath);
    hintEl.title = ctx.pageUrl;
  }

  function mount() {
    var root = el("div");
    root.id = "blog-ai-root";

    var toggle = el("button", null, "✦ 问问博客");
    toggle.id = "blog-ai-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "blog-ai-panel");

    var panel = el("div");
    panel.id = "blog-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "博客小精灵");

    var header = el("div");
    header.id = "blog-ai-header";
    header.appendChild(el("h2", null, "✦ 博客小精灵"));
    header.appendChild(el("p", null, "可以问我当前页面相关问题"));
    var pageHint = el("p");
    pageHint.id = "blog-ai-page-hint";
    pageHint.className = "blog-ai-page-hint";
    header.appendChild(pageHint);
    var quota = el("span");
    quota.id = "blog-ai-quota";
    quota.textContent = "今日剩余：—/—";
    header.appendChild(quota);
    updatePageHint(pageHint);

    var messages = el("div");
    messages.id = "blog-ai-messages";
    appendMsg(messages, "bot", "你好呀～我是博客小精灵。我会根据你正在看的页面来回答～");

    var form = el("form");
    form.id = "blog-ai-form";
    var input = document.createElement("textarea");
    input.id = "blog-ai-input";
    input.rows = 1;
    input.placeholder = "输入你的问题…";
    input.setAttribute("maxlength", "500");
    var send = el("button", null, "发送");
    send.id = "blog-ai-send";
    send.type = "submit";
    form.appendChild(input);
    form.appendChild(send);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    toggle.addEventListener("click", function () {
      setOpen(!state.open);
      if (state.open) {
        updatePageHint(pageHint);
        refreshQuota();
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(messages, input, send);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    window.addEventListener("popstate", function () {
      if (state.open) updatePageHint(pageHint);
    });
  }

  function setOpen(open) {
    state.open = open;
    var toggle = document.getElementById("blog-ai-toggle");
    var panel = document.getElementById("blog-ai-panel");
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("is-open", open);
  }

  function updateQuotaLabel(quotaEl) {
    if (!quotaEl) return;
    quotaEl.textContent =
      "今日剩余：" + state.remaining + "/" + state.limit;
  }

  function appendMsg(container, role, text) {
    container.appendChild(el("div", "bai-msg " + role, text));
    container.scrollTop = container.scrollHeight;
    return container.lastElementChild;
  }

  function refreshQuota() {
    var quotaEl = document.getElementById("blog-ai-quota");
    fetch(API_CHAT, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (res) {
        if (res.ok && res.data) {
          state.limit = res.data.limit ?? state.limit;
          state.used = res.data.used ?? state.used;
          state.remaining = res.data.remaining ?? state.remaining;
          state.isLogin = !!res.data.isLogin;
          if (res.data.chatEnabled === false) state.chatEnabled = false;
        }
        updateQuotaLabel(quotaEl);
      })
      .catch(function () {
        updateQuotaLabel(quotaEl);
      });
  }

  function sendMessage(messages, input, sendBtn) {
    if (state.sending) return;
    var text = (input.value || "").trim();
    if (!text) return;
    if (!state.chatEnabled) {
      appendMsg(messages, "system", NOT_CONFIGURED_MSG);
      return;
    }
    if (state.remaining <= 0) {
      appendMsg(messages, "system", LIMIT_MSG);
      return;
    }

    var ctx = getPageContext();
    state.sending = true;
    sendBtn.disabled = true;
    input.disabled = true;
    appendMsg(messages, "user", text);
    input.value = "";
    var thinking = appendMsg(messages, "bot", "思考中...");

    fetch(API_CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        message: text,
        pageUrl: ctx.pageUrl,
        pageTitle: ctx.pageTitle,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { status: r.status, data: d };
        });
      })
      .then(function (res) {
        thinking.remove();
        var d = res.data || {};

        if (d.limit != null) state.limit = d.limit;
        if (d.used != null) state.used = d.used;
        if (d.remaining != null) state.remaining = d.remaining;
        if (d.isLogin != null) state.isLogin = d.isLogin;
        if (d.chatEnabled === false) state.chatEnabled = false;
        updateQuotaLabel(document.getElementById("blog-ai-quota"));

        if (d.error === "CHAT_NOT_CONFIGURED" || d.chatEnabled === false) {
          appendMsg(messages, "system", d.message || NOT_CONFIGURED_MSG);
          return;
        }
        if (res.status === 429 || d.error === "DAILY_LIMIT_EXCEEDED") {
          state.remaining = 0;
          appendMsg(messages, "system", d.message || LIMIT_MSG);
          return;
        }
        if (res.status >= 400 || d.error) {
          appendMsg(messages, "system", d.message || ERROR_MSG);
          return;
        }
        appendMsg(messages, "bot", d.reply || "（没有收到回复）");
      })
      .catch(function () {
        thinking.remove();
        appendMsg(messages, "system", ERROR_MSG);
      })
      .finally(function () {
        state.sending = false;
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();

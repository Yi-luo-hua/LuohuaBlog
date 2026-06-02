(function () {
  "use strict";

  if (document.getElementById("blog-ai-root")) return;

  var API_CHAT = "/api/chat";
  var API_AUTH = "/api/auth";
  var OWNER_EMAIL = "173236231@qq.com";
  var LIMIT_MSG = "今日提问次数用完啦，明天再来问我吧～";
  var ERROR_MSG = "小精灵暂时走神了，请稍后再试～";
  var NOT_CONFIGURED_MSG =
    "小精灵还在沉睡中～站长配置 DeepSeek API Key 后就能聊天啦";

  var state = {
    open: false,
    authMode: "login",
    authModalOpen: false,
    sending: false,
    chatEnabled: true,
    limit: 10,
    used: 0,
    remaining: 10,
    isLogin: false,
    unlimited: false,
    user: null,
    challengeToken: "",
    securityQuestion: "",
  };

  var ui = {};

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function authFetch(path, options) {
    return fetch(API_AUTH + path, Object.assign(
      { credentials: "include", headers: { Accept: "application/json" } },
      options || {}
    )).then(function (r) {
      return r.json().then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    });
  }

  function getPageContext() {
    return {
      pageUrl: location.href,
      pageTitle: (document.title || "").trim(),
      pagePath: location.pathname || "/",
    };
  }

  function updatePageHint() {
    if (!ui.pageHint) return;
    var ctx = getPageContext();
    var short =
      ctx.pageTitle.length > 36
        ? ctx.pageTitle.slice(0, 36) + "…"
        : ctx.pageTitle;
    ui.pageHint.textContent = "当前页面：" + (short || ctx.pagePath);
    ui.pageHint.title = ctx.pageUrl;
  }

  function updateAuthBar() {
    if (!ui.authBar) return;
    ui.authBar.innerHTML = "";
    if (state.user) {
      var who = el("span", "blog-ai-auth-user", state.user.email || "已登录");
      var out = el("button", "blog-ai-auth-link", "退出");
      out.type = "button";
      out.addEventListener("click", onLogout);
      ui.authBar.appendChild(who);
      ui.authBar.appendChild(out);
      return;
    }
    var login = el("button", "blog-ai-auth-link", "登录 / 注册");
    login.type = "button";
    login.addEventListener("click", function () {
      openAuthModal("login");
    });
    ui.authBar.appendChild(login);
  }

  function ensureAuthModal() {
    if (ui.authOverlay) return;

    ui.authOverlay = el("div");
    ui.authOverlay.id = "acct-auth-overlay";
    ui.authOverlay.className = "acct-auth-overlay";
    ui.authOverlay.setAttribute("aria-hidden", "true");
    ui.authOverlay.addEventListener("click", function (e) {
      if (e.target === ui.authOverlay) closeAuthModal();
    });

    ui.authModal = el("div");
    ui.authModal.className = "acct-auth-modal";
    ui.authModal.setAttribute("role", "dialog");
    ui.authModal.setAttribute("aria-modal", "true");
    ui.authModal.setAttribute("aria-labelledby", "acct-auth-title");
    ui.authModal.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    var closeBtn = el("button", "acct-auth-close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.addEventListener("click", closeAuthModal);

    var brand = el("div", "acct-auth-brand");
    var avatar = el("div", "acct-auth-avatar", "账");
    brand.appendChild(avatar);
    ui.authTitle = el("h2", "acct-auth-title");
    ui.authTitle.id = "acct-auth-title";
    brand.appendChild(ui.authTitle);
    ui.authSubtitle = el("p", "acct-auth-subtitle");
    brand.appendChild(ui.authSubtitle);

    ui.authTabs = el("div", "acct-auth-tabs");
    ui.authModalBody = el("div", "acct-auth-body");

    ui.authModal.appendChild(closeBtn);
    ui.authModal.appendChild(brand);
    ui.authModal.appendChild(ui.authTabs);
    ui.authModal.appendChild(ui.authModalBody);
    ui.authOverlay.appendChild(ui.authModal);
    document.body.appendChild(ui.authOverlay);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.authModalOpen) closeAuthModal();
    });
  }

  function openAuthModal(mode) {
    ensureAuthModal();
    state.authMode = mode || "login";
    state.authModalOpen = true;
    ui.authOverlay.classList.add("is-visible");
    ui.authOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("acct-auth-open");
    renderAuthModalContent();
  }

  function closeAuthModal() {
    if (!ui.authOverlay) return;
    state.authModalOpen = false;
    ui.authOverlay.classList.remove("is-visible");
    ui.authOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("acct-auth-open");
  }

  function setAuthError(msg) {
    if (!ui.authError) return;
    ui.authError.textContent = msg || "";
    ui.authError.hidden = !msg;
  }

  function renderAuthTabs() {
    if (!ui.authTabs) return;
    ui.authTabs.innerHTML = "";
    if (state.authMode === "security") {
      ui.authTabs.hidden = true;
      return;
    }
    ui.authTabs.hidden = false;

    var loginTab = el("button", "acct-auth-tab", "登录");
    loginTab.type = "button";
    var regTab = el("button", "acct-auth-tab", "注册");
    regTab.type = "button";

    if (state.authMode === "login") loginTab.classList.add("is-active");
    else regTab.classList.add("is-active");

    loginTab.addEventListener("click", function () {
      state.authMode = "login";
      renderAuthModalContent();
    });
    regTab.addEventListener("click", function () {
      state.authMode = "register";
      renderAuthModalContent();
    });

    ui.authTabs.appendChild(loginTab);
    ui.authTabs.appendChild(regTab);
  }

  function renderAuthModalContent() {
    if (!ui.authModalBody) return;
    ui.authModalBody.innerHTML = "";
    setAuthError("");
    renderAuthTabs();

    if (state.authMode === "security") {
      ui.authTitle.textContent = "安全验证";
      ui.authSubtitle.textContent = "站长账号需完成验证后启用无限 AI 额度";
      ui.authModalBody.appendChild(
        el("label", "acct-auth-label", state.securityQuestion || "你现在的学号")
      );
      var ans = document.createElement("input");
      ans.type = "text";
      ans.className = "acct-auth-input";
      ans.id = "blog-ai-auth-answer";
      ans.placeholder = "请输入答案";
      ans.autocomplete = "off";
      ui.authModalBody.appendChild(ans);
      ui.authError = el("p", "acct-auth-error");
      ui.authError.hidden = true;
      ui.authModalBody.appendChild(ui.authError);
      var btnOk = el("button", "acct-auth-primary", "确认验证");
      btnOk.type = "button";
      btnOk.addEventListener("click", onVerifySecurity);
      ui.authModalBody.appendChild(btnOk);
      var back = el("button", "acct-auth-text-btn", "返回重新登录");
      back.type = "button";
      back.addEventListener("click", function () {
        openAuthModal("login");
      });
      ui.authModalBody.appendChild(back);
      ans.focus();
      return;
    }

    var isLogin = state.authMode === "login";
    ui.authTitle.textContent = isLogin ? "账号登录" : "注册账号";
    ui.authSubtitle.textContent = isLogin
      ? "登录后每日可提问 50 次（游客 10 次）"
      : "注册成功将自动登录，无需邮箱验证";

    ui.authModalBody.appendChild(el("label", "acct-auth-label", "邮箱"));
    var email = document.createElement("input");
    email.type = "email";
    email.className = "acct-auth-input";
    email.id = "blog-ai-auth-email";
    email.placeholder = "请输入邮箱";
    email.autocomplete = "username";
    ui.authModalBody.appendChild(email);

    if (!isLogin) {
      ui.authModalBody.appendChild(
        el("p", "acct-auth-hint", OWNER_EMAIL + " 为站长专用邮箱，不可注册")
      );
    }

    ui.authModalBody.appendChild(el("label", "acct-auth-label", "密码"));
    var pw = document.createElement("input");
    pw.type = "password";
    pw.className = "acct-auth-input";
    pw.id = "blog-ai-auth-password";
    pw.placeholder = "至少 8 位字符";
    pw.minLength = 8;
    pw.autocomplete = isLogin ? "current-password" : "new-password";
    ui.authModalBody.appendChild(pw);

    ui.authError = el("p", "acct-auth-error");
    ui.authError.hidden = true;
    ui.authModalBody.appendChild(ui.authError);

    var submit = el("button", "acct-auth-primary", isLogin ? "登 录" : "注册并登录");
    submit.type = "button";
    submit.addEventListener("click", isLogin ? onLogin : onRegister);
    ui.authModalBody.appendChild(submit);

    var foot = el("p", "acct-auth-foot");
    foot.textContent = "登录用于 AI 提问额度，与博客小精灵聊天入口分离";
    ui.authModalBody.appendChild(foot);

    email.focus();
  }

  function finishAuthSuccess(message) {
    closeAuthModal();
    updateAuthBar();
    refreshQuota();
    if (message && ui.messages) appendMsg(ui.messages, "bot", message);
  }

  function refreshAuthMe() {
    return authFetch("/me", { method: "GET" }).then(function (res) {
      if (res.ok && res.data && res.data.loggedIn && res.data.user) {
        state.user = res.data.user;
        state.isLogin = true;
        state.unlimited = !!res.data.unlimited;
      } else {
        state.user = null;
        state.isLogin = false;
        state.unlimited = false;
      }
      updateAuthBar();
      updateQuotaLabel();
    });
  }

  function onRegister() {
    var email = (document.getElementById("blog-ai-auth-email") || {}).value || "";
    var password = (document.getElementById("blog-ai-auth-password") || {}).value || "";
    setAuthError("");
    authFetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password: password }),
    }).then(function (res) {
      if (!res.ok) {
        setAuthError((res.data && res.data.message) || "注册失败");
        return;
      }
      state.user = res.data.user;
      state.isLogin = true;
      state.unlimited = false;
      finishAuthSuccess("注册成功～现在每天可以问我 50 次啦！");
    });
  }

  function onLogin() {
    var email = (document.getElementById("blog-ai-auth-email") || {}).value || "";
    var password = (document.getElementById("blog-ai-auth-password") || {}).value || "";
    setAuthError("");
    authFetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password: password }),
    }).then(function (res) {
      if (!res.ok) {
        setAuthError((res.data && res.data.message) || "登录失败");
        return;
      }
      if (res.data.needsSecurityQuestion) {
        state.challengeToken = res.data.challengeToken || "";
        state.securityQuestion = res.data.securityQuestion || "你现在的学号";
        state.user = res.data.user;
        state.authMode = "security";
        renderAuthModalContent();
        return;
      }
      state.user = res.data.user;
      state.isLogin = true;
      state.unlimited = !!res.data.unlimited;
      finishAuthSuccess("登录成功～");
    });
  }

  function onVerifySecurity() {
    var answer = (document.getElementById("blog-ai-auth-answer") || {}).value || "";
    setAuthError("");
    authFetch("/verify-security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeToken: state.challengeToken,
        answer: answer.trim(),
      }),
    }).then(function (res) {
      if (!res.ok) {
        setAuthError((res.data && res.data.message) || "验证失败");
        return;
      }
      state.user = res.data.user;
      state.isLogin = true;
      state.unlimited = true;
      finishAuthSuccess("验证通过～站长无限额度已启用 ✦");
    });
  }

  function onLogout() {
    authFetch("/logout", { method: "POST" }).then(function () {
      state.user = null;
      state.isLogin = false;
      state.unlimited = false;
      updateAuthBar();
      refreshQuota();
      appendMsg(ui.messages, "system", "已退出登录");
    });
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
    ui.pageHint = el("p");
    ui.pageHint.id = "blog-ai-page-hint";
    ui.pageHint.className = "blog-ai-page-hint";
    header.appendChild(ui.pageHint);
    ui.quota = el("span");
    ui.quota.id = "blog-ai-quota";
    ui.quota.textContent = "今日剩余：—/—";
    header.appendChild(ui.quota);
    ui.authBar = el("div");
    ui.authBar.id = "blog-ai-auth-bar";
    ui.authBar.className = "blog-ai-auth-bar";
    header.appendChild(ui.authBar);
    updatePageHint();

    var body = el("div");
    body.id = "blog-ai-body";
    body.className = "blog-ai-body";

    ui.messages = el("div");
    ui.messages.id = "blog-ai-messages";
    appendMsg(ui.messages, "bot", "你好呀～点上方「登录 / 注册」可提升到 50 次/天～");

    body.appendChild(ui.messages);

    ui.chatForm = el("form");
    ui.chatForm.id = "blog-ai-form";
    var input = document.createElement("textarea");
    input.id = "blog-ai-input";
    input.rows = 1;
    input.placeholder = "输入你的问题…";
    input.setAttribute("maxlength", "500");
    var send = el("button", null, "发送");
    send.id = "blog-ai-send";
    send.type = "submit";
    ui.chatForm.appendChild(input);
    ui.chatForm.appendChild(send);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(ui.chatForm);
    root.appendChild(toggle);
    root.appendChild(panel);
    document.body.appendChild(root);

    toggle.addEventListener("click", function () {
      setOpen(!state.open);
      if (state.open) {
        updatePageHint();
        refreshAuthMe().then(refreshQuota);
      }
    });

    ui.chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(input, send);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ui.chatForm.requestSubmit();
      }
    });

    window.addEventListener("popstate", function () {
      if (state.open) updatePageHint();
    });

    window.addEventListener("blog-ai-open", function (e) {
      setOpen(true);
      var detail = (e && e.detail) || {};
      if (detail.openAuth === true) {
        openAuthModal(detail.mode || "login");
      }
      refreshAuthMe().then(refreshQuota);
    });

    updateAuthBar();
    refreshAuthMe();
  }

  function setOpen(open) {
    state.open = open;
    var toggle = document.getElementById("blog-ai-toggle");
    var panel = document.getElementById("blog-ai-panel");
    if (!toggle || !panel) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("is-open", open);
  }

  function updateQuotaLabel() {
    if (!ui.quota) return;
    if (state.unlimited) {
      ui.quota.textContent = "今日剩余：无限（站长）";
      return;
    }
    var suffix = state.isLogin ? "" : " · 登录后 50 次/天";
    ui.quota.textContent =
      "今日剩余：" + state.remaining + "/" + state.limit + suffix;
  }

  function appendMsg(container, role, text) {
    container.appendChild(el("div", "bai-msg " + role, text));
    container.scrollTop = container.scrollHeight;
    return container.lastElementChild;
  }

  function refreshQuota() {
    return fetch(API_CHAT, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
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
          state.unlimited = !!res.data.unlimited;
          if (res.data.chatEnabled === false) state.chatEnabled = false;
        }
        updateQuotaLabel();
      })
      .catch(function () {
        updateQuotaLabel();
      });
  }

  function sendMessage(input, sendBtn) {
    if (state.sending || state.authModalOpen) return;
    var text = (input.value || "").trim();
    if (!text) return;
    if (!state.chatEnabled) {
      appendMsg(ui.messages, "system", NOT_CONFIGURED_MSG);
      return;
    }
    if (!state.unlimited && state.remaining <= 0) {
      appendMsg(ui.messages, "system", LIMIT_MSG);
      return;
    }

    var ctx = getPageContext();
    state.sending = true;
    sendBtn.disabled = true;
    input.disabled = true;
    appendMsg(ui.messages, "user", text);
    input.value = "";
    var thinking = appendMsg(ui.messages, "bot", "思考中...");

    fetch(API_CHAT, {
      method: "POST",
      credentials: "include",
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
        if (d.unlimited != null) state.unlimited = d.unlimited;
        if (d.chatEnabled === false) state.chatEnabled = false;
        updateQuotaLabel();

        if (d.error === "CHAT_NOT_CONFIGURED" || d.chatEnabled === false) {
          appendMsg(ui.messages, "system", d.message || NOT_CONFIGURED_MSG);
          return;
        }
        if (res.status === 429 || d.error === "DAILY_LIMIT_EXCEEDED") {
          state.remaining = 0;
          appendMsg(ui.messages, "system", d.message || LIMIT_MSG);
          return;
        }
        if (res.status >= 400 || d.error) {
          appendMsg(ui.messages, "system", d.message || ERROR_MSG);
          return;
        }
        appendMsg(ui.messages, "bot", d.reply || "（没有收到回复）");
      })
      .catch(function () {
        thinking.remove();
        appendMsg(ui.messages, "system", ERROR_MSG);
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

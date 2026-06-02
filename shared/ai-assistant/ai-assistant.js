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
    view: "chat",
    authMode: "login",
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
      showView("auth", "login");
    });
    ui.authBar.appendChild(login);
  }

  function showView(view, authMode) {
    state.view = view;
    if (authMode) state.authMode = authMode;
    var isAuth = view === "auth";
    if (ui.messages) ui.messages.hidden = isAuth;
    if (ui.chatForm) ui.chatForm.hidden = isAuth;
    if (ui.authPanel) ui.authPanel.hidden = !isAuth;
    if (isAuth) renderAuthForm();
    updateAuthBar();
  }

  function setAuthError(msg) {
    if (!ui.authError) return;
    ui.authError.textContent = msg || "";
    ui.authError.hidden = !msg;
  }

  function renderAuthForm() {
    if (!ui.authPanel) return;
    ui.authPanel.innerHTML = "";
    setAuthError("");

    if (state.authMode === "security") {
      ui.authPanel.appendChild(el("h3", "blog-ai-auth-title", "二次验证"));
      ui.authPanel.appendChild(
        el("p", "blog-ai-auth-desc", "站长账号需回答问题后启用无限 AI 额度")
      );
      ui.authPanel.appendChild(
        el("label", "blog-ai-auth-label", state.securityQuestion || "你现在的学号")
      );
      var ans = document.createElement("input");
      ans.type = "text";
      ans.className = "blog-ai-auth-input";
      ans.placeholder = "请输入学号";
      ans.autocomplete = "off";
      ans.id = "blog-ai-auth-answer";
      ui.authPanel.appendChild(ans);
      var btnOk = el("button", "blog-ai-auth-submit", "确认");
      btnOk.type = "button";
      btnOk.addEventListener("click", onVerifySecurity);
      ui.authPanel.appendChild(btnOk);
      var back = el("button", "blog-ai-auth-back", "返回登录");
      back.type = "button";
      back.addEventListener("click", function () {
        showView("auth", "login");
      });
      ui.authPanel.appendChild(back);
      ans.focus();
      return;
    }

    var isLogin = state.authMode === "login";
    ui.authPanel.appendChild(
      el("h3", "blog-ai-auth-title", isLogin ? "登录" : "注册")
    );
    ui.authPanel.appendChild(
      el("p", "blog-ai-auth-desc", isLogin
        ? "登录后每日 50 次提问；游客 10 次"
        : "注册成功将自动登录（无需验证邮箱）")
    );

    ui.authPanel.appendChild(el("label", "blog-ai-auth-label", "邮箱"));
    var email = document.createElement("input");
    email.type = "email";
    email.className = "blog-ai-auth-input";
    email.id = "blog-ai-auth-email";
    email.placeholder = "you@example.com";
    ui.authPanel.appendChild(email);

    if (!isLogin) {
      ui.authPanel.appendChild(
        el("p", "blog-ai-auth-note", OWNER_EMAIL + " 为站长专用，不可注册")
      );
    }

    ui.authPanel.appendChild(el("label", "blog-ai-auth-label", "密码"));
    var pw = document.createElement("input");
    pw.type = "password";
    pw.className = "blog-ai-auth-input";
    pw.id = "blog-ai-auth-password";
    pw.placeholder = "至少 8 位";
    pw.minLength = 8;
    ui.authPanel.appendChild(pw);

    ui.authError = el("p", "blog-ai-auth-error");
    ui.authError.hidden = true;
    ui.authPanel.appendChild(ui.authError);

    var submit = el("button", "blog-ai-auth-submit", isLogin ? "登录" : "注册并登录");
    submit.type = "button";
    submit.addEventListener("click", isLogin ? onLogin : onRegister);
    ui.authPanel.appendChild(submit);

    var switchBtn = el("button", "blog-ai-auth-back", isLogin ? "没有账号？注册" : "已有账号？登录");
    switchBtn.type = "button";
    switchBtn.addEventListener("click", function () {
      showView("auth", isLogin ? "register" : "login");
    });
    ui.authPanel.appendChild(switchBtn);

    email.focus();
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
      showView("chat");
      refreshQuota();
      appendMsg(ui.messages, "bot", "注册成功～现在每天可以问我 50 次啦！");
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
        showView("auth", "security");
        return;
      }
      state.user = res.data.user;
      state.isLogin = true;
      state.unlimited = !!res.data.unlimited;
      showView("chat");
      refreshQuota();
      appendMsg(ui.messages, "bot", "登录成功～");
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
      showView("chat");
      refreshQuota();
      appendMsg(ui.messages, "bot", "验证通过～站长无限额度已启用 ✦");
    });
  }

  function onLogout() {
    authFetch("/logout", { method: "POST" }).then(function () {
      state.user = null;
      state.isLogin = false;
      state.unlimited = false;
      showView("chat");
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

    ui.authPanel = el("div");
    ui.authPanel.id = "blog-ai-auth";
    ui.authPanel.className = "blog-ai-auth";
    ui.authPanel.hidden = true;

    body.appendChild(ui.messages);
    body.appendChild(ui.authPanel);

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
      if (detail.view === "auth") {
        showView("auth", detail.mode || "login");
      } else {
        showView("chat");
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
    if (state.sending || state.view !== "chat") return;
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

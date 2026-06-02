import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  authVerifySecurity,
} from "../services/authApi";

const OWNER_EMAIL = "173236231@qq.com";

const LoginPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [step, setStep] = useState("form");
  const [user, setUser] = useState(null);
  const [unlimited, setUnlimited] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authMe().then(({ ok, data }) => {
      if (ok && data.loggedIn) {
        setUser(data.user);
        setUnlimited(!!data.unlimited);
        setStep("done");
      }
    });
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? authLogin : authRegister;
      const { ok, data } = await fn(email.trim(), password);
      if (!ok) {
        setError(data.message || "操作失败");
        return;
      }
      if (data.needsSecurityQuestion) {
        setChallengeToken(data.challengeToken);
        setSecurityQuestion(data.securityQuestion || "你现在的学号");
        setStep("security");
        return;
      }
      setUser(data.user);
      setUnlimited(!!data.unlimited);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { ok, data } = await authVerifySecurity(challengeToken, answer.trim());
      if (!ok) {
        setError(data.message || "验证失败");
        return;
      }
      setUser(data.user);
      setUnlimited(true);
      setStep("done");
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    await authLogout();
    setUser(null);
    setUnlimited(false);
    setStep("form");
    setAnswer("");
    setChallengeToken("");
  };

  if (step === "done" && user) {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-4 py-24">
        <div className="w-full max-w-md rounded-2xl border-2 border-yellow-300/60 bg-[#fff8e7]/95 p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-[#2b2b2b]">已登录</h1>
          <p className="mt-3 text-sm text-[#2b2b2b]/80">{user.email}</p>
          {unlimited ? (
            <p className="mt-2 text-sm font-semibold text-pink-500">
              站长无限额度已启用 ✦
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#2b2b2b]/70">AI 小精灵每日 50 次提问</p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-xl bg-gradient-to-r from-[#ffd43b] to-[#ffb347] px-4 py-2 text-sm font-bold text-[#2b2b2b]"
            >
              返回首页
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="text-sm text-[#2b2b2b]/60 underline"
            >
              退出登录
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (step === "security") {
    return (
      <section className="flex min-h-[70vh] items-center justify-center px-4 py-24">
        <form
          onSubmit={onVerify}
          className="w-full max-w-md rounded-2xl border-2 border-sky-300/60 bg-[#fff8e7]/95 p-8 shadow-lg"
        >
          <h1 className="text-xl font-bold text-[#2b2b2b]">二次验证</h1>
          <p className="mt-2 text-sm text-[#2b2b2b]/75">
            站长账号登录需回答问题后方可使用无限 AI 额度
          </p>
          <label className="mt-6 block text-sm font-semibold text-[#2b2b2b]">
            {securityQuestion}
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="mt-2 w-full rounded-xl border border-sky-300/50 bg-white px-3 py-2 text-sm"
            placeholder="请输入学号"
            required
          />
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ffd43b] to-[#ffb347] py-2 text-sm font-bold text-[#2b2b2b] disabled:opacity-50"
          >
            {loading ? "验证中…" : "确认"}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-sm text-[#2b2b2b]/60 underline"
            onClick={() => {
              setStep("form");
              setAnswer("");
            }}
          >
            返回重新登录
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border-2 border-pink-300/50 bg-[#fff8e7]/95 p-8 shadow-lg"
      >
        <h1 className="text-xl font-bold text-[#2b2b2b]">
          {mode === "login" ? "登录" : "注册"}
        </h1>
        <p className="mt-2 text-sm text-[#2b2b2b]/70">
          登录后 AI 每日 50 次；游客 10 次
        </p>

        <div className="mt-4 flex gap-2 text-sm">
          <button
            type="button"
            className={mode === "login" ? "font-bold text-pink-500" : "text-[#2b2b2b]/60"}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <span className="text-[#2b2b2b]/30">|</span>
          <button
            type="button"
            className={mode === "register" ? "font-bold text-pink-500" : "text-[#2b2b2b]/60"}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>

        <label className="mt-6 block text-sm font-semibold text-[#2b2b2b]">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm"
          placeholder="you@example.com"
          required
        />
        {mode === "register" && (
          <p className="mt-1 text-xs text-[#2b2b2b]/55">
            {OWNER_EMAIL} 为站长专用，不可注册
          </p>
        )}

        <label className="mt-4 block text-sm font-semibold text-[#2b2b2b]">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm"
          placeholder="至少 8 位"
          minLength={8}
          required
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#ffd43b] to-[#ffb347] py-2 text-sm font-bold text-[#2b2b2b] disabled:opacity-50"
        >
          {loading ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
        </button>

        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-[#2b2b2b]/60 underline">
            返回首页
          </Link>
        </p>
      </form>
    </section>
  );
};

export default LoginPage;

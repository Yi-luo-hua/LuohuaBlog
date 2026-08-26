import { useCallback, useEffect, useState } from "react";
import { fetchOwnerGate, unlockOwnerGate } from "../services/ownerGateApi";
import {
  describeGateError,
  getAppAccessState,
  shouldShowPasswordForm,
} from "./appAccessGate";

/**
 * The whole way into the console: one password box. It wraps only the console
 * route, so the public site stays public.
 */
const OwnerPasswordGate = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshGate = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchOwnerGate();
      setUnlocked(Boolean(result.ok && result.data?.unlocked));
    } catch {
      setUnlocked(false);
      setError("连不上后端，检查 /api 是否在运行。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGate();
  }, [refreshGate]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await unlockOwnerGate(password);
      if (result.ok && result.data?.unlocked) {
        setPassword("");
        setUnlocked(true);
      } else {
        setError(describeGateError(result));
      }
    } catch {
      setError(describeGateError({ status: 0 }));
    } finally {
      setSubmitting(false);
    }
  };

  const accessState = getAppAccessState({ unlocked, isLoading });
  if (accessState === "allowed") return children;

  return (
    <main className="app-owner-gate" aria-busy={accessState === "loading"}>
      <section className="app-owner-gate-panel" aria-labelledby="app-owner-gate-title">
        <div className="app-owner-gate-mark">T</div>
        <p className="app-owner-gate-kicker">站长控制器</p>
        <h1 id="app-owner-gate-title">
          {accessState === "loading" ? "正在确认" : "输入站长密码"}
        </h1>
        <p className="app-owner-gate-copy">
          {accessState === "loading"
            ? "正在确认这台设备是否已经解锁。"
            : "密码由服务端校验，通过后这台设备会记住一段时间。"}
        </p>
        {shouldShowPasswordForm(accessState) ? (
          <form className="app-owner-gate-form" onSubmit={submit}>
            <label className="app-owner-gate-label" htmlFor="app-owner-gate-password">
              站长密码
            </label>
            <input
              id="app-owner-gate-password"
              className="app-owner-gate-input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
            {error ? <p className="app-owner-gate-warning">{error}</p> : null}
            <button
              type="submit"
              className="app-owner-gate-primary"
              disabled={submitting || !password}
            >
              {submitting ? "验证中…" : "进入控制台"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
};

export default OwnerPasswordGate;

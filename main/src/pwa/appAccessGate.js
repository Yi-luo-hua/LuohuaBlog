/**
 * The console is reachable from every host — typing the owner password is what
 * opens it, not the address you came from. The password is checked by the API,
 * so the console can only ever *look* unlocked; the endpoints behind it stay
 * shut until the session cookie is real.
 */

export function getAppAccessState({ unlocked = false, isLoading = false } = {}) {
  if (unlocked) return "allowed";
  if (isLoading) return "loading";
  return "locked";
}

export function shouldShowPasswordForm(accessState) {
  return accessState === "locked";
}

export function describeGateError({ status, data } = {}) {
  switch (data?.error) {
    case "WRONG_PASSWORD":
      return "密码不对，再试一次。";
    case "RATE_LIMITED":
      return "尝试太频繁了，等一分钟再试。";
    case "GATE_NOT_CONFIGURED":
      return "服务端还没设置 OWNER_GATE_PASSWORD，先在 .env 里配置。";
    case "GATE_PASSWORD_TOO_SHORT":
      return "OWNER_GATE_PASSWORD 设置得太短了，长度需在 6 到 200 之间。";
    default:
      break;
  }
  if (status === 0) return "连不上后端，检查 /api 是否在运行。";
  return data?.message || "解锁失败，请稍后再试。";
}

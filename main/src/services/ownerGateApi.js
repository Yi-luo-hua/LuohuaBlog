const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Whether this browser already carries an owner session. */
export async function fetchOwnerGate() {
  const res = await fetch("/api/owner/gate", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJson(res);
}

/** Trade the owner password for a session cookie. */
export async function unlockOwnerGate(password) {
  const res = await fetch("/api/owner/gate", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  });
  return parseJson(res);
}

/** Drop the owner session on this browser. */
export async function lockOwnerGate() {
  const res = await fetch("/api/owner/gate", {
    method: "DELETE",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJson(res);
}

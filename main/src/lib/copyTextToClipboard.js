export const copyTextToClipboard = async (
  value,
  { navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {},
) => {
  const text = String(value);

  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard access can be denied outside a secure context. Fall through
      // to the selection-based path so the contact buttons still work.
    }
  }

  if (!documentRef?.body || typeof documentRef.execCommand !== "function") {
    throw new Error("Clipboard access is unavailable");
  }

  const input = documentRef.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.opacity = "0";
  documentRef.body.appendChild(input);

  try {
    input.focus();
    input.select();
    if (!documentRef.execCommand("copy")) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    input.remove();
  }
};

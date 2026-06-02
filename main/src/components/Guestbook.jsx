import { useEffect, useState } from "react";
import { getGuestbook, postGuestbook } from "../services/guestbookApi";

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

const Guestbook = () => {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    const items = await getGuestbook(50);
    setEntries(items);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setNotice("");
    const row = await postGuestbook({
      name: name.trim() || "anonymous",
      content,
    });
    setEntries((prev) => [row, ...prev].slice(0, 50));
    setContent("");
    setNotice(row.offline ? "Saved locally (API offline)." : "Posted.");
    setSubmitting(false);
  };

  return (
    <section id="guestbook" className="bg-violet-300/20 pb-24 pt-12">
      <div className="container mx-auto px-3 md:px-10">
        <header className="mb-8 px-2">
          <p className="font-circular-web text-xs uppercase tracking-[0.35em] text-blue-200/80">
            Guestbook
          </p>
          <h2 className="mt-2 font-zentry text-3xl font-black uppercase text-blue-50 md:text-5xl">
            Leave a Signal
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-blue-50/80">
            English-only geek board. Text only — minimal memory, no embeds.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="mx-2 mb-10 max-w-2xl rounded-xl border border-white/15 bg-black/40 p-5 backdrop-blur-sm"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-blue-50/70">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            placeholder="anonymous"
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-50 outline-none focus:border-yellow-300"
          />
          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-blue-50/70">
            Message
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={4}
            required
            placeholder="Write something calm and precise…"
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-50 outline-none focus:border-yellow-300"
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-full bg-yellow-400 px-6 py-2 text-xs font-bold uppercase text-black disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Post"}
          </button>
          {notice && <p className="mt-3 text-xs text-yellow-200">{notice}</p>}
        </form>

        <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-white/50">Loading entries…</p>
          ) : (
            (Array.isArray(entries) ? entries : []).map((row) => (
              <article
                key={row.id}
                className="h-auto rounded-xl border border-white/10 bg-black/50 p-5 text-blue-50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-yellow-300">{row.name}</span>
                  <time className="shrink-0 text-[10px] text-white/50">
                    {formatTime(row.createdAt)}
                  </time>
                </div>
                <p className="mt-3 break-words text-sm leading-relaxed text-white/85">
                  {row.content}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default Guestbook;

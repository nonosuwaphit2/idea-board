"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Idea } from "../lib/ideas";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Something went wrong. Please try again.");
  return result;
}
function errorMessage(error: unknown) {
  return error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
    ? error.message : "Connection interrupted. Refresh the board to check whether your action completed before retrying.";
}

function IdeaCard({ idea, refresh }: { idea: Idea; refresh: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [voted, setVoted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function vote() {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setError(""); setMessage("");
    try {
      const result = await api(`/api/ideas/${idea.id}/vote`, { method: "POST" });
      setVoted(true);
      setMessage(result.duplicate ? "You’ve already voted for this idea." : "Your vote is counted. Thank you!");
      await refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { setPending(false); lock.current = false; }
  }
  return <article className="idea-card">
    <div className="idea-content">
      <h3>{idea.title}</h3>
      <p className="description">{idea.description}</p>
      <p className="author">Shared by <strong>{idea.author_nickname}</strong></p>
      <p className="feedback" role="status">{message}</p>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
    <button className="vote-button" onClick={vote} disabled={pending || voted} aria-label={`${voted ? "Voted for" : "Vote for"} ${idea.title}, ${idea.vote_count} votes`}>
      <span aria-hidden="true">{voted ? "✓" : "↑"}</span><strong>{idea.vote_count}</strong><span>{pending ? "Voting…" : voted ? "Voted" : "Vote"}</span>
    </button>
  </article>;
}

export default function IdeaBoard() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");
  const submitLock = useRef(false);
  const loadSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setLoadError("");
    try {
      const result = await api("/api/ideas");
      if (sequence === loadSequence.current) setIdeas(result.ideas);
    } catch (e) {
      if (sequence === loadSequence.current) setLoadError(errorMessage(e));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submitLock.current = true;
    setSubmitting(true); setSubmitError(""); setSuccess("");
    try {
      await api("/api/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.get("title"), description: data.get("description"), author_nickname: data.get("author_nickname") }),
      });
      form.reset(); setSuccess("Your idea has been shared!");
      await refresh();
    } catch (e) { setSubmitError(errorMessage(e)); }
    finally { setSubmitting(false); submitLock.current = false; }
  }

  return <div className="board-layout">
    <section className="ideas" aria-labelledby="ideas-title" aria-busy={loading}>
      <div className="section-heading"><h2 id="ideas-title">Community ideas</h2><span>{ideas.length} {ideas.length === 1 ? "idea" : "ideas"}</span></div>
      <div className="list-tools"><span>Latest ideas first</span><button className="text-button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
      {loading && <p role="status" className="loading">Loading ideas…</p>}
      {loadError && <div className="error-panel" role="alert"><p>{loadError}</p><button className="text-button" onClick={() => void refresh()} disabled={loading}>Try again</button></div>}
      {!loading && !loadError && ideas.length === 0 && <div className="empty-state"><span className="spark" aria-hidden="true">✧</span><h3>A blank board. Endless possibilities.</h3><p>Be the first to share an idea.</p></div>}
      <div className="idea-list">{ideas.map(idea => <IdeaCard key={idea.id} idea={idea} refresh={refresh} />)}</div>
    </section>
    <aside className="submit-panel" aria-labelledby="submit-title">
      <p className="eyebrow">ADD YOUR SPARK</p><h2 id="submit-title">Share an idea</h2><p className="form-intro">Big or small, we’d love to hear it.</p>
      <form onSubmit={submit}>
        <fieldset disabled={submitting}>
          <label htmlFor="title">Idea title</label><input id="title" name="title" required maxLength={120} placeholder="What’s your bright idea?" />
          <label htmlFor="description">Description</label><textarea id="description" name="description" required maxLength={2000} rows={5} placeholder="Tell us a little more…" /><small>Up to 2,000 characters.</small>
          <label htmlFor="author_nickname">Your nickname</label><input id="author_nickname" name="author_nickname" required maxLength={50} autoComplete="nickname" placeholder="How should we credit you?" />
          <p className="privacy-note">Your idea and nickname will be public.</p>
          <button className="submit-button" type="submit">{submitting ? "Sharing…" : "Share idea ↗"}</button>
        </fieldset>
        <p className="feedback" role="status">{success}</p>
        {submitError && <p className="error" role="alert">{submitError}</p>}
      </form>
      <p className="voting-note">One vote per idea per browser identity. No sign-up needed.</p>
    </aside>
  </div>;
}

"use client";

import { useState } from "react";
import { api } from "./api";
import { btnPrimary, btnSecondary, card, inputClass } from "./ui";

// Upload study material -> the server asks the AI for 15 questions -> saved as a draft.
export default function NewQuizForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(20);
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (file && file.size > 4 * 1024 * 1024) {
      setError("That file is bigger than 4 MB. Please use a smaller file or paste the text below.");
      return;
    }
    if (!file && text.trim().length < 200) {
      setError("Upload a PDF/DOCX file, or paste at least a few paragraphs of study text.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("duration", String(duration));
      if (file) form.append("file", file);
      else form.append("text", text);

      const { quizId } = await api("/api/admin/generate", { method: "POST", body: form });
      onCreated(quizId);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="text-xl font-bold">New quiz</h2>
      <p className="mt-1 text-sm text-slate-600">
        The AI will write 15 multiple-choice questions. You can review and edit every one before publishing.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="block text-sm font-medium" htmlFor="title">
            Quiz title
          </label>
          <input
            id="title"
            className={`${inputClass} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 3: Photosynthesis"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="duration">
            Duration (minutes)
          </label>
          <input
            id="duration"
            type="number"
            min={1}
            max={300}
            className={`${inputClass} mt-1`}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium" htmlFor="file">
          Study material (PDF or DOCX, max 4 MB)
        </label>
        <input
          id="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700"
        />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium" htmlFor="text">
          …or paste the text here (used only if no file is chosen)
        </label>
        <textarea
          id="text"
          rows={5}
          className={`${inputClass} mt-1`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy || Boolean(file)}
        />
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {busy && (
        <p className="mt-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
          Generating questions… this can take up to a minute. Please don&apos;t close this page.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Generating…" : "Generate 15 questions"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

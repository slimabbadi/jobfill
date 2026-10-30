import { useState } from 'react';
import type { SavedAnswer } from '@/lib/types';
import { id, saveAnswers } from '@/lib/store';
import { norm } from '@/lib/text';

export function AnswersPage({ answers }: { answers: SavedAnswer[] }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const q = norm(query);
  const shown = answers
    .filter((a) => !q || norm(`${a.question} ${a.answer}`).includes(q))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const save = (next: SavedAnswer[]) => saveAnswers(next);
  const edit = (answerId: string, patch: Partial<SavedAnswer>) =>
    save(answers.map((a) => (a.id === answerId ? { ...a, ...patch, updatedAt: Date.now() } : a)));
  const remove = (answerId: string) => save(answers.filter((a) => a.id !== answerId));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Saved answers</h1>
          <p className="muted">
            Answers to questions your profile doesn’t cover, like “How did you hear about us?”. When you submit an
            application, Jobfill keeps what you typed so the next form with the same question is filled for you.
          </p>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search questions and answers"
          aria-label="Search saved answers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn primary" type="button" onClick={() => setAdding(true)}>
          Add answer
        </button>
      </div>

      {adding && (
        <AnswerEditor
          onCancel={() => setAdding(false)}
          onSave={async (question, answer) => {
            await save([{ id: id(), question, answer, updatedAt: Date.now() }, ...answers]);
            setAdding(false);
          }}
        />
      )}

      {answers.length === 0 && !adding ? (
        <div className="empty">
          <h2>No saved answers yet</h2>
          <p className="muted">
            They appear here after you submit your first application. You can also add questions you know you’ll see
            again.
          </p>
        </div>
      ) : (
        <ul className="answers">
          {shown.map((a) => (
            <li key={a.id} className="answer">
              <label className="field">
                <span className="sr-only">Question</span>
                <input
                  type="text"
                  className="answer-q"
                  defaultValue={a.question}
                  onBlur={(e) => e.target.value !== a.question && void edit(a.id, { question: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="sr-only">Answer</span>
                <textarea
                  rows={Math.min(8, Math.max(2, Math.ceil(a.answer.length / 90)))}
                  defaultValue={a.answer}
                  onBlur={(e) => e.target.value !== a.answer && void edit(a.id, { answer: e.target.value })}
                />
              </label>
              <div className="answer-foot small muted">
                <span>
                  {a.learnedFrom ? `Learned from ${a.learnedFrom}, ` : ''}
                  updated {new Date(a.updatedAt).toLocaleDateString()}
                </span>
                <button className="btn quiet danger" type="button" onClick={() => void remove(a.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AnswerEditor({ onSave, onCancel }: { onSave: (q: string, a: string) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  return (
    <form
      className="answer adding"
      onSubmit={(e) => {
        e.preventDefault();
        if (question.trim() && answer.trim()) onSave(question.trim(), answer.trim());
      }}
    >
      <label className="field">
        <span>Question, as forms word it</span>
        <input type="text" autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} />
      </label>
      <label className="field">
        <span>Your answer</span>
        <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      <div className="answer-foot">
        <button className="btn primary" type="submit" disabled={!question.trim() || !answer.trim()}>
          Save answer
        </button>
        <button className="btn quiet" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

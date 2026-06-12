import type { CoachAdvice } from '../types/game';

interface CoachPanelProps {
  advice: CoachAdvice | null;
  feedback: string | null;
}

export function CoachPanel({ advice, feedback }: CoachPanelProps) {
  if (!advice && !feedback) {
    return (
      <aside className="coach-panel coach-panel--empty">
        <h3>Coach</h3>
        <p>Click <strong>Ask Coach</strong> when facing a decision.</p>
      </aside>
    );
  }

  return (
    <aside className="coach-panel">
      <h3>Coach</h3>
      {feedback && (
        <div className="coach-panel__feedback">
          <span className="coach-panel__label">Feedback</span>
          <p>{feedback}</p>
        </div>
      )}
      {advice && (
        <>
          <p className="coach-panel__summary">{advice.summary}</p>
          {advice.equity && (
            <p className="coach-panel__equity">Equity: {advice.equity}</p>
          )}
          <ul className="coach-panel__options">
            {advice.options.map((opt) => (
              <li key={opt.action}>
                <strong>{opt.action.toUpperCase()}</strong> — {opt.label}
                <br />
                <span>{opt.rationale}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

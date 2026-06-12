import { useState } from 'react';

import type { ChatMessage } from '../types/game';

interface AssistantPanelProps {
  history: ChatMessage[];
  disabled?: boolean;
  onAsk: (message: string) => Promise<string>;
  clockWarning?: string | null;
}

export function AssistantPanel({
  history,
  disabled,
  onAsk,
  clockWarning,
}: AssistantPanelProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!draft.trim() || pending || disabled) return;
    setPending(true);
    try {
      await onAsk(draft.trim());
      setDraft('');
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="assistant-panel">
      <h3>In-Hand Assistant</h3>
      <p className="assistant-panel__hint">
        Ask during your turn for pot odds, equity hints, and danger flags.
      </p>
      {clockWarning && <p className="assistant-panel__warning">{clockWarning}</p>}
      <div className="assistant-panel__chat">
        {history.length === 0 ? (
          <p className="assistant-panel__empty">No questions yet this hand.</p>
        ) : (
          history.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === 'user'
                  ? 'assistant-panel__message assistant-panel__message--user'
                  : 'assistant-panel__message'
              }
            >
              {message.content}
            </div>
          ))
        )}
      </div>
      <div className="assistant-panel__composer">
        <input
          type="text"
          value={draft}
          placeholder="Should I call this flush draw?"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void submit();
            }
          }}
          disabled={disabled || pending}
        />
        <button type="button" onClick={() => void submit()} disabled={disabled || pending}>
          {pending ? 'Thinking...' : 'Ask'}
        </button>
      </div>
    </aside>
  );
}

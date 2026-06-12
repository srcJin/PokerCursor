import { useState } from 'react';
import type { Action } from '../types/poker';

import type { TableView } from '../types/game';

interface ActionBarProps {
  view: TableView;
  onAction: (action: Action, betSize?: number) => void;
  onAskCoach: () => void;
  onAskAssistant: (message: string) => Promise<string>;
  disabled?: boolean;
}

export function ActionBar({
  view,
  onAction,
  onAskCoach,
  onAskAssistant,
  disabled,
}: ActionBarProps) {
  const [raiseAmount, setRaiseAmount] = useState(
    view.chipRange?.min ?? view.chipRange?.max ?? 4,
  );
  const [assistantPrompt, setAssistantPrompt] = useState('What are my pot odds?');

  const canRaise =
    view.legalActions.includes('raise') || view.legalActions.includes('bet');
  const raiseAction = view.legalActions.includes('raise') ? 'raise' : 'bet';

  if (!view.humanToAct) return null;

  return (
    <div className="action-bar">
      <button type="button" className="btn btn--coach" onClick={onAskCoach} disabled={disabled}>
        Quick Hint
      </button>
      <div className="action-bar__assistant">
        <input
          type="text"
          value={assistantPrompt}
          onChange={(event) => setAssistantPrompt(event.target.value)}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onAskAssistant(assistantPrompt)}
          disabled={disabled}
        >
          Ask Assistant
        </button>
      </div>

      <div className="action-bar__actions">
        {view.legalActions.includes('fold') && (
          <button type="button" className="btn btn--fold" onClick={() => onAction('fold')} disabled={disabled}>
            Fold
          </button>
        )}
        {view.legalActions.includes('check') && (
          <button type="button" className="btn btn--check" onClick={() => onAction('check')} disabled={disabled}>
            Check
          </button>
        )}
        {view.legalActions.includes('call') && (
          <button
            type="button"
            className="btn btn--call"
            onClick={() => onAction('call')}
            disabled={disabled}
          >
            Call
          </button>
        )}
        {canRaise && view.chipRange && (
          <div className="action-bar__raise">
            <input
              type="range"
              min={view.chipRange.min}
              max={view.chipRange.max}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn btn--raise"
              onClick={() => onAction(raiseAction, raiseAmount)}
              disabled={disabled}
            >
              {raiseAction === 'raise' ? 'Raise' : 'Bet'} ${raiseAmount}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

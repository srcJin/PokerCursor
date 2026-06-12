import { ActionBar } from './components/ActionBar';
import { CoachPanel } from './components/CoachPanel';
import { HandSummary } from './components/HandSummary';
import { PokerTable } from './components/PokerTable';
import { useGame } from './hooks/useGame';
import './App.css';

function App() {
  const {
    phase,
    view,
    coachAdvice,
    coachFeedback,
    handReport,
    startGame,
    askCoach,
    humanAction,
    nextHand,
  } = useGame();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Poker Coach</h1>
        <p>Learn Texas Hold&apos;em — 1 human vs 2 AI agents</p>
      </header>

      <main className="app__main">
        {phase === 'lobby' && (
          <div className="lobby">
            <h2>Ready to play?</h2>
            <p>
              You&apos;ll face two AI opponents with different styles. Use the Coach
              when you need help deciding.
            </p>
            <ul className="lobby__agents">
              <li><strong>Dealer Agent</strong> — rotates button, deals cards</li>
              <li><strong>Ace (Aggro)</strong> — loose-aggressive strategy</li>
              <li><strong>Rock (Tight)</strong> — tight-passive strategy</li>
              <li><strong>Coach Agent</strong> — explains options &amp; feedback</li>
              <li><strong>Report Agent</strong> — hand summary after each pot</li>
            </ul>
            <button type="button" className="btn btn--primary" onClick={startGame}>
              Start Game
            </button>
          </div>
        )}

        {view && phase !== 'lobby' && (
          <>
            <PokerTable view={view} />

            {phase === 'playing' && (
              <ActionBar
                view={view}
                onAction={humanAction}
                onAskCoach={askCoach}
              />
            )}

            {phase === 'hand_complete' && handReport && (
              <HandSummary report={handReport} onNextHand={nextHand} />
            )}

            {view.winners && phase === 'hand_complete' && (
              <div className="winners-banner">
                Winner: {view.winners.map((w) => `${w.label} (${w.handName})`).join(', ')}
              </div>
            )}
          </>
        )}

        <CoachPanel advice={coachAdvice} feedback={coachFeedback} />
      </main>
    </div>
  );
}

export default App;

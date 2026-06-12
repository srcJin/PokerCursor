import { useState } from 'react';
import { ActionBar } from './components/ActionBar';
import { AgentInsights } from './components/AgentInsights';
import { AssistantPanel } from './components/AssistantPanel';
import { CoachPanel } from './components/CoachPanel';
import { CoachReviewPanel } from './components/CoachReviewPanel';
import { HandSummary } from './components/HandSummary';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { PokerTable } from './components/PokerTable';
import { useGame } from './hooks/useGame';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState<'table' | 'data'>('table');
  const {
    phase,
    view,
    agentMemories,
    decisionTraces,
    playerRecords,
    isThinking,
    coachAdvice,
    coachFeedback,
    handReport,
    assistantHistory,
    coachHistory,
    clockWarning,
    startGame,
    askCoach,
    askAssistant,
    askCoachReview,
    coachChat,
    humanAction,
    nextHand,
  } = useGame();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Poker Coach</h1>
        <p>Learn Texas Hold&apos;em with scoped LLM agents, memory, and persistent credits</p>
        <nav className="app__tabs" aria-label="Demo views">
          <button
            type="button"
            className={activeView === 'table' ? 'app__tab app__tab--active' : 'app__tab'}
            onClick={() => setActiveView('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={activeView === 'data' ? 'app__tab app__tab--active' : 'app__tab'}
            onClick={() => setActiveView('data')}
          >
            Data
          </button>
        </nav>
      </header>

      <main className="app__main">
        {activeView === 'data' && (
          <div className="app__wide">
            <PerformanceDashboard records={playerRecords} />
            <AgentInsights memories={agentMemories} traces={decisionTraces} />
          </div>
        )}

        {activeView === 'table' && phase === 'lobby' && (
          <div className="lobby">
            <h2>Ready to play?</h2>
            <p>
              You&apos;ll face two AI opponents with different styles. Each agent
              receives only its scoped table view and keeps managed memory.
            </p>
            <ul className="lobby__agents">
              <li><strong>Dealer Agent</strong> — rotates button, deals cards</li>
              <li><strong>Ace (Aggro)</strong> — loose-aggressive strategy</li>
              <li><strong>Rock (Tight)</strong> — tight-passive strategy</li>
              <li><strong>Assistant</strong> — in-hand pot odds and equity help</li>
              <li><strong>Pro Coach</strong> — post-hand street review</li>
              <li><strong>Report Agent</strong> — hand summary after each pot</li>
            </ul>
            <button type="button" className="btn btn--primary" onClick={startGame} disabled={isThinking}>
              {isThinking ? 'Starting...' : 'Start Game'}
            </button>
          </div>
        )}

        {activeView === 'table' && view && phase !== 'lobby' && (
          <div className="table-col">
            {isThinking && <div className="thinking-banner">Agents are thinking...</div>}
            <PokerTable view={view} />

            {phase === 'playing' && (
              <ActionBar
                view={view}
                onAction={humanAction}
                onAskCoach={askCoach}
                onAskAssistant={askAssistant}
                disabled={isThinking}
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
          </div>
        )}

        {activeView === 'table' && (
          <div className="side-rail">
            <AssistantPanel
              history={assistantHistory}
              onAsk={askAssistant}
              disabled={isThinking || !view?.humanToAct}
              clockWarning={clockWarning}
            />
            <CoachPanel advice={coachAdvice} feedback={coachFeedback} />
            <CoachReviewPanel
              view={view}
              history={coachHistory}
              onReview={askCoachReview}
              onChat={coachChat}
              disabled={isThinking}
            />
            <PerformanceDashboard records={playerRecords} />
            <AgentInsights memories={agentMemories} traces={decisionTraces} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

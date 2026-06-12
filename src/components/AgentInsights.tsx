import type { AgentDecisionTrace, AgentMemorySnapshot } from '../types/game';

interface AgentInsightsProps {
  memories: AgentMemorySnapshot[];
  traces: AgentDecisionTrace[];
}

export function AgentInsights({ memories, traces }: AgentInsightsProps) {
  return (
    <section className="agent-insights">
      <div className="section-heading">
        <h3>Agent Memory & Characteristics</h3>
        <span>{traces.length} visible traces</span>
      </div>

      <div className="agent-insights__grid">
        {memories.map((memory) => (
          <article key={memory.agentId} className="agent-card">
            <div className="agent-card__header">
              <h4>{memory.label}</h4>
              <span>{memory.scope.replaceAll('_', ' ')}</span>
            </div>

            <div className="agent-card__traits">
              {memory.characteristics.map((trait) => (
                <div key={trait.label} className="trait-row">
                  <div>
                    <strong>{trait.label}</strong>
                    <span>{trait.value}</span>
                  </div>
                  <div className="trait-meter" aria-label={`${trait.label} ${trait.score}`}>
                    <span style={{ width: `${trait.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="agent-card__memory">
              <strong>Long-term memory</strong>
              <p>{memory.longTerm[0]}</p>
              <strong>Short-term memory</strong>
              <p>{memory.shortTerm.at(-1) ?? 'No decision stored for this hand yet.'}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="trace-list">
        <h4>Decision Process</h4>
        {traces.length === 0 ? (
          <p>No trace has been recorded yet.</p>
        ) : (
          traces.slice(-8).reverse().map((trace) => (
            <article key={trace.id} className="trace-item">
              <div className="trace-item__meta">
                <strong>{trace.label}</strong>
                <span>{trace.street ?? 'setup'}</span>
              </div>
              <p>{trace.rationale}</p>
              {trace.thinkingProcess.length > 0 && (
                <ol className="thinking-steps">
                  {trace.thinkingProcess.map((step, index) => (
                    <li key={`${trace.id}-step-${index}`}>{step}</li>
                  ))}
                </ol>
              )}
              {trace.observation.length > 0 && (
                <small>{trace.observation.join(' · ')}</small>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

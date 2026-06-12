import type { PlayerRecord } from '../types/game';

interface PerformanceDashboardProps {
  records: PlayerRecord[];
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function PerformanceDashboard({ records }: PerformanceDashboardProps) {
  return (
    <section className="performance-dashboard">
      <div className="section-heading">
        <h3>Player Records</h3>
        <span>Credits persist across hands</span>
      </div>

      <div className="record-grid">
        {records.map((record) => {
          const winRate = pct(record.wins, record.handsPlayed);
          const aggression = pct(record.aggressiveActions, Math.max(record.voluntaryActions, 1));
          const foldRate = pct(record.folds, Math.max(record.voluntaryActions, 1));
          const creditPct = Math.max(4, Math.min(100, (record.credits / record.startingCredit) * 100));

          return (
            <article key={record.seat} className="record-card">
              <div className="record-card__top">
                <div>
                  <h4>{record.label}</h4>
                  <span>{record.role.replaceAll('_', ' ')}</span>
                </div>
                <strong>${record.credits}</strong>
              </div>

              <div className="credit-bar" aria-label={`${record.label} credits`}>
                <span style={{ width: `${creditPct}%` }} />
              </div>

              <div className="record-card__stats">
                <span>Hands <strong>{record.handsPlayed}</strong></span>
                <span>Wins <strong>{winRate}%</strong></span>
                <span>Net <strong>{record.net >= 0 ? '+' : ''}${record.net}</strong></span>
              </div>

              <div className="mini-bars">
                <div>
                  <span>Activity</span>
                  <div><span style={{ width: `${pct(record.voluntaryActions, Math.max(record.handsPlayed * 3, 1))}%` }} /></div>
                </div>
                <div>
                  <span>Aggression</span>
                  <div><span style={{ width: `${aggression}%` }} /></div>
                </div>
                <div>
                  <span>Folds</span>
                  <div><span style={{ width: `${foldRate}%` }} /></div>
                </div>
              </div>

              <div className="sparkline" aria-label={`${record.label} recent credit changes`}>
                {record.recentResults.length === 0 ? (
                  <span className="sparkline__empty">No completed hands</span>
                ) : (
                  record.recentResults.map((result, index) => (
                    <span
                      key={`${record.seat}-${index}-${result}`}
                      className={result >= 0 ? 'sparkline__bar sparkline__bar--up' : 'sparkline__bar sparkline__bar--down'}
                      style={{ height: `${Math.min(100, Math.max(18, Math.abs(result) * 5))}%` }}
                      title={`${result >= 0 ? '+' : ''}${result}`}
                    />
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

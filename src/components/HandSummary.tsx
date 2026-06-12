import type { HandReport } from '../types/game';

interface HandSummaryProps {
  report: HandReport;
  onNextHand: () => void;
}

export function HandSummary({ report, onNextHand }: HandSummaryProps) {
  return (
    <div className="hand-summary">
      <h3>Hand Summary</h3>
      <p>{report.summary}</p>
      <div className="hand-summary__columns">
        <div>
          <h4>What you did well</h4>
          <ul>
            {report.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>What to improve</h4>
          <ul>
            {report.improvements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <button type="button" className="btn btn--primary" onClick={onNextHand}>
        Next Hand
      </button>
    </div>
  );
}

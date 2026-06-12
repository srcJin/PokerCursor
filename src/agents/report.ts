import type {
  ActionLogEntry,
  AgentDecisionTrace,
  HandReport,
  PlayerRecord,
  TableView,
} from '../types/game';
import { HUMAN_SEAT } from '../game/constants';

/** Report agent: summarizes the hand for learning review. */
export function buildHandReport(
  actionLog: ActionLogEntry[],
  view: TableView,
  traces: AgentDecisionTrace[],
  records: PlayerRecord[],
): HandReport {
  const humanActions = actionLog.filter((a) => a.seat === HUMAN_SEAT);
  const highlights: string[] = [];
  const improvements: string[] = [];

  const won = view.winners?.some((w) => w.seat === HUMAN_SEAT);
  if (won) {
    highlights.push('You won the hand — nice result!');
  } else if (view.winners?.length) {
    const winner = view.winners[0];
    improvements.push(
      `${winner.label} won with ${winner.handName}. Review whether your line maximized value.`,
    );
  }

  const folds = humanActions.filter((a) => a.action === 'fold');
  const raises = humanActions.filter(
    (a) => a.action === 'raise' || a.action === 'bet',
  );

  if (raises.length > 0) {
    highlights.push(
      `You showed aggression ${raises.length} time(s) — good for building pots with strong hands.`,
    );
  }

  if (folds.length > 0 && !won) {
    highlights.push('Knowing when to fold protects your stack for better spots.');
  }

  if (humanActions.length === 0) {
    improvements.push('You did not act this hand — make sure to engage when it is your turn.');
  }

  if (!raises.length && !folds.length && humanActions.length > 2) {
    improvements.push(
      'Mostly passive play this hand. Consider mixing in bets when you have equity or fold equity.',
    );
  }

  const actionSummary = humanActions
    .map((a) => `${a.street}: ${a.action}${a.betSize ? ` $${a.betSize}` : ''}`)
    .join(' → ');
  const humanRecord = records.find((record) => record.seat === HUMAN_SEAT);
  const net = humanRecord ? humanRecord.net : 0;

  const summary = [
    `Hand complete on ${view.street ?? 'showdown'}.`,
    actionSummary ? `Your line: ${actionSummary}.` : '',
    won ? 'Result: won.' : 'Result: lost or folded.',
    `Credits: $${humanRecord?.credits ?? 0} (${net >= 0 ? '+' : ''}${net}).`,
  ]
    .filter(Boolean)
    .join(' ');

  const timeline = actionLog.map((entry) => {
    const amount = entry.betSize ? ` $${entry.betSize}` : '';
    const reason = entry.rationale ? ` — ${entry.rationale}` : '';
    const process = entry.thinkingProcess?.length
      ? ` Process: ${entry.thinkingProcess.join(' / ')}`
      : '';
    return `${entry.street}: ${entry.player} ${entry.action}${amount}${reason}${process}`;
  });

  const decisionReviews = traces.map((trace) => {
    const amount = trace.betSize ? ` $${trace.betSize}` : '';
    const action = trace.action ? ` chose ${trace.action}${amount}` : ' observed the spot';
    const process = trace.thinkingProcess.length
      ? ` Process: ${trace.thinkingProcess.join(' / ')}`
      : '';
    return `${trace.label}${action}: ${trace.rationale}${process}`;
  });

  const thinkingProcess = [
    'Loaded the complete post-hand action log.',
    'Compared the final result against the human line and persistent credit record.',
    'Reviewed each stored agent decision process for strategy and visibility boundaries.',
  ];

  return {
    highlights: highlights.length ? highlights : ['You stayed in the hand and gained table experience.'],
    improvements: improvements.length
      ? improvements
      : ['Keep practicing position awareness and bet sizing.'],
    summary,
    timeline,
    decisionReviews,
    thinkingProcess,
  };
}

import {
  COACH_REVIEW_SYSTEM_PROMPT,
  LIVE_HAND_COACH_RESPONSE,
} from './prompts';
import type {
  ActionLogEntry,
  ChatMessage,
  Street,
  TableView,
} from '../types/game';
import { HUMAN_SEAT } from '../game/constants';

export { LIVE_HAND_COACH_RESPONSE };

function streetLabel(street: Street | null): string {
  switch (street) {
    case 'preflop':
      return 'PREFLOP';
    case 'flop':
      return 'FLOP';
    case 'turn':
      return 'TURN';
    case 'river':
      return 'RIVER';
    default:
      return 'SHOWDOWN';
  }
}

export function canUseCoachReview(view: TableView | null): boolean {
  return Boolean(view && !view.handInProgress);
}

export function formatCoachReviewContext(
  view: TableView,
  actionLog: ActionLogEntry[],
): string {
  const human = view.seats.find((seat) => seat.seat === HUMAN_SEAT);
  const pot = view.pots.reduce((sum, item) => sum + item.size, 0);

  return [
    `Street: ${view.street ?? 'showdown'}`,
    `Pot: $${pot}`,
    `Community: ${view.communityCards.join(' ') || 'none'}`,
    `Human (${human?.label ?? 'You'}): stack $${human?.stack ?? 0}, cards ${
      human?.holeCards?.join(' ') ?? 'none'
    }`,
    ...view.seats
      .filter((seat) => seat.seat !== HUMAN_SEAT)
      .map(
        (seat) =>
          `${seat.label}: stack $${seat.stack}, cards ${seat.holeCards?.join(' ') ?? 'none'}`,
      ),
    `Winners: ${
      view.winners?.map((winner) => `${winner.label} (${winner.handName})`).join(', ') ?? 'none'
    }`,
    `Action log:\n${actionLog
      .map((entry) => {
        const amount = entry.betSize ? ` $${entry.betSize}` : '';
        return `${entry.street}: ${entry.player} ${entry.action}${amount}`;
      })
      .join('\n')}`,
  ].join('\n');
}

export function gateCoachReview(
  view: TableView | null,
): { allowed: true } | { allowed: false; reply: string } {
  if (view?.handInProgress) {
    return { allowed: false, reply: LIVE_HAND_COACH_RESPONSE };
  }
  return { allowed: true };
}

export function formatCoachReviewReply(text: string, street: Street | null): string {
  const label = streetLabel(street);
  if (text.startsWith('[PRO COACH')) {
    return text;
  }
  return `[PRO COACH – ${label}]: ${text}`;
}

export function formatCoachChatReply(text: string): string {
  return text.startsWith('[PRO COACH') ? text : `[PRO COACH]: ${text}`;
}

/** Post-hand Pro Coach with per-review chat history. */
export class CoachReview {
  private chatHistory: ChatMessage[] = [];

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  resetChatHistory(): void {
    this.chatHistory = [];
  }

  buildReviewRequest(
    view: TableView,
    actionLog: ActionLogEntry[],
    street: Street | null,
  ): { system: string; userMessage: string } {
    const label = streetLabel(street);
    return {
      system: COACH_REVIEW_SYSTEM_PROMPT.replace('{STREET}', label),
      userMessage: `Review the ${label} street for the human player.\n\n${formatCoachReviewContext(view, actionLog)}`,
    };
  }

  buildChatRequest(
    view: TableView,
    actionLog: ActionLogEntry[],
    userMessage: string,
    conversationHistory: ChatMessage[],
  ): { system: string; messages: ChatMessage[] } {
    return {
      system: COACH_REVIEW_SYSTEM_PROMPT.replace('{STREET}', 'FOLLOW-UP'),
      messages: [
        ...conversationHistory,
        ...this.chatHistory,
        {
          role: 'user',
          content: `${userMessage}\n\nHand context:\n${formatCoachReviewContext(view, actionLog)}`,
        },
      ],
    };
  }

  recordReview(content: string): void {
    this.chatHistory.push({ role: 'assistant', content });
  }

  recordChat(userMessage: string, assistantReply: string): void {
    this.chatHistory.push({ role: 'user', content: userMessage });
    this.chatHistory.push({ role: 'assistant', content: assistantReply });
  }
}

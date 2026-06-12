import {
  ASSISTANT_IDLE_RESPONSE,
  ASSISTANT_SYSTEM_PROMPT,
} from './prompts';
import type { ChatMessage, TableView } from '../types/game';
import { HUMAN_SEAT } from '../game/constants';

export { ASSISTANT_IDLE_RESPONSE, ASSISTANT_SYSTEM_PROMPT };

export function canUseAssistant(view: TableView | null): boolean {
  return Boolean(view?.handInProgress && view.humanToAct);
}

export function formatAssistantContext(view: TableView): string {
  const human = view.seats.find((seat) => seat.seat === HUMAN_SEAT);
  const pot = view.pots.reduce((sum, item) => sum + item.size, 0);
  const callCost = view.chipRange?.min ?? 0;

  return [
    `Street: ${view.street ?? 'preflop'}`,
    `Pot: $${pot}`,
    `Call cost: $${callCost}`,
    `Your stack: $${human?.stack ?? 0}`,
    `Your cards: ${human?.holeCards?.filter((card) => card !== 'back').join(' ') ?? 'unknown'}`,
    `Community: ${view.communityCards.join(' ') || 'none'}`,
    `Legal actions: ${view.legalActions.join(', ')}`,
  ].join('\n');
}

export function gateAssistantMessage(
  view: TableView | null,
  userMessage: string,
): { allowed: true; userMessage: string } | { allowed: false; reply: string } {
  if (!view?.handInProgress) {
    return { allowed: false, reply: ASSISTANT_IDLE_RESPONSE };
  }
  if (!view.humanToAct) {
    return {
      allowed: false,
      reply: '[ASSISTANT]: I can only help on your turn. Wait for action to return to you.',
    };
  }
  return { allowed: true, userMessage };
}

export function formatAssistantReply(text: string): string {
  return text.startsWith('[ASSISTANT]:') ? text : `[ASSISTANT]: ${text}`;
}

export function buildAssistantPayload(
  view: TableView,
  userMessage: string,
  history: ChatMessage[],
): { system: string; messages: ChatMessage[]; context: string } {
  const urgency =
    history.length >= 2
      ? '\nNote: the player has asked multiple questions — remind them to act soon.'
      : '';

  return {
    system: ASSISTANT_SYSTEM_PROMPT,
    messages: [
      ...history,
      {
        role: 'user',
        content: `${userMessage}\n\n${formatAssistantContext(view)}${urgency}`,
      },
    ],
    context: formatAssistantContext(view),
  };
}

import type {
  AgentCharacteristic,
  AgentDecisionTrace,
  AgentId,
  AgentMemorySnapshot,
  VisibilityScope,
} from '../types/game';

interface AgentMemoryConfig {
  agentId: AgentId;
  label: string;
  scope: VisibilityScope;
  longTerm: string[];
  characteristics: AgentCharacteristic[];
}

const MEMORY_LIMIT = 5;

const AGENT_CONFIGS: AgentMemoryConfig[] = [
  {
    agentId: 'dealer',
    label: 'Dealer Agent',
    scope: 'visible_table',
    longTerm: ['Enforces turn order, blinds, street progression, and button rotation.'],
    characteristics: [
      { label: 'Neutrality', value: 'Rules-only', score: 100 },
      { label: 'Visibility', value: 'No hidden cards', score: 100 },
      { label: 'Autonomy', value: 'Lifecycle manager', score: 80 },
    ],
  },
  {
    agentId: 'coach',
    label: 'Assistant Coach',
    scope: 'human_and_visible_table',
    longTerm: ['Optimizes learning for the human player using only the human hand and public board.'],
    characteristics: [
      { label: 'Teaching', value: 'Explains options', score: 90 },
      { label: 'Risk style', value: 'Balanced', score: 55 },
      { label: 'Visibility', value: 'Human hand only', score: 100 },
    ],
  },
  {
    agentId: 'report',
    label: 'Report Agent',
    scope: 'full_history',
    longTerm: ['Reviews the complete hand history, visible traces, and final cards after the hand.'],
    characteristics: [
      { label: 'Audit depth', value: 'Complete history', score: 95 },
      { label: 'Tone', value: 'Analytical', score: 75 },
      { label: 'Visibility', value: 'Post-hand full access', score: 100 },
    ],
  },
  {
    agentId: 'ai_aggressive',
    label: 'Ace (Aggro)',
    scope: 'own_hand_and_visible_table',
    longTerm: ['Loose-aggressive opponent: pressures marginal edges and prefers initiative.'],
    characteristics: [
      { label: 'Aggression', value: 'High', score: 82 },
      { label: 'Loss aversion', value: 'Low', score: 32 },
      { label: 'Bluff pressure', value: 'Frequent', score: 76 },
    ],
  },
  {
    agentId: 'ai_conservative',
    label: 'Rock (Tight)',
    scope: 'own_hand_and_visible_table',
    longTerm: ['Tight-passive opponent: protects stack and continues with stronger ranges.'],
    characteristics: [
      { label: 'Aggression', value: 'Low', score: 30 },
      { label: 'Loss aversion', value: 'High', score: 78 },
      { label: 'Bluff pressure', value: 'Rare', score: 24 },
    ],
  },
];

export class AgentMemoryManager {
  private shortTerm = new Map<AgentId, string[]>();
  private decisions = new Map<AgentId, number>();

  constructor() {
    for (const config of AGENT_CONFIGS) {
      this.shortTerm.set(config.agentId, []);
      this.decisions.set(config.agentId, 0);
    }
  }

  resetHand(): void {
    for (const config of AGENT_CONFIGS) {
      this.shortTerm.set(config.agentId, []);
      this.decisions.set(config.agentId, 0);
    }
  }

  remember(agentId: AgentId, note: string): void {
    const notes = this.shortTerm.get(agentId) ?? [];
    this.shortTerm.set(agentId, [...notes, note].slice(-MEMORY_LIMIT));
  }

  recordDecision(trace: AgentDecisionTrace): void {
    this.remember(trace.agentId, trace.rationale);
    this.decisions.set(trace.agentId, (this.decisions.get(trace.agentId) ?? 0) + 1);
  }

  getSnapshot(agentId: AgentId): AgentMemorySnapshot {
    const config = AGENT_CONFIGS.find((item) => item.agentId === agentId);
    if (!config) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    return {
      agentId,
      label: config.label,
      scope: config.scope,
      shortTerm: [...(this.shortTerm.get(agentId) ?? [])],
      longTerm: [...config.longTerm],
      characteristics: config.characteristics.map((item) => ({ ...item })),
      decisionsThisHand: this.decisions.get(agentId) ?? 0,
    };
  }

  getAllSnapshots(): AgentMemorySnapshot[] {
    return AGENT_CONFIGS.map((config) => this.getSnapshot(config.agentId));
  }
}

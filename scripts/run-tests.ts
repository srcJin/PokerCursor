import { runCardsTests } from '../src/__tests__/cards.test.ts';
import { runChatGatingTests } from '../src/__tests__/chatGating.test.ts';
import { runGameSessionE2ETests } from '../src/__tests__/gameSession.e2e.test.ts';

async function main() {
  console.log('cards');
  runCardsTests();
  console.log('  ✓ deck utilities');

  console.log('chat gating');
  runChatGatingTests();
  console.log('  ✓ assistant and coach gates');

  console.log('game session e2e');
  await runGameSessionE2ETests();
  console.log('  ✓ full hand on poker-ts backbone');

  console.log('\nAll tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

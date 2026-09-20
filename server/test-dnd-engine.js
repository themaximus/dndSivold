// Test server-side anti-cheat dice engine and DM turn resolution
const { executeServerRoll } = require('./dist/services/diceEngine');
const { generateDMTurn } = require('./dist/services/deepseek');

async function testEngine() {
  console.log('🎲 Testing Server-Side Anti-Cheat Dice Engine...');

  const mockFighter = {
    id: 'char_1',
    name: 'Борис',
    characterClass: 'Воин',
    race: 'Человек',
    level: 1,
    hpCurrent: 12,
    hpMax: 12,
    ac: 16,
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    skills: ['Сила', 'Телосложение'],
    abilities: [{ id: 'a1', name: 'Удар мечом', type: 'action', description: '2d6+3' }],
    inventory: [{ id: 'i1', name: 'Меч', type: 'weapon', quantity: 1 }],
    bio: '',
    avatarUrl: '',
    createdAt: ''
  };

  // Test standard d20 roll with strength modifier (16 STR -> +3 mod)
  const rollD20 = executeServerRoll(
    { diceType: 'd20', statKey: 'str', purpose: 'Атака двуручным мечом' },
    mockFighter
  );
  console.log('   d20 Attack Roll:', {
    baseRoll: rollD20.baseRoll,
    modifier: rollD20.modifier,
    total: rollD20.total,
    isCrit: rollD20.isCriticalSuccess,
  });

  if (rollD20.modifier !== 3) {
    throw new Error(`Expected modifier +3 for STR 16, got ${rollD20.modifier}`);
  }
  if (rollD20.total !== rollD20.baseRoll + 3) {
    throw new Error('Total does not match baseRoll + modifier');
  }

  // Test advantage roll (2 dice rolled, highest picked)
  const rollAdv = executeServerRoll(
    { diceType: 'd20', statKey: 'str', advantage: true, purpose: 'Атака с преимуществом' },
    mockFighter
  );
  console.log('   d20 Advantage Roll:', {
    rolls: rollAdv.rolls,
    pickedBase: rollAdv.baseRoll,
    total: rollAdv.total,
  });
  if (rollAdv.rolls.length !== 2) {
    throw new Error('Advantage should roll 2 dice');
  }
  if (rollAdv.baseRoll !== Math.max(rollAdv.rolls[0], rollAdv.rolls[1])) {
    throw new Error('Advantage should pick the maximum roll');
  }

  console.log('✅ Dice Engine passed anti-cheat validation!\n');

  console.log('🧙 Testing AI Dungeon Master Turn Resolution...');
  const dmTurn = await generateDMTurn({
    setting: 'Отряд стоит перед массивными железными вратами в катакомбы.',
    roundNumber: 1,
    currentSituation: 'Из темноты доносится рычание.',
    characters: [mockFighter],
    actions: [
      {
        id: 'act_1',
        roomId: 'room_1',
        roundNumber: 1,
        playerId: 'user_1',
        characterId: 'char_1',
        characterName: 'Борис',
        actionText: 'Выставляю щит вперед и делаю рубящий удар мечом в темноту.',
        diceRolls: [rollD20],
        submittedAt: new Date().toISOString()
      }
    ],
    previousHistory: []
  });

  console.log('   DM Narrative:\n  ', dmTurn.narrative.substring(0, 150) + '...');
  console.log('   Player Updates:', dmTurn.playerUpdates);
  console.log('   Next Round Prompt:', dmTurn.currentSituation);

  if (!dmTurn.narrative || !dmTurn.currentSituation) {
    throw new Error('DM response missing narrative or next situation');
  }

  console.log('\n✅ AI Dungeon Master Engine verified successfully!');
}

testEngine().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

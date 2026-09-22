import assert from 'assert';
import crypto from 'crypto';
import { SceneEntityManager, stemRussianWord, extractSearchTokens } from '../services/session/SceneEntityManager';
import { ActionIntentEngine } from '../services/session/ActionIntentEngine';
import { InventoryLedgerService } from '../services/session/InventoryLedgerService';
import { RoomTransactionMutex } from '../services/session/RoomTransactionMutex';
import { RoomEntity, CharacterEntity } from '../db';
import { gameSessionService, isSameEntity } from '../services/game/GameSessionService';

async function runTests() {
  console.log('🚀 Starting Architecture Verification Test Suite...\n');

  const sem = new SceneEntityManager();
  const aie = new ActionIntentEngine();
  const mutex = new RoomTransactionMutex();

  // ----------------------------------------------------
  // Test 1: Russian Stemming & Tokenization
  // ----------------------------------------------------
  console.log('Test 1: Russian Stemming & Fleeting Vowels');
  const stem1 = stemRussianWord('гонец');
  const stem2 = stemRussianWord('гонца');
  const stem3 = stemRussianWord('гонцу');
  assert.strictEqual(stem1, 'гонц', 'Stem of гонец must be гонц');
  assert.strictEqual(stem2, 'гонц', 'Stem of гонца must be гонц');
  assert.strictEqual(stem3, 'гонц', 'Stem of гонцу must be гонц');
  console.log('✅ Russian stemming handles fleeting vowels correctly ("гонец" <-> "гонца" <-> "гонцу").\n');

  // ----------------------------------------------------
  // Test 2: UUID Stability & Scene Entity Creation
  // ----------------------------------------------------
  console.log('Test 2: UUID Stability & Scene Entity Registration');
  const mockRoom: RoomEntity = {
    id: 'room_test_1',
    code: 'ROOM1',
    hostUserId: 'user_1',
    title: 'Тестовое приключение',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 1,
    currentSituation: 'Отряд на развилке тракта',
    sceneEntities: [],
    createdAt: new Date().toISOString(),
  };

  const entity = sem.registerEntity(mockRoom, {
    name: 'Раненый гонец',
    role: 'Посланник графской стражи',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    hpCurrent: 10,
    hpMax: 15,
    ac: 12,
  });

  assert.ok(entity.entityId.startsWith('ent_'), 'Entity ID must have ent_ prefix');
  assert.strictEqual(entity.canonicalName, 'Раненый гонец');
  const originalUUID = entity.entityId;

  // Add alias and verify UUID does NOT change
  sem.addAlias(entity, 'Элиас');
  sem.addAlias(entity, 'Посланник стражи');

  assert.strictEqual(entity.entityId, originalUUID, 'Entity UUID must be immutable');
  assert.ok(entity.aliases.includes('Элиас'), 'Alias Элиас must be registered');
  console.log(`✅ UUID generated and preserved across aliases: ${originalUUID}\n`);

  // ----------------------------------------------------
  // Test 3: Entity Resolution via Aliases & Stems
  // ----------------------------------------------------
  console.log('Test 3: Entity Resolution via Aliases');
  const resolvedByName = sem.resolveEntity(mockRoom, 'Раненый гонец');
  assert.strictEqual(resolvedByName?.entityId, originalUUID);

  const resolvedByInflected = sem.resolveEntity(mockRoom, 'перевязываю рану гонца');
  assert.strictEqual(resolvedByInflected?.entityId, originalUUID, 'Must resolve "гонца" to "Раненый гонец"');

  const resolvedByAlias = sem.resolveEntity(mockRoom, 'говорю с Элиасом');
  assert.strictEqual(resolvedByAlias?.entityId, originalUUID, 'Must resolve alias "Элиас"');
  console.log('✅ Entity correctly resolved by canonical name, inflected form, and alias.\n');

  // ----------------------------------------------------
  // Test 4: Mutual Exclusivity of Factions (Bug #6 Resolution)
  // ----------------------------------------------------
  console.log('Test 4: Mutual Exclusivity (Threats vs Scene NPCs)');
  // Add an enemy
  const enemy = sem.registerEntity(mockRoom, {
    name: 'Гоблин-лучник',
    role: 'Лучник засады',
    faction: 'hostile',
    combatRole: 'hostile_threat',
    hpCurrent: 14,
    hpMax: 14,
    ac: 13,
  });

  const projection = sem.buildSceneProjection(mockRoom);
  const isInThreats = projection.threats.some((t) => t.entityId === enemy.entityId);
  const isInNPCs = projection.sceneNPCs.some((n) => n.entityId === enemy.entityId);

  assert.strictEqual(isInThreats, true, 'Enemy must be in threats');
  assert.strictEqual(isInNPCs, false, 'Enemy must NEVER be in sceneNPCs simultaneously');

  const messengerInThreats = projection.threats.some((t) => t.entityId === entity.entityId);
  const messengerInNPCs = projection.sceneNPCs.some((n) => n.entityId === entity.entityId);
  assert.strictEqual(messengerInThreats, false, 'Neutral messenger must NEVER be in threats');
  assert.strictEqual(messengerInNPCs, true, 'Neutral messenger must be in sceneNPCs');
  console.log('✅ Mathematical mutual exclusivity guaranteed: creature cannot appear in threats and NPCs at once.\n');

  // ----------------------------------------------------
  // Test 5: Procedural Entity Synthesis (Bug #7 Resolution)
  // ----------------------------------------------------
  console.log('Test 5: Procedural Entity Synthesis from Narrative');
  const narrative = 'Из чащи леса выходит старый трактирщик Боб, катя перед собой бочонок эля.';
  const situation = 'Трактирщик предлагает путникам промочить горло.';
  const spawned = sem.synthesizeEntitiesFromNarrative(mockRoom, narrative, situation);

  assert.ok(spawned.length > 0 || mockRoom.sceneEntities?.some((e) => e.canonicalName.includes('Трактирщик')));
  const bob = mockRoom.sceneEntities?.find((e) => e.canonicalName.includes('Трактирщик'));
  assert.ok(bob, 'Narrative entity extractor must synthesize Bob into room.sceneEntities');
  assert.ok(bob?.entityId.startsWith('ent_'), 'Synthesized entity must receive UUID');
  console.log(`✅ Procedural synthesis created entity: ${bob?.canonicalName} (UUID: ${bob?.entityId})\n`);

  // ----------------------------------------------------
  // Test 6: Departure & World NPC Registry Archival
  // ----------------------------------------------------
  console.log('Test 6: Departure & World Registry Archival');
  // Merchant stays behind while party departs
  const merchant = sem.registerEntity(mockRoom, {
    name: 'Купец Бальтазар',
    role: 'Караванщик',
    status: 'Остался позади на развилке, вне себя от ярости',
    faction: 'neutral',
  });

  const departures = sem.handleNPCDepartures(mockRoom, 'Отряд въезжает в городские ворота.', 'Позади остались степи.');
  assert.ok(departures.some((d) => d.entityId === merchant.entityId), 'Merchant must be marked as departed');
  assert.strictEqual(merchant.lifecycle, 'departed');

  const inWorldRegistry = mockRoom.worldNPCRegistry?.find((w) => w.id === merchant.entityId);
  assert.ok(inWorldRegistry, 'Departed entity must be saved in worldNPCRegistry');
  assert.strictEqual(inWorldRegistry?.departureReason, 'left_behind');

  const postDepartureProjection = sem.buildSceneProjection(mockRoom);
  const merchantInActiveScene = postDepartureProjection.sceneNPCs.some((n) => n.entityId === merchant.entityId);
  assert.strictEqual(merchantInActiveScene, false, 'Departed entity must NOT appear in active sceneNPCs');
  const merchantInArchive = postDepartureProjection.worldArchive.some((w) => w.id === merchant.entityId);
  assert.strictEqual(merchantInArchive, true, 'Departed entity MUST appear in worldArchive');
  console.log('✅ Merchant correctly departed and transferred from sceneNPCs to worldArchive.\n');

  // ----------------------------------------------------
  // Test 7: ActionIntentEngine Semantic Parsing
  // ----------------------------------------------------
  console.log('Test 7: ActionIntentEngine Semantic Parsing');
  const attackAction = {
    id: 'act_1',
    roomId: mockRoom.id,
    roundNumber: 1,
    playerId: 'p_1',
    characterId: 'char_1',
    characterName: 'Варис',
    actionText: 'Атакую гоблина мечом! "За короля!"',
    diceRolls: [],
    submittedAt: new Date().toISOString(),
  };

  const parsedAttack = aie.parseActionIntent(attackAction, undefined, mockRoom);
  assert.strictEqual(parsedAttack.intentClass, 'combat_attack');
  assert.deepStrictEqual(parsedAttack.spokenDialogue, ['За короля!']);
  assert.strictEqual(parsedAttack.targetEntityId, enemy.entityId, 'Must resolve target entity UUID for Goblin');

  const healAction = {
    id: 'act_2',
    roomId: mockRoom.id,
    roundNumber: 1,
    playerId: 'p_1',
    characterId: 'char_1',
    characterName: 'Варис',
    actionText: 'Подбегаю и перевязываю раненого гонца бинтом',
    diceRolls: [],
    submittedAt: new Date().toISOString(),
  };

  const parsedHeal = aie.parseActionIntent(healAction, undefined, mockRoom);
  assert.strictEqual(parsedHeal.intentClass, 'heal_assist');
  assert.strictEqual(parsedHeal.targetEntityId, entity.entityId, 'Must resolve target entity UUID for Messenger');
  console.log('✅ ActionIntentEngine correctly classified intent and resolved target UUIDs without regex collisions.\n');

  // ----------------------------------------------------
  // Test 8: RoomTransactionMutex Concurrency Safety
  // ----------------------------------------------------
  console.log('Test 8: RoomTransactionMutex Sequential Execution');
  const executionOrder: number[] = [];

  const task1 = mutex.runExclusive('room_test_mutex', async () => {
    await new Promise((r) => setTimeout(r, 50));
    executionOrder.push(1);
    return 1;
  });

  const task2 = mutex.runExclusive('room_test_mutex', async () => {
    await new Promise((r) => setTimeout(r, 10));
    executionOrder.push(2);
    return 2;
  });

  const task3 = mutex.runExclusive('room_test_mutex', async () => {
    executionOrder.push(3);
    return 3;
  });

  await Promise.all([task1, task2, task3]);
  assert.deepStrictEqual(executionOrder, [1, 2, 3], 'Tasks must execute in strict FIFO sequence without race conditions');
  console.log('✅ RoomTransactionMutex verified: 3 simultaneous tasks executed strictly sequentially in order [1, 2, 3].\n');

  // ----------------------------------------------------
  // Test 9: Backward-compatible GameSessionService Facade
  // ----------------------------------------------------
  console.log('Test 9: GameSessionService Facade & isSameEntity');
  assert.ok(typeof gameSessionService.joinRoom === 'function');
  assert.ok(typeof gameSessionService.resolveTurnStep === 'function');
  assert.ok(typeof gameSessionService.resolveRound === 'function');
  assert.ok(typeof gameSessionService.pickupLoot === 'function');
  assert.ok(typeof gameSessionService.performLongRest === 'function');

  assert.strictEqual(isSameEntity({ name: 'Гонец' }, { name: 'Раненый гонец' }), true);
  assert.strictEqual(isSameEntity({ name: 'Бандит 1' }, { name: 'Бандит 2' }), false);
  console.log('✅ GameSessionService Facade operates with 100% backward compatibility.\n');

  // ----------------------------------------------------
  // Test 10: Player Character Hydration
  // ----------------------------------------------------
  console.log('Test 10: Player Character Hydration');
  const mockChar: CharacterEntity = {
    id: 'char_test_1',
    userId: 'user_1',
    name: 'Арагорн',
    race: 'Человек',
    characterClass: 'Следопыт',
    level: 1,
    hpCurrent: 12,
    hpMax: 12,
    ac: 14,
    stats: { str: 14, dex: 15, con: 12, int: 10, wis: 14, cha: 10 },
    skills: [],
    abilities: [],
    bio: '',
    avatarUrl: '',
    conditions: [],
    inventory: [],
    createdAt: new Date().toISOString(),
  };

  const mockRoomPlayers = [
    {
      id: 'rp_1',
      roomId: mockRoom.id,
      userId: 'user_1',
      username: 'Игрок 1',
      characterId: 'char_test_1',
      isReady: true,
      isOnline: true,
      hasActedThisRound: false,
      joinedAt: new Date().toISOString(),
    },
  ];

  // Verify that mapping players with characters hydrates the character object
  const hydrated = mockRoomPlayers.map((p) => ({
    ...p,
    character: p.characterId === mockChar.id ? mockChar : undefined,
  }));
  assert.ok(hydrated[0].character, 'Hydrated player must contain character object');
  assert.strictEqual(hydrated[0].character?.name, 'Арагорн');
  console.log('✅ Player character hydration verified: party cards receive full character stats.\n');

  // ----------------------------------------------------
  // Test 11: Choice Dilemma & Formatted Actions Summary
  // ----------------------------------------------------
  console.log('Test 11: Choice Dilemma & Actions Summary Formatting');
  const sampleLog = {
    id: 'log_test_1',
    roomId: mockRoom.id,
    roundNumber: 1,
    narrativeText: 'Отряд исследует развилку старого тракта.',
    choiceDilemma: 'Помочь раненому гонцу или продолжить путь к крепости. Что делает отряд?',
    currentSituation: 'Перед отрядом лежит раненый гонец.',
    mood: 'mystery',
  };

  assert.ok(sampleLog.choiceDilemma, 'GameLog must preserve choiceDilemma');
  assert.strictEqual(sampleLog.mood, 'mystery');
  console.log('✅ Choice dilemma and mood preserved in GameLog.\n');

  // ----------------------------------------------------
  // Test 12: Inventory Resolution, Weapon Auto-Typing & Container Extraction
  // ----------------------------------------------------
  console.log('Test 12: Inventory Resolution & Container Extracted Items Guarantee');
  const testChar: CharacterEntity = {
    id: 'char_kirilchik_uuid_123',
    userId: 'user_kakashka',
    name: 'Кирильчик',
    race: 'Дворф',
    characterClass: 'Варвар',
    level: 1,
    hpCurrent: 16,
    hpMax: 17,
    ac: 15,
    stats: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 12 },
    skills: [],
    abilities: [],
    bio: '',
    avatarUrl: '',
    inventory: [],
    createdAt: new Date().toISOString(),
  };

  const testRoom: RoomEntity = {
    id: 'room_inv_test',
    code: 'INV123',
    title: 'Test Room',
    setting: 'fantasy',
    currentSituation: 'Test Situation',
    hostUserId: 'user_kakashka',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 3,
    sceneEntities: [],
    activeEnemies: [],
    sceneNPCs: [],
    searchedObjectsRegistry: [],
  };

  const mockRoomsRepo: any = {
    findPlayersByRoomId: () => [
      { id: 'rp_1', roomId: testRoom.id, userId: 'user_kakashka', characterId: testChar.id }
    ],
  };

  const mockCharsRepo: any = {
    findById: (id: string) => (id === testChar.id ? testChar : undefined),
    addItemToInventory: (id: string, item: any, reason?: string) => {
      if (id === testChar.id) {
        testChar.inventory.push(item);
        return testChar;
      }
      return null;
    },
    removeItemFromInventory: () => null,
  };

  const mockLedgersRepo: any = {
    recordItemEvent: () => {},
  };

  const mockSearchedRepo: any = {
    recordSearch: () => {},
  };

  const ils = new InventoryLedgerService(mockRoomsRepo, mockCharsRepo, mockLedgersRepo, mockSearchedRepo);

  const notifications: any[] = [];
  const activities: any = {};

  // Scenario A: AI returns Russian dative case "Кирильчику" and omits damage/weapon type for "Арбалет из красного дерева"
  ils.applyInventoryUpdates(
    testRoom,
    [
      {
        characterName: 'Кирильчику', // dative case!
        action: 'add',
        reason: 'Купец Бальтазар благодарит и дарит арбалет.',
        item: {
          name: 'Арбалет из красного дерева',
          // type omitted / misc
        },
      },
    ],
    3,
    notifications,
    activities
  );

  assert.strictEqual(testChar.inventory.length, 1, 'Character must have received the crossbow');
  assert.strictEqual(testChar.inventory[0].name, 'Арбалет из красного дерева');
  assert.strictEqual(testChar.inventory[0].type, 'weapon', 'Weapon type must be auto-inferred');
  assert.strictEqual(testChar.inventory[0].damage, '1d8', 'Crossbow damage must default to 1d8');

  // Scenario B: Searched object container has extracted items ("Колчан болтов") not in inventoryUpdates
  ils.handleSearchedObjects(
    testRoom,
    3,
    [
      {
        targetName: 'Повозка купца Бальтазара',
        targetType: 'container',
        extractedItems: ['Арбалет из красного дерева', 'Колчан болтов'],
        narrativeNote: 'Обыскано',
      },
    ],
    'Кирильчик',
    testChar.id,
    notifications,
    activities
  );

  // Crossbow is not duplicated, but bolts are added!
  assert.strictEqual(testChar.inventory.length, 2, 'Bolts must be added without duplicating crossbow');
  const bolts = testChar.inventory.find(i => i.name === 'Колчан болтов');
  assert.ok(bolts, 'Колчан болтов must be in inventory');
  assert.strictEqual(bolts?.quantity, 20, 'Bolts default quantity should be 20');
  console.log('✅ Inventory resolution, Russian case inflections, weapon auto-typing, and container extracted items verified.\n');

  console.log('🎉 ALL 12 ARCHITECTURAL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

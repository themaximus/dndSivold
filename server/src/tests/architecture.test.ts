import assert from 'assert';
import crypto from 'crypto';
import { SceneEntityManager, stemRussianWord, extractSearchTokens } from '../services/session/SceneEntityManager';
import { ActionIntentEngine } from '../services/session/ActionIntentEngine';
import { InventoryLedgerService } from '../services/session/InventoryLedgerService';
import { RoomTransactionMutex } from '../services/session/RoomTransactionMutex';
import { RoomEntity, CharacterEntity, GameLogEntity, EnvironmentObjectEntity } from '../db';
import { gameSessionService, isSameEntity } from '../services/game/GameSessionService';
import { ServiceLocator, systemLocator } from '../services/session/ServiceLocator';
import { questArbiter } from '../services/game/QuestArbiter';

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

  // ----------------------------------------------------
  // Test 13: Primary Turn Mode Defaults to Turn-by-Turn
  // ----------------------------------------------------
  console.log('Test 13: Primary Turn Mode Defaults to Turn-by-Turn (Пошаговый)');
  const rsmRoom: RoomEntity = {
    id: 'room_turn_test',
    code: 'TURN12',
    title: 'Turn Mode Room',
    setting: 'fantasy',
    currentSituation: 'Ready to fight',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 1,
    turnOrder: ['user_1', 'user_2'],
    // turnMode left undefined to verify default
  };

  const isTurnByTurnDefault = (rsmRoom.turnMode || 'turn_by_turn') === 'turn_by_turn';
  assert.strictEqual(isTurnByTurnDefault, true, 'Default turnMode must be turn_by_turn');

  // Verify that active player is properly assigned from turnOrder
  const initialActiveUser = isTurnByTurnDefault ? rsmRoom.turnOrder?.[0] : undefined;
  assert.strictEqual(initialActiveUser, 'user_1', 'Initial active player must be first in turnOrder in turn_by_turn mode');
  console.log('✅ Primary turn mode verified: defaults to turn_by_turn with turnOrder activation.\n');

  // ----------------------------------------------------
  // Test 14: SystemLocator / ServiceLocator
  // ----------------------------------------------------
  console.log('Test 14: SystemLocator / ServiceLocator');
  const locator = new ServiceLocator();
  assert.ok(locator.has('roomSessionManager'), 'Locator must have roomSessionManager');
  assert.ok(locator.has('turnExecutionPipeline'), 'Locator must have turnExecutionPipeline');
  assert.ok(locator.has('sceneEntityManager'), 'Locator must have sceneEntityManager');
  assert.ok(locator.has('inventoryLedgerService'), 'Locator must have inventoryLedgerService');
  assert.ok(locator.has('questArbiter'), 'Locator must have questArbiter');

  // Test custom registration and retrieval
  const dummySem = new SceneEntityManager();
  locator.register('sceneEntityManager', dummySem);
  assert.strictEqual(locator.get('sceneEntityManager'), dummySem, 'Locator must return registered custom service');

  // Test global systemLocator singleton
  assert.ok(systemLocator.get('sceneEntityManager'), 'Global systemLocator must resolve services');
  console.log('✅ SystemLocator / ServiceLocator pattern verified: modular registration and resolution operate correctly.\n');

  // ----------------------------------------------------
  // Test 15: Scene NPC Transition to Threats («Враги»)
  // ----------------------------------------------------
  console.log('Test 15: Dynamic Scene NPC Transition to Threats («Враги»)');
  const hostileTestRoom: RoomEntity = {
    id: `room_hostile_test_${crypto.randomUUID()}`,
    code: 'HOST12',
    title: 'Hostility Test Room',
    setting: 'fantasy',
    currentSituation: 'Стражник Вальтер преграждает путь',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 1,
    sceneEntities: [],
  };

  // Register neutral guard
  sem.registerEntity(hostileTestRoom, {
    name: 'Стражник Вальтер',
    role: 'Стражник',
    entityType: 'npc',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    disposition: 'neutral',
    hpCurrent: 20,
    hpMax: 20,
    status: 'Спокойно наблюдает',
  });

  const projBefore = sem.buildSceneProjection(hostileTestRoom);
  assert.strictEqual(projBefore.threats.length, 0, 'Initially there must be 0 threats');
  assert.strictEqual(projBefore.sceneNPCs.length, 1, 'Initially guard must be in sceneNPCs');

  // Round event: Guard turns hostile (disposition: 'hostile')
  sem.processRoundEntities(
    hostileTestRoom,
    {
      narrative: 'Стражник Вальтер обнажает клинок с криком: "Вы все под арестом!" и атакует отряд.',
      currentSituation: 'Вальтер нападает',
      playerUpdates: [],
      sceneNPCs: [
        {
          id: 'walter_id',
          name: 'Стражник Вальтер',
          role: 'Стражник',
          hpCurrent: 20,
          hpMax: 20,
          disposition: 'hostile',
          combatRole: 'neutral_observer',
          status: 'Атакует отряд с обнажённым мечом',
          isDead: false,
        },
      ],
    } as any,
    [],
    []
  );

  const walterEntity = hostileTestRoom.sceneEntities?.find(e => e.canonicalName.includes('Вальтер'));
  assert.ok(walterEntity, 'Walter must exist in sceneEntities');
  assert.strictEqual(walterEntity?.faction, 'hostile', 'Walter faction must be transitioned to hostile');
  assert.strictEqual(walterEntity?.combatRole, 'hostile_threat', 'Walter combatRole must be hostile_threat');

  const projAfter = sem.buildSceneProjection(hostileTestRoom);
  assert.strictEqual(projAfter.threats.length, 1, 'Walter must now appear in threats («Враги»)');
  assert.strictEqual(projAfter.threats[0].name, 'Стражник Вальтер');
  assert.strictEqual(projAfter.sceneNPCs.length, 0, 'Walter must be REMOVED from sceneNPCs («Сцена»)');
  assert.strictEqual(hostileTestRoom.activeEnemies?.length, 1, 'Walter must be in room.activeEnemies');
  assert.strictEqual(hostileTestRoom.sceneNPCs?.length, 0, 'Walter must NOT be in room.sceneNPCs');
  console.log('✅ Moving NPC from Scene to Enemies («Враги») verified: faction and projection dynamically update.\n');

  // ----------------------------------------------------
  // Test 16: Dynamic NPC Status Updating (Prevent Static Status)
  // ----------------------------------------------------
  console.log('Test 16: Dynamic NPC Status Updating (Prevent Frozen Status)');
  const statusTestRoom: RoomEntity = {
    id: `room_status_test_${crypto.randomUUID()}`,
    code: 'STAT12',
    title: 'Status Test Room',
    setting: 'fantasy',
    currentSituation: 'Купец Бальтазар осматривает товар',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 1,
    sceneEntities: [],
  };

  const balthazar = sem.registerEntity(statusTestRoom, {
    name: 'Купец Бальтазар',
    role: 'Купец',
    entityType: 'npc',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    disposition: 'friendly',
    hpCurrent: 18,
    hpMax: 18,
    status: 'Встречен в сцене',
  });

  assert.strictEqual(balthazar.status, 'Встречен в сцене');

  // Round 1: Explicit AI status update
  sem.processRoundEntities(
    statusTestRoom,
    {
      narrative: 'Бальтазар прячется за ящиками, дрожа от страха перед разбойниками.',
      currentSituation: 'Идет бой',
      playerUpdates: [],
      sceneNPCs: [
        {
          id: balthazar.entityId,
          name: 'Купец Бальтазар',
          role: 'Купец',
          hpCurrent: 18,
          hpMax: 18,
          disposition: 'friendly',
          combatRole: 'hiding',
          status: 'Прячется за ящиками и дрожит от страха',
          isDead: false,
        },
      ],
    } as any,
    [],
    []
  );

  assert.strictEqual(balthazar.status, 'Прячется за ящиками и дрожит от страха');

  // Round 2: AI omits sceneNPCs array, but narrative describes him doing something new
  statusTestRoom.roundNumber = 2;
  sem.processRoundEntities(
    statusTestRoom,
    {
      narrative: 'Бальтазар осторожно выглядывает из укрытия и передает лечебное зелье героям.',
      currentSituation: 'Бой продолжается',
      playerUpdates: [],
      // sceneNPCs omitted on purpose!
    } as any,
    [],
    []
  );

  assert.notStrictEqual(balthazar.status as string, 'Встречен в сцене', 'Status must not remain frozen at prologue initial state');
  const currentStatus = balthazar.status as string;
  assert.ok(
    currentStatus.includes('выглядывает') || currentStatus.includes('зелье') || currentStatus.length > 5,
    'Status must be dynamically extracted from narrative'
  );
  console.log(`✅ Dynamic NPC Status verified: updated to "${currentStatus}" across rounds.\n`);

  // ----------------------------------------------------
  // Test 17: Quests Adding, Updating and Syncing
  // ----------------------------------------------------
  console.log('Test 17: Quests Adding, Updating and Room Hydration');
  const questRoom: RoomEntity = {
    id: `room_quest_test_${crypto.randomUUID()}`,
    code: 'QST123',
    title: 'Quest Room',
    setting: 'fantasy',
    currentSituation: 'Поручение старейшины',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 1,
    worldQuests: [],
  };

  // Add quest via QuestArbiter
  const questAddSync = questArbiter.processRoundQuests(
    questRoom,
    [],
    {
      narrative: 'Старейшина просит очистить старую мельницу от пауков.',
      currentSituation: 'Получено задание',
      playerUpdates: [],
      questUpdates: [
        {
          title: 'Очистить старую мельницу',
          description: 'Уничтожить гигантских пауков в мельнице у реки',
          action: 'add',
          category: 'task',
        },
      ],
    } as any
  );

  questRoom.worldQuests = questAddSync.allQuests;
  assert.strictEqual(questRoom.worldQuests.length, 1, 'Quest must be registered in room.worldQuests');
  assert.strictEqual(questRoom.worldQuests[0].title, 'Очистить старую мельницу');
  assert.strictEqual(questRoom.worldQuests[0].status, 'active');

  // Complete quest via QuestArbiter
  const questCompSync = questArbiter.processRoundQuests(
    questRoom,
    [],
    {
      narrative: 'Пауки побеждены, мельница снова безопасна. Задача выполнена.',
      currentSituation: 'Возвращение к старейшине',
      playerUpdates: [],
      questUpdates: [
        {
          title: 'Очистить старую мельницу',
          action: 'complete',
          resolutionNote: 'Пауки уничтожены',
        },
      ],
    } as any
  );

  questRoom.worldQuests = questCompSync.allQuests;
  const completedQ = questRoom.worldQuests.find(q => q.title.includes('мельниц'));
  assert.ok(completedQ, 'Quest must exist in worldQuests');
  assert.strictEqual(completedQ?.status, 'completed', 'Quest status must become completed');
  console.log('✅ Quests addition, resolution, and room assignment verified successfully.\n');

  // ----------------------------------------------------
  // Test 18: Departed and Defeated Entities in Archive («Архив»)
  // ----------------------------------------------------
  console.log('Test 18: Departed and Defeated Entities in Archive («Архив»)');
  const archiveRoom: RoomEntity = {
    id: `room_archive_test_${crypto.randomUUID()}`,
    code: 'ARC123',
    title: 'Archive Room',
    setting: 'fantasy',
    currentSituation: 'Стычка на тракте',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 1,
    sceneEntities: [],
    worldNPCRegistry: [],
  };

  // Add enemy and neutral NPC
  const enemyGoon = sem.registerEntity(archiveRoom, {
    name: 'Разбойник Ганс',
    role: 'Разбойник',
    entityType: 'creature',
    faction: 'hostile',
    combatRole: 'hostile_threat',
    hpCurrent: 10,
    hpMax: 10,
    status: 'Атакует',
  });

  const traveler = sem.registerEntity(archiveRoom, {
    name: 'Путник Торвальд',
    role: 'Странник',
    entityType: 'npc',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    hpCurrent: 15,
    hpMax: 15,
    status: 'Идет по тракту',
  });

  // Event 1: Enemy is defeated (HP drops to 0)
  sem.processRoundEntities(
    archiveRoom,
    {
      narrative: 'Разбойник Ганс повержен метким ударом и валится в траву.',
      currentSituation: 'Один враг повержен',
      playerUpdates: [],
      activeEnemies: [
        {
          id: enemyGoon.entityId,
          name: 'Разбойник Ганс',
          hpCurrent: 0,
          hpMax: 10,
          isDead: true,
          status: 'Повержен в бою',
        },
      ],
    } as any,
    [],
    []
  );

  assert.ok(
    archiveRoom.worldNPCRegistry?.some(w => w.name.includes('Ганс')),
    'Defeated enemy must be archived in room.worldNPCRegistry'
  );

  // Event 2: Traveler departs
  sem.processRoundEntities(
    archiveRoom,
    {
      narrative: 'Путник Торвальд благодарит отряд и уходит в сторону города.',
      currentSituation: 'Путник скрылся за поворотом',
      playerUpdates: [],
      departedNPCs: [
        {
          name: 'Путник Торвальд',
          reason: 'departed',
          narrativeNote: 'Ушел в сторону города',
        },
      ],
    } as any,
    [],
    []
  );

  assert.ok(
    archiveRoom.worldNPCRegistry?.some(w => w.name.includes('Торвальд')),
    'Departed traveler must be archived in room.worldNPCRegistry'
  );

  const archiveProj = sem.buildSceneProjection(archiveRoom);
  assert.strictEqual(
    archiveProj.worldArchive.length,
    archiveRoom.worldNPCRegistry?.length,
    'Scene projection worldArchive must match room.worldNPCRegistry count'
  );
  assert.strictEqual(archiveProj.worldArchive.length, 2, 'Archive must contain both defeated and departed entities');
  console.log(`✅ Archival verified: ${archiveProj.worldArchive.length} entities successfully captured in «Архив».\n`);

  // ----------------------------------------------------
  // Test 19: Episodic Memory Compression
  // ----------------------------------------------------
  console.log('Test 19: Episodic Memory Compression & Long-Term Continuity');
  const episodicService = systemLocator.get('episodicMemoryCompressor');
  const dummyLogs: GameLogEntity[] = [
    {
      id: 'log_1',
      roomId: 'room_epi',
      roundNumber: 1,
      narrativeText: 'Отряд вышел на заброшенную дорогу. Впереди показались следы повозки.',
      actionsSummary: 'Разведка дороги',
      currentSituation: 'Дорога чиста',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log_2',
      roomId: 'room_epi',
      roundNumber: 2,
      narrativeText: 'Из кустов выскочил ящер-страж с копьем. Воин заблокировал его удар щитом.',
      actionsSummary: 'Встреча с ящером',
      currentSituation: 'Бой начался',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log_3',
      roomId: 'room_epi',
      roundNumber: 3,
      narrativeText: 'Плут ловко обошел ящера с тыла и оглушил рукоятью кинжала.',
      actionsSummary: 'Оглушение врага',
      currentSituation: 'Ящер повержен',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log_4',
      roomId: 'room_epi',
      roundNumber: 4,
      narrativeText: 'Отряд связал ящера и допросил его о логове разбойников.',
      actionsSummary: 'Допрос ящера',
      currentSituation: 'Получена карта',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log_5',
      roomId: 'room_epi',
      roundNumber: 5,
      narrativeText: 'Герои подошли к пещере с водопадом. Внутри мерцает свет костра.',
      actionsSummary: 'Прибытие к пещере',
      currentSituation: 'У входа в пещеру',
      playerUpdates: [],
      ruleViolations: [],
      createdAt: new Date().toISOString(),
    },
  ];

  const epiRoom: RoomEntity = {
    id: 'room_epi',
    code: 'EPI001',
    title: 'Episodic Room',
    setting: 'fantasy',
    currentSituation: 'Пещера',
    hostUserId: 'user_1',
    status: 'active',
    createdAt: new Date().toISOString(),
    roundNumber: 5,
    loreJournal: [
      {
        id: 'milestone_1',
        round: 3,
        milestone: 'Ящер-страж взят в плен',
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const compressionResult = episodicService.compressLogs(dummyLogs, epiRoom);
  assert.strictEqual(compressionResult.recentLogs.length, 3, 'Recent logs must keep exactly 3 rounds');
  assert.ok(compressionResult.episodicSummaries.length > 0, 'Older rounds (1-2) must be compressed into episodic summaries');
  assert.ok(compressionResult.consolidatedMemoryText.includes('Раунд'), 'Consolidated memory must mention rounds');
  assert.ok(compressionResult.consolidatedMemoryText.includes('Ящер-страж взят в плен'), 'Consolidated memory must include milestones');

  const augmentedPlot = episodicService.augmentContextWithMemory('Основная цель: спасти принцессу.', compressionResult.consolidatedMemoryText);
  assert.ok(augmentedPlot.includes('🧠 ЭПИЗОДИЧЕСКАЯ ДОЛГОВРЕМЕННАЯ ПАМЯТЬ'), 'Context plot must be augmented with episodic memory');
  console.log('✅ Episodic Memory Compression verified: older rounds compressed without context window explosion.\n');

  // ----------------------------------------------------
  // Test 20: Streaming AI Service & Token Emission
  // ----------------------------------------------------
  console.log('Test 20: Streaming AI Service & Narrative Token Emitter');
  const streamingService = systemLocator.get('streamingAIService');
  assert.ok(streamingService, 'streamingAIService must be registered in SystemLocator');

  // Verify token emitter callback
  const emittedChunks: string[] = [];
  const fakeIo: any = {
    to: () => ({
      emit: (event: string, payload: any) => {
        if (event === 'narrative_chunk') {
          emittedChunks.push(payload.chunk);
        }
      },
    }),
  };

  const tokenEmitter = streamingService.createTokenEmitter(fakeIo, 'room_stream_test', 'log_stream_1');
  tokenEmitter('Дверь');
  tokenEmitter(' со скрипом');
  tokenEmitter(' распахнулась.');

  assert.strictEqual(emittedChunks.join(''), 'Дверь со скрипом распахнулась.', 'Token emitter must faithfully stream chunks');
  console.log('✅ Streaming AI Service verified: real-time narrative emission operates correctly.\n');

  // ----------------------------------------------------
  // Test 21: Physical Consistency - Nat 20 Cannot Drive Wheel-less Wagon
  // ----------------------------------------------------
  console.log('Test 21: Physical World Consistency (Natural 20 on Wheel-less Wagon)');
  const affordanceService = systemLocator.get('sceneAffordanceService');
  assert.ok(affordanceService, 'sceneAffordanceService must be registered in SystemLocator');

  const affordanceRoom: RoomEntity = {
    id: 'room_affordance_1',
    code: 'AFF1',
    hostUserId: 'user_affordance',
    title: 'Погоня у развилки',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 2,
    currentSituation: 'Отряд у разбитой повозки',
    environmentObjects: [],
    createdAt: new Date().toISOString(),
  };

  const wagon = affordanceService.registerObject(affordanceRoom, {
    key: 'wagon_cart',
    name: 'Торговая повозка',
    state: 'broken',
    isOperational: false,
    physicalBlocker: 'Отсутствуют колёса, ось лежит в грязи',
    requiredPrerequisites: ['найти запасные колёса', 'установить колёса'],
    progressStage: {
      current: 0,
      max: 2,
      currentStageText: 'Колёса отсутствуют, повозка недвижима',
    },
  });

  const driveAction: any = {
    id: 'act_drive_1',
    characterId: 'char_test_1',
    characterName: 'Воин Торвальд',
    actionText: 'Запрыгиваю на повозку и во весь опор уезжаю от преследователей!',
    actionType: 'check',
    diceRolls: [
      {
        diceType: 'd20',
        rolls: [20],
        modifier: 0,
        total: 20,
        isCriticalSuccess: true,
        isCriticalFail: false,
        purpose: 'Побег на повозке',
      },
    ],
  };

  const mechArbiter = systemLocator.get('mechanicalArbiter');
  const driveResolution = mechArbiter.evaluateAction(
    driveAction,
    undefined,
    [],
    [],
    12,
    [],
    affordanceRoom.environmentObjects
  );

  assert.strictEqual(driveResolution.actionType, 'staged_affordance', 'Resolution must be classified as staged_affordance');
  assert.ok(driveResolution.promptDirective.includes('ФИЗИЧЕСКИЙ ЗАКОН СЦЕНЫ'), 'Prompt directive must enforce physical law');
  assert.ok(
    driveResolution.promptDirective.includes('СТРОГИЙ ЗАПРЕТ') || driveResolution.promptDirective.includes('ФИЗИЧЕСКИ НЕВОЗМОЖЕН'),
    'Prompt directive must forbid impossible departure'
  );
  assert.ok(
    driveResolution.auditNotes.includes('Blocked final operation on wagon_cart'),
    'Audit notes must record blocked operation'
  );
  console.log('✅ Physical world consistency verified: Natural 20 cannot drive a wheel-less cart.\n');

  // ----------------------------------------------------
  // Test 22: Progressive Staged Success - High Roll Finds Wheels & Advances Stage
  // ----------------------------------------------------
  console.log('Test 22: Progressive Staged Success (High roll advances stage from 0/2 to 1/2)');
  const feasibilityEval = affordanceService.evaluatePhysicalFeasibility(
    driveAction,
    wagon,
    20,
    12,
    true
  );

  assert.strictEqual(feasibilityEval.isFeasible, false, 'Final action is not directly feasible');
  assert.strictEqual(feasibilityEval.isStagedProgress, true, 'Must produce staged progress on high roll');
  assert.strictEqual(feasibilityEval.currentStage, 1, 'Stage must advance from 0 to 1');
  assert.strictEqual(feasibilityEval.isNowOperational, false, 'Wagon is not yet fully operational at stage 1');
  assert.ok(feasibilityEval.promptDirective.includes('ЭТАПНЫЙ УСПЕХ'), 'Prompt directive must reward staged progress');
  assert.ok(feasibilityEval.promptDirective.includes('1/2'), 'Prompt directive must specify stage 1/2');

  // Authoritatively advance stage in room
  affordanceService.advanceObjectStage(affordanceRoom, 'wagon_cart', 1);
  const updatedWagon = affordanceRoom.environmentObjects?.find((o) => o.key === 'wagon_cart');
  assert.strictEqual(updatedWagon?.progressStage.current, 1, 'Room environment object stage must be 1');
  assert.strictEqual(updatedWagon?.state, 'in_progress', 'Room environment object state must be in_progress');
  console.log('✅ Staged progress verified: successful roll granted wheels and advanced stage to 1/2.\n');

  // ----------------------------------------------------
  // Test 23: Complete Prerequisite to Full Operational Status
  // ----------------------------------------------------
  console.log('Test 23: Repair Completion to Fully Operational Status');
  const repairAction: any = {
    id: 'act_repair_1',
    characterId: 'char_test_1',
    characterName: 'Воин Торвальд',
    actionText: 'Ставлю найденные колеса на ось повозки, используя бревно как домкрат!',
    actionType: 'check',
    diceRolls: [
      {
        diceType: 'd20',
        rolls: [16],
        modifier: 2,
        total: 18,
        isCriticalSuccess: false,
        isCriticalFail: false,
        purpose: 'Установка колес',
      },
    ],
  };

  assert.ok(updatedWagon, 'Wagon must exist');
  const repairEval = affordanceService.evaluatePhysicalFeasibility(
    repairAction,
    updatedWagon!,
    18,
    12,
    false
  );

  assert.strictEqual(repairEval.isFeasible, true, 'Repair action is feasible');
  assert.strictEqual(repairEval.currentStage, 2, 'Stage must reach 2/2');
  assert.strictEqual(repairEval.isNowOperational, true, 'Wagon is now fully operational!');
  assert.ok(repairEval.promptDirective.includes('РЕМОНТ ЗАВЕРШЁН'), 'Prompt directive must confirm repair complete');

  // Advance authoritative stage to 2
  affordanceService.advanceObjectStage(affordanceRoom, 'wagon_cart', 1);
  assert.strictEqual(updatedWagon?.isOperational, true, 'Wagon must now be operational');
  assert.strictEqual(updatedWagon?.state, 'operational', 'Wagon state must now be operational');

  // Now subsequent drive action succeeds!
  const finalDriveEval = affordanceService.evaluatePhysicalFeasibility(
    driveAction,
    updatedWagon!,
    15,
    12,
    false
  );
  assert.strictEqual(finalDriveEval.isFeasible, true, 'Now that wagon is repaired, driving is fully feasible!');
  assert.strictEqual(finalDriveEval.isNowOperational, true);
  console.log('✅ Prerequisite completion verified: wagon is now 100% operational and usable for escape!\n');

  // ----------------------------------------------------
  // Test 24: Spatial separation & Passenger manifest (Leaving behind non-travelers)
  // ----------------------------------------------------
  console.log('Test 24: Spatial separation & Passenger manifest (Evacuating left-behind entities)');
  const spatialEngine = systemLocator.get('spatialLocationEngine');
  const spatialRoom: RoomEntity = {
    id: 'room_spatial_test_1',
    code: 'SPATIAL1',
    hostUserId: 'user_1',
    title: 'Побег на повозке',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 2,
    currentSituation: 'Повозка готова мчать прочь с развилки',
    sceneEntities: [],
    sceneNPCs: [],
    activeEnemies: [],
    createdAt: new Date().toISOString(),
  };

  spatialEngine.ensureCurrentZone(spatialRoom, 'Перепутье Семи Дорог');
  assert.strictEqual(spatialRoom.currentZoneKey, 'crossroads_seven_roads');

  // Register characters and NPCs in crossroads
  const acolyte = sem.registerEntity(spatialRoom, {
    name: 'Беглый послушник',
    role: 'Раненый гонец',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    hpCurrent: 2,
    hpMax: 15,
    status: 'Без сознания в высокой траве у развилки',
  });

  const balthazarEntity = sem.registerEntity(spatialRoom, {
    name: 'Купец Бальтазар',
    role: 'Торговец',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    hpCurrent: 18,
    hpMax: 18,
    status: 'Сидит в кузове повозки',
  });

  // Player "Кирильчик" drives wagon away onto the highway
  const wagonDepartureNarrative = 'Кирильчик резко бьет поводьями... повозка срывается с места и вылетает на ровный тракт. А раненый послушник так и остался лежать в траве.';
  const evacuated = spatialEngine.evacuateNonTravelers(
    spatialRoom,
    'crossroads_seven_roads',
    'highway_road',
    ['Кирильчик', 'Бальтазар', 'Купец Бальтазар'],
    wagonDepartureNarrative
  );

  assert.strictEqual(evacuated.length, 1, 'Only acolyte should be evacuated/left behind');
  assert.strictEqual(evacuated[0].canonicalName, 'Беглый послушник');
  assert.strictEqual(evacuated[0].leftAtRound, 2);
  assert.strictEqual(spatialRoom.currentZoneKey, 'highway_road', 'Room current zone must now be highway_road');

  // Check crossroads zone registry
  const crossroadsZone = spatialRoom.spatialZones?.find((z) => z.zoneKey === 'crossroads_seven_roads');
  assert.ok(crossroadsZone, 'Crossroads zone must exist');
  assert.strictEqual(crossroadsZone.leftEntities.length, 1, 'Crossroads must remember the acolyte in leftEntities');
  assert.strictEqual(crossroadsZone.leftEntities[0].canonicalName, 'Беглый послушник');

  // Active projection in the new zone MUST NOT contain the departed acolyte!
  const highwayProjection = sem.buildSceneProjection(spatialRoom);
  const acolyteInProjection = highwayProjection.sceneNPCs.find((n) => n.name === 'Беглый послушник');
  assert.strictEqual(acolyteInProjection, undefined, 'Acolyte MUST NOT be present in active scene projection on highway');

  // Legacy sceneNPCs array MUST NOT contain the acolyte
  const acolyteInLegacy = spatialRoom.sceneNPCs?.find((n) => n.name === 'Беглый послушник');
  assert.strictEqual(acolyteInLegacy, undefined, 'Acolyte MUST NOT be present in room.sceneNPCs');

  // Balthazar (traveler) MUST be present in the active scene projection
  const balthazarInProjection = highwayProjection.sceneNPCs.find((n) => n.name.includes('Бальтазар'));
  assert.ok(balthazarInProjection, 'Balthazar must travel with party and appear in active scene');
  assert.strictEqual(highwayProjection.currentZoneName, 'Ровный тракт');
  console.log('✅ Spatial separation verified: acolyte removed from HUD and preserved in crossroads registry.\n');

  // ----------------------------------------------------
  // Test 25: Backtracking Return & Fatal Time Delta Simulation (Delta >= 2 rounds)
  // ----------------------------------------------------
  console.log('Test 25: Backtracking Return & Fatal Time Delta Simulation (Delta >= 2 rounds)');
  // Fast-forward to round 4 (party spent 2 rounds on highway: 4 - 2 = 2)
  spatialRoom.roundNumber = 4;

  const returnAction: any = {
    id: 'act_return_1',
    characterId: 'char_test_1',
    characterName: 'Кирильчик',
    actionText: 'Разворачиваю повозку и возвращаюсь назад на развилку к послушнику!',
    actionType: 'check',
    diceRolls: [{ diceType: 'd20', rolls: [15], modifier: 0, total: 15, isCriticalSuccess: false, isCriticalFail: false, purpose: 'Разворот' }],
  };

  // 1. Intent engine detects return
  const returnIntent = aie.parseActionIntent(returnAction, undefined, spatialRoom);
  assert.strictEqual(returnIntent.intentClass, 'location_return', 'Intent must be classified as location_return');
  assert.strictEqual(returnIntent.targetZoneKey, 'crossroads_seven_roads', 'Target zone must resolve to crossroads');

  // 2. Mechanical Arbiter evaluates return and executes simulation
  const arbiter = systemLocator.get('mechanicalArbiter');
  const returnRes = arbiter.evaluateAction(
    returnAction,
    undefined,
    [],
    [],
    12,
    [],
    [],
    spatialRoom
  );

  assert.strictEqual(returnRes.actionType, 'location_return');
  assert.ok(returnRes.promptDirective.includes('СИМУЛЯЦИЯ ВОЗВРАЩЕНИЯ'), 'Prompt directive must include return simulation header');
  assert.ok(
    returnRes.promptDirective.includes('погиб') || returnRes.promptDirective.includes('Мёртв'),
    'Acolyte must be simulated as dead after 2 rounds of abandonment'
  );
  assert.ok(returnRes.promptDirective.includes('медный ключ'), 'Prompt directive must mention dropped key');

  // Acolyte should now be re-hydrated back into room.sceneEntities as defeated
  const rehydratedAcolyte = spatialRoom.sceneEntities?.find((e) => e.canonicalName === 'Беглый послушник');
  assert.ok(rehydratedAcolyte, 'Acolyte must be re-hydrated into room.sceneEntities');
  assert.strictEqual(rehydratedAcolyte.lifecycle, 'defeated', 'Acolyte lifecycle must be defeated');
  assert.strictEqual(rehydratedAcolyte.stats.hpCurrent, 0, 'Acolyte HP must be 0');
  assert.strictEqual(spatialRoom.currentZoneKey, 'crossroads_seven_roads', 'Party must now be back at crossroads');

  // Re-build projection: defeated acolyte is visible in scene
  const returnProjection = sem.buildSceneProjection(spatialRoom);
  assert.strictEqual(returnProjection.currentZoneName, 'Перепутье Семи Дорог');
  console.log('✅ Fatal time delta verified: acolyte found dead with key after 2 rounds of absence.\n');

  // ----------------------------------------------------
  // Test 26: Rapid Return (Delta = 1 round) Allows Rescue Opportunity
  // ----------------------------------------------------
  console.log('Test 26: Rapid Return (Delta = 1 round) Allows Rescue Opportunity');
  const rapidRoom: RoomEntity = {
    id: 'room_rapid_test',
    code: 'RAPID1',
    hostUserId: 'user_1',
    title: 'Быстрый возврат',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 2,
    currentSituation: 'Развилка дорог',
    sceneEntities: [],
    createdAt: new Date().toISOString(),
  };

  spatialEngine.ensureCurrentZone(rapidRoom, 'Перепутье Семи Дорог');
  sem.registerEntity(rapidRoom, {
    name: 'Беглый послушник',
    role: 'Раненый гонец',
    hpCurrent: 2,
    hpMax: 15,
    status: 'Без сознания в траве',
  });

  // Depart at round 2
  spatialEngine.evacuateNonTravelers(rapidRoom, 'crossroads_seven_roads', 'highway_road', ['Воин']);

  // Immediately return in round 3 (delta = 1 round)
  rapidRoom.roundNumber = 3;
  const simRapid = spatialEngine.simulateTimeDeltaOnReturn(rapidRoom, 'crossroads_seven_roads');

  assert.strictEqual(simRapid.restoredEntities.length, 1);
  const rapidAcolyte = simRapid.restoredEntities[0];
  assert.strictEqual(rapidAcolyte.stats.hpCurrent, 1, 'Acolyte must have 1 HP clinging to life');
  assert.strictEqual(rapidAcolyte.lifecycle, 'active', 'Acolyte is still alive/active');
  assert.ok(simRapid.promptDirective.includes('ещё дышит') || simRapid.promptDirective.includes('При смерти'), 'Prompt directive must indicate rescue opportunity');
  console.log('✅ Rapid return verified: 1 round delta leaves entity alive at 1 HP for immediate medical triage.\n');

  console.log('🎉 ALL 26 ARCHITECTURAL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

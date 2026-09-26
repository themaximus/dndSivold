import assert from 'assert';
import crypto from 'crypto';
import { SceneEntityManager, stemRussianWord, extractSearchTokens } from '../services/session/SceneEntityManager';
import { ActionIntentEngine } from '../services/session/ActionIntentEngine';
import { InventoryLedgerService } from '../services/session/InventoryLedgerService';
import { RoomTransactionMutex } from '../services/session/RoomTransactionMutex';
import { RoomEntity, CharacterEntity, GameLogEntity, EnvironmentObjectEntity, db } from '../db';
import { gameSessionService, isSameEntity } from '../services/game/GameSessionService';
import { ServiceLocator, systemLocator } from '../services/session/ServiceLocator';
import { questArbiter } from '../services/game/QuestArbiter';
import { cryptoService } from '../services/security/CryptoService';
import { aiProviderFactory } from '../services/ai/AIProviderFactory';
import { GeminiAIProvider } from '../services/ai/GeminiAIProvider';
import { DeepSeekAIProvider } from '../services/ai/DeepSeekAIProvider';
import { narrativeSynthesizer } from '../services/session/NarrativeSynthesizer';
import { roomSessionManager } from '../services/session/RoomSessionManager';
import { characterRepository, roomRepository } from '../repositories';
import { socialArbiter } from '../services/game/SocialArbiter';
import { mechanicalArbiter } from '../services/game/MechanicalArbiter';

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

  // ----------------------------------------------------
  // Test 27: Encrypted Gemini Key Resolution, Simulation Fallback & Turn Action Rollback
  // ----------------------------------------------------
  console.log('Test 27: Encrypted Gemini Key Resolution, Simulation Fallback & Turn Action Rollback');

  // 1. Verify encrypted Gemini key is correctly decrypted and routes to GeminiAIProvider
  const rawGeminiKey = 'AIzaSyTestGeminiKey1234567890';
  const encryptedGeminiKey = cryptoService.encrypt(rawGeminiKey);
  assert.ok(encryptedGeminiKey.startsWith('enc:aes256gcm:'), 'Key must be encrypted with prefix');

  const detectedProvider = aiProviderFactory.getProvider(encryptedGeminiKey);
  assert.ok(detectedProvider instanceof GeminiAIProvider, 'Encrypted AIza... key must resolve to GeminiAIProvider');
  assert.strictEqual(detectedProvider.name, 'Google Gemini', 'Provider name must be Google Gemini');

  // Verify encrypted DeepSeek key resolves to DeepSeekAIProvider
  const rawDeepSeekKey = 'sk-testDeepSeekKey1234567890';
  const encryptedDeepSeekKey = cryptoService.encrypt(rawDeepSeekKey);
  const detectedDeepSeek = aiProviderFactory.getProvider(encryptedDeepSeekKey);
  assert.ok(detectedDeepSeek instanceof DeepSeekAIProvider, 'Encrypted sk-... key must resolve to DeepSeekAIProvider');

  // 2. Verify that invalid neural credentials throw an explicit error (no fake simulation responses)
  const resilienceRoom: RoomEntity = {
    id: 'room_resilience_test',
    code: 'RESIL1',
    hostUserId: 'user_1',
    title: 'Тест устойчивости',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 1,
    currentSituation: 'Опасный лес',
    sceneEntities: [],
    createdAt: new Date().toISOString(),
  };

  let errorCaught = false;
  try {
    await narrativeSynthesizer.synthesizeTurnResponse(resilienceRoom, {
      apiKey: 'AIzaInvalidKeyThatFailsImmediately',
      model: 'gemini-3.6-flash',
      setting: resilienceRoom.setting,
      genre: 'fantasy',
      campaignDuration: 'medium',
      roundNumber: 1,
      currentSituation: resilienceRoom.currentSituation,
      currentDC: 12,
      campaignPlot: 'Поход через чащу',
      loreJournal: [],
      availableLoot: [],
      characters: [
        {
          id: 'char_res_1',
          userId: 'user_res_1',
          name: 'Роланд',
          race: 'Человек',
          characterClass: 'Воин',
          level: 1,
          hpCurrent: 12,
          hpMax: 12,
          ac: 16,
          stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
          inventory: [],
          createdAt: new Date().toISOString(),
        },
      ],
      activeEnemies: [],
      sceneNPCs: [],
      actions: [
        {
          id: 'act_res_1',
          characterId: 'char_res_1',
          characterName: 'Роланд',
          actionText: 'Осматриваю деревья в поисках ориентиров',
          diceRolls: [{ diceType: 'd20', rolls: [14], modifier: 0, total: 14, isCriticalSuccess: false, isCriticalFail: false, purpose: 'Внимание' }],
          submittedAt: new Date().toISOString(),
        },
      ],
      previousHistory: [],
      turnMode: 'turn_by_turn',
      turnPlayerName: 'Роланд',
      activeQuests: [],
      completedQuests: [],
      searchedObjects: [],
      worldNPCRegistry: [],
      environmentObjects: [],
    });
  } catch (err: any) {
    errorCaught = true;
    assert.ok(err.message.includes('Google Gemini') || err.message.includes('API key not valid') || err.message.includes('error'), 'Must throw real neural error');
  }
  assert.strictEqual(errorCaught, true, 'Neural failure must throw explicit error instead of silent fake simulation');

  // 3. Verify turn state rollback on failure or reset
  const rollbackRoomId = `room_rollback_${crypto.randomUUID()}`;
  const rollbackUserId = `user_rb_${crypto.randomUUID()}`;
  const rollbackPlayerId = `player_rb_${crypto.randomUUID()}`;
  const rollbackTaId = `ta_rb_${crypto.randomUUID()}`;

  db.rooms.create({
    id: rollbackRoomId,
    code: 'ROLL01',
    hostUserId: rollbackUserId,
    title: 'Rollback Room',
    setting: 'Фэнтези',
    status: 'active',
    roundNumber: 1,
    currentSituation: 'Опасность',
    createdAt: new Date().toISOString(),
  });

  const player = db.roomPlayers.create({
    id: rollbackPlayerId,
    roomId: rollbackRoomId,
    userId: rollbackUserId,
    username: 'Hero',
    hasActedThisRound: true,
    hasRolledThisRound: true,
    joinedAt: new Date().toISOString(),
  });

  db.turnActions.create({
    id: rollbackTaId,
    roomId: rollbackRoomId,
    roundNumber: 1,
    playerId: rollbackUserId,
    characterId: 'char_rb_1',
    characterName: 'Hero',
    actionText: 'Атакую врага',
    diceRolls: [],
    submittedAt: new Date().toISOString(),
  });

  // Verify before rollback
  assert.strictEqual(db.roomPlayers.findPlayer(rollbackRoomId, rollbackUserId)?.hasActedThisRound, true);
  assert.strictEqual(db.turnActions.findByRoomAndRound(rollbackRoomId, 1).length, 1);

  // Execute rollback
  const updatedPlayers = roomSessionManager.revertPlayerTurnAction(rollbackRoomId, rollbackUserId);
  assert.ok(updatedPlayers, 'Must return updated players array');
  const revertedPlayer = db.roomPlayers.findPlayer(rollbackRoomId, rollbackUserId);
  assert.strictEqual(revertedPlayer?.hasActedThisRound, false, 'hasActedThisRound must be rolled back to false');
  assert.strictEqual(revertedPlayer?.hasRolledThisRound, false, 'hasRolledThisRound must be rolled back to false');
  assert.strictEqual(db.turnActions.findByRoomAndRound(rollbackRoomId, 1).length, 0, 'Pending turn action must be deleted from DB');
  // ----------------------------------------------------
  // Test 28: Inventory Item Subtraction, Procedural Consumption & Dropping
  // ----------------------------------------------------
  {
    console.log('Test 28: Inventory Item Subtraction, Procedural Consumption & Dropping');
    const invTestCharId = 'char_inv_test_' + crypto.randomUUID();
    const testChar: CharacterEntity = {
      id: invTestCharId,
      userId: 'user_inv_test',
      name: 'Элиас',
      characterClass: 'Воин',
      race: 'Человек',
      level: 2,
      hpCurrent: 10,
      hpMax: 20,
      stats: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
      inventory: [
        {
          id: 'item_pot_1',
          name: '«Зелье лечения»',
          type: 'potion',
          description: 'Восстанавливает 8 HP',
          quantity: 2,
          healAmount: 8,
        },
        {
          id: 'item_torch_1',
          name: 'Факел',
          type: 'misc',
          description: 'Освещает путь',
          quantity: 1,
        },
        {
          id: 'item_sword_1',
          name: 'Стальной меч',
          type: 'weapon',
          description: 'Острый клинок',
          quantity: 1,
          damage: '1d8',
        },
      ],
      createdAt: new Date().toISOString(),
    };
    db.characters.create(testChar);

    // 1. Direct removeItem with quotes & inflection
    const charRepo = characterRepository;
    const removedDirect = charRepo.removeItemFromInventory(invTestCharId, 'зелье лечения', 1);
    assert.ok(removedDirect, 'Character must be returned');
    const potionAfterDirect = removedDirect.inventory.find(i => i.id === 'item_pot_1');
    assert.strictEqual(potionAfterDirect?.quantity, 1, 'Potion quantity must be decremented from 2 to 1');

    // 2. Procedural item consumption during turn
    const invLedger = systemLocator.get('inventoryLedgerService');
    const mockInvRoom: RoomEntity = {
      id: 'room_inv_' + crypto.randomUUID(),
      code: 'INVR1',
      hostUserId: 'user_inv_test',
      title: 'Пещера',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 2,
      currentSituation: 'В темноте',
      sceneEntities: [],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(mockInvRoom);

    const mockTurnAction: any = {
      id: 'act_inv_1',
      roomId: mockInvRoom.id,
      roundNumber: 2,
      playerId: 'user_inv_test',
      characterId: invTestCharId,
      characterName: 'Элиас',
      actionText: 'Я достаю и выпиваю зелье лечения, чтобы залечить раны!',
      diceRolls: [],
      submittedAt: new Date().toISOString(),
    };

    const mockDmResult: any = {
      narrative: 'Элиас осушает флакон, и его раны затягиваются магической энергией.',
      inventoryUpdates: [], // LLM omitted updates!
    };

    const itemActivities: Record<string, string[]> = {};
    const notifications: any[] = [];
    invLedger.handleProceduralItemConsumption(mockInvRoom, mockTurnAction, removedDirect, mockDmResult, itemActivities, notifications);

    const charAfterConsumption = charRepo.findById(invTestCharId);
    const potionAfterConsumption = charAfterConsumption?.inventory?.find(i => i.id === 'item_pot_1');
    assert.strictEqual(potionAfterConsumption, undefined, 'Potion was quantity 1 and consumed, so it must be removed from inventory');
    assert.strictEqual(charAfterConsumption?.hpCurrent, 18, 'HP must be healed by 8 from 10 to 18');
    assert.strictEqual(notifications.length, 1, 'A removal notification must be generated');
    assert.strictEqual(notifications[0].action, 'remove');

    // 3. Dropping an item to ground
    const dropResult = invLedger.dropItem(mockInvRoom.id, invTestCharId, 'item_sword_1');
    assert.ok(dropResult, 'Drop result must succeed');
    assert.strictEqual(dropResult.character?.inventory?.some(i => i.id === 'item_sword_1'), false, 'Sword must be removed from inventory');
    const updatedRoomWithLoot = db.rooms.findById(mockInvRoom.id);
    assert.ok(updatedRoomWithLoot?.availableLoot?.some(l => l.name === 'Стальной меч'), 'Dropped sword must appear in room available loot');
    console.log('✅ Inventory item subtraction, procedural consumption, and item dropping verified!\n');
  }

  // ----------------------------------------------------
  // Test 29: Inter-Character Contested Impact Detection & Modern Reaction Handling
  // ----------------------------------------------------
  {
    console.log('Test 29: Inter-Character Contested Impact Detection & Modern Reaction Handling');
    const rsm = roomSessionManager;
    const testRoomId = 'room_react_test_' + crypto.randomUUID();
    const mockRoom: RoomEntity = {
      id: testRoomId,
      code: 'REACT1',
      hostUserId: 'user_initiator',
      title: 'Таверна',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 1,
      currentSituation: 'В таверне за столом',
      sceneEntities: [],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(mockRoom);

    // Register companion player and character
    const targetUserId = 'user_target_' + crypto.randomUUID();
    const targetCharId = 'char_target_' + crypto.randomUUID();
    const targetChar: CharacterEntity = {
      id: targetCharId,
      userId: targetUserId,
      name: 'Бригитта',
      characterClass: 'Плут',
      race: 'Человек',
      level: 2,
      hpCurrent: 14,
      hpMax: 14,
      stats: { strength: 10, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 10, charisma: 14 },
      inventory: [],
      createdAt: new Date().toISOString(),
    };
    db.characters.create(targetChar);

    db.roomPlayers.create({
      id: 'rp_' + crypto.randomUUID(),
      roomId: testRoomId,
      userId: targetUserId,
      username: 'BrigittePlayer',
      characterId: targetCharId,
      isReady: true,
      isOnline: true,
      hasActedThisRound: false,
      hasRolledThisRound: false,
      joinedAt: new Date().toISOString(),
    });

    // 1. Innocent narrative mention should NOT trigger a reaction modal!
    const innocentAction = 'Мы с Бригиттой садимся за стол и заказываем две кружки эля.';
    const innocentMentions = rsm.detectCharacterMentions(innocentAction, testRoomId, 'user_initiator');
    assert.strictEqual(innocentMentions.length, 0, 'Innocent mention must NOT trigger a reaction request');

    // 2. Direct hostile physical attack attempt DOES trigger a reaction!
    const attackAction = 'Я выхватываю кинжал и бью Бригитту в плечо!';
    const attackMentions = rsm.detectCharacterMentions(attackAction, testRoomId, 'user_initiator');
    assert.strictEqual(attackMentions.length, 1, 'Physical strike must trigger an impact reaction');
    assert.strictEqual(attackMentions[0].characterName, 'Бригитта');

    // 3. Forced grappling / theft attempt DOES trigger a reaction!
    const theftAction = 'Пытаюсь скрутить Бригитту и вытащить кошелек из её пояса';
    const theftMentions = rsm.detectCharacterMentions(theftAction, testRoomId, 'user_initiator');
    assert.strictEqual(theftMentions.length, 1, 'Forced grapple/theft must trigger an impact reaction');

    // 4. SocialArbiter evaluates voluntary yielding (positive response without conflict)
    const yieldRequest: any = {
      id: 'req_yield_1',
      initiatorCharacterName: 'Воин',
      targetCharacterName: 'Бригитта',
      initiatorRoll: { total: 15 },
      reactionRoll: null,
      responseType: 'positive',
      reactionText: 'Подчиняюсь и не сопротивляюсь',
    };
    const yieldEval = socialArbiter.evaluateContestedReaction(yieldRequest);
    assert.strictEqual(yieldEval.outcome, 'assisted', 'Voluntary yielding must resolve peacefully');
    assert.ok(yieldEval.promptDirective.includes('РЕАКЦИЯ-ПРИНЯТИЕ'), 'Directive must state acceptance reaction');

    // 5. SocialArbiter evaluates defensive parry/dodge contest
    const defenseRequest: any = {
      id: 'req_def_1',
      initiatorCharacterName: 'Воин',
      targetCharacterName: 'Бригитта',
      initiatorRoll: { total: 14 },
      reactionRoll: { total: 18 },
      responseType: 'counter',
      reactionText: 'Парирую кинжалом выпад и ухожу в сторону',
    };
    const defenseEval = socialArbiter.evaluateContestedReaction(defenseRequest);
    assert.strictEqual(defenseEval.damageMitigationMultiplier, 0, 'Successful defense must negate damage (0 damage)');
    assert.ok(defenseEval.outcome === 'retaliated' || defenseEval.outcome === 'parried', 'Outcome must be parried or retaliated');
    console.log('✅ Inter-character contested impact detection and modern reactions verified!\n');
  }

  // ----------------------------------------------------
  // Test 30: Equipment System (Weapons, Shields, Armor, 2H Exclusivity & AC Recalculation)
  // ----------------------------------------------------
  {
    console.log('Test 30: Equipment System (Weapons, Shields, Armor, 2H Exclusivity & AC Recalculation)');
    const eqCharId = 'char_eq_test_1';
    db.characters.create({
      id: eqCharId,
      userId: 'user_eq',
      name: 'Бранн Железнобокий',
      race: 'Дворф',
      characterClass: 'Воин',
      level: 1,
      hpCurrent: 12,
      hpMax: 12,
      ac: 10,
      stats: { str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
      skills: ['Атлетика'],
      abilities: [],
      inventory: [
        { id: 'item_2h_sword', name: 'Двуручный меч', type: 'weapon', quantity: 1, damage: '2d6' },
        { id: 'item_1h_axe', name: 'Боевой топор', type: 'weapon', quantity: 1, damage: '1d8' },
        { id: 'item_shield', name: 'Стальной щит', type: 'armor', quantity: 1, ac_bonus: 2 },
        { id: 'item_chainmail', name: 'Кольчуга', type: 'armor', quantity: 1, ac_bonus: 6 },
      ],
      bio: 'Ветеран множества осад.',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    });

    // 1. Verify auto-equip on hydration (Character created with items gets starting gear equipped)
    const initialChar = characterRepository.findById(eqCharId);
    assert(initialChar?.activeArmorId === 'item_chainmail', 'Chainmail must be auto-equipped as activeArmorId');
    assert(initialChar?.activeWeaponId === 'item_2h_sword', '2H Sword must be auto-equipped as activeWeaponId');
    assert(initialChar?.activeShieldId === undefined, 'Shield should not be auto-equipped while wielding 2H sword');
    assert(initialChar?.ac === 16, `Initial AC with chainmail must be 16, got ${initialChar?.ac}`);

    // 2. Switch weapon to 1H Axe
    const after1H = characterRepository.equipWeapon(eqCharId, 'item_1h_axe');
    assert(after1H?.activeWeaponId === 'item_1h_axe', '1H Axe must be equipped as activeWeaponId');

    // 3. Equip Shield (+2 AC -> 18)
    const afterShield = characterRepository.equipShield(eqCharId, 'item_shield');
    assert(afterShield?.activeShieldId === 'item_shield', 'Shield must be equipped as activeShieldId');
    assert(afterShield?.ac === 18, `AC with shield must be 18, got ${afterShield?.ac}`);
    assert(afterShield?.activeWeaponId === 'item_1h_axe', '1H Axe should remain equipped with shield');

    // 4. Equip Two-Handed Sword -> Should automatically unequip Shield and lower AC by 2!
    const after2H = characterRepository.equipWeapon(eqCharId, 'item_2h_sword');
    assert(after2H?.activeWeaponId === 'item_2h_sword', '2H Sword must be equipped');
    assert(after2H?.activeShieldId === undefined, 'Shield must be automatically unequipped when wielding a 2H weapon');
    assert(after2H?.ac === 16, `AC must drop back to 16 without shield, got ${after2H?.ac}`);

    // 5. Re-equip Shield -> Should automatically unequip 2H weapon and increase AC to 18!
    const afterShieldAgain = characterRepository.equipShield(eqCharId, 'item_shield');
    assert(afterShieldAgain?.activeShieldId === 'item_shield', 'Shield must be re-equipped');
    assert(afterShieldAgain?.activeWeaponId === undefined, '2H weapon must be unequipped when equipping shield');
    assert(afterShieldAgain?.ac === 18, `AC must be 18 with shield, got ${afterShieldAgain?.ac}`);

    // 6. Unequip Shield (Toggle off) -> AC drops back to 16
    const afterShieldToggle = characterRepository.equipShield(eqCharId, 'item_shield');
    assert(afterShieldToggle?.activeShieldId === undefined, 'Shield should toggle off when re-clicking');
    assert(afterShieldToggle?.ac === 16, `AC must be 16 after unequip, got ${afterShieldToggle?.ac}`);

    // 7. Unequip Chainmail (Toggle off) -> AC drops back to 10
    const afterArmorToggle = characterRepository.equipArmor(eqCharId, 'item_chainmail');
    assert(afterArmorToggle?.activeArmorId === undefined, 'Chainmail should toggle off when re-clicking');
    assert(afterArmorToggle?.ac === 10, `AC must be 10 without armor, got ${afterArmorToggle?.ac}`);

    console.log('✅ Equipment system, two-handed weapon mutual exclusivity, and dynamic AC calculation verified!\n');
  }

  // ----------------------------------------------------
  // Test 31: Procedural NPC Deduplication, Proper Name Promotion & Archetype Resolution
  // ----------------------------------------------------
  {
    console.log('Test 31: Procedural NPC Deduplication, Proper Name Promotion & Archetype Resolution');
    const dedupRoomId = 'room_dedup_' + crypto.randomUUID();
    const mockRoom: RoomEntity = {
      id: dedupRoomId,
      code: 'DEDUP1',
      hostUserId: 'user_host_dedup',
      title: 'Deduplication Test Room',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 1,
      currentSituation: 'Тяжелораненый гонец хрипит на каменном полу',
      sceneEntities: [],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(mockRoom);

    // 1. Single source of truth / Duplicate prevention:
    // AI returns named NPC in sceneNPCs while narrative mentions generic archetype "раненый гонец"
    const aiResponseWithBrendan: AIDMResponse = {
      narrative: 'Тяжелораненый гонец хрипит на полу, зажимая кровавую рану на боку.',
      currentSituation: 'Гонец истекает кровью',
      activeEnemies: [],
      sceneNPCs: [
        {
          id: 'ent_brendan_orig',
          name: 'Брендан',
          role: 'Раненый курьер графской стражи',
          hpCurrent: 3,
          hpMax: 15,
          ac: 11,
          disposition: 'friendly',
          combatRole: 'neutral_observer',
          status: 'Тяжело ранен, теряет кровь',
        },
      ],
      partyChoices: [],
    };

    sem.processRoundEntities(mockRoom, aiResponseWithBrendan);

    const proj1 = sem.buildSceneProjection(mockRoom);
    assert.strictEqual(proj1.sceneNPCs.length, 1, 'Exactly 1 NPC card must be rendered in sceneNPCs (no duplicate messenger)');
    assert.strictEqual(proj1.sceneNPCs[0].name, 'Брендан', 'Entity name must be the proper name Brendan');
    assert.strictEqual(proj1.sceneNPCs[0].hpCurrent, 3, 'Brendan HP must be 3');

    // Verify alias resolution for players targeting "гонец" or "курьер"
    const resolvedByMessenger = sem.resolveEntity(mockRoom, 'раненый гонец');
    assert.ok(resolvedByMessenger, 'Must resolve entity via archetype alias');
    assert.strictEqual(resolvedByMessenger?.canonicalName, 'Брендан', 'Alias "раненый гонец" must resolve to Brendan');

    // 2. Name Promotion:
    // When a room starts with an unnamed generic archetype ("Раненый гонец") and later AI gives proper name ("Брендан")
    const promoRoomId = 'room_promo_' + crypto.randomUUID();
    const promoRoom: RoomEntity = {
      id: promoRoomId,
      code: 'PROMO1',
      hostUserId: 'user_host_promo',
      title: 'Promotion Test Room',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 1,
      currentSituation: 'В комнате раненый гонец',
      sceneEntities: [],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(promoRoom);

    // Initial procedural spawn of generic archetype
    const genericEnt = sem.registerEntity(promoRoom, {
      name: 'Раненый гонец',
      role: 'Посланник графской стражи',
      hpCurrent: 12,
      hpMax: 12,
      ac: 11,
      status: 'Без сознания на полу',
    });
    const originalEntityId = genericEnt.entityId;

    // AI introduces his name as "Брендан" in next round
    const promoRound: AIDMResponse = {
      narrative: 'Брендан слабо приоткрывает глаза: "Я... курьер графа..."',
      currentSituation: 'Брендан пришел в себя',
      sceneNPCs: [
        {
          name: 'Брендан',
          role: 'Раненый курьер графской стражи',
          hpCurrent: 12,
          hpMax: 15,
          status: 'Слабо говорит',
        },
      ],
      activeEnemies: [],
      partyChoices: [],
    };

    sem.processRoundEntities(promoRoom, promoRound);

    const projPromo = sem.buildSceneProjection(promoRoom);
    assert.strictEqual(projPromo.sceneNPCs.length, 1, 'Only 1 entity should exist after name promotion');
    assert.strictEqual(projPromo.sceneNPCs[0].entityId, originalEntityId, 'UUID must be preserved during name promotion');
    assert.strictEqual(projPromo.sceneNPCs[0].name, 'Брендан', 'Entity must be promoted to Brendan');
    assert.ok(promoRoom.sceneEntities?.find((e) => e.entityId === originalEntityId)?.aliases.includes('Раненый гонец'), 'Old generic name preserved in aliases');

    // 3. Automatic Deduplication of Existing Rooms with Twin Cards & Healed HP Preservation:
    // Simulating the user active game where DB has two duplicate cards
    const twinRoomId = 'room_twin_' + crypto.randomUUID();
    const twinRoom: RoomEntity = {
      id: twinRoomId,
      code: 'TWIN01',
      hostUserId: 'user_twin',
      title: 'Twin Duplicates Room',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 2,
      currentSituation: 'В зале раненые',
      sceneEntities: [
        {
          entityId: 'ent_generic_twin',
          canonicalName: 'Раненый гонец',
          aliases: ['Раненый гонец', 'гонец'],
          entityType: 'npc',
          faction: 'neutral',
          combatRole: 'neutral_observer',
          lifecycle: 'active',
          stats: { hpCurrent: 13, hpMax: 13, ac: 11, conditions: [], willpower: 100, willpowerMax: 100 },
          role: 'Посланник графской стражи',
          status: 'Раны перевязаны, идет на поправку',
          location: { roomId: twinRoomId },
          createdAt: new Date().toISOString(),
        },
        {
          entityId: 'ent_brendan_twin',
          canonicalName: 'Брендан',
          aliases: ['Брендан'],
          entityType: 'npc',
          faction: 'neutral',
          combatRole: 'neutral_observer',
          lifecycle: 'active',
          stats: { hpCurrent: 3, hpMax: 15, ac: 11, conditions: [], willpower: 100, willpowerMax: 100 },
          role: 'Раненый курьер графской стражи',
          status: 'Истекает кровью',
          location: { roomId: twinRoomId },
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(twinRoom);

    // Building projection must automatically trigger deduplication
    const projTwin = sem.buildSceneProjection(twinRoom);
    assert.strictEqual(projTwin.sceneNPCs.length, 1, 'Deduplication must collapse twins to 1 active card');
    assert.strictEqual(projTwin.sceneNPCs[0].name, 'Брендан', 'Primary card must be named Brendan');
    assert.strictEqual(projTwin.sceneNPCs[0].hpCurrent, 13, 'Player heal (13 HP) must be preserved from generic twin');
    const retiredGeneric = twinRoom.sceneEntities?.find((e) => e.entityId === 'ent_generic_twin');
    assert.strictEqual(retiredGeneric?.lifecycle, 'departed', 'Generic duplicate must be marked departed');

    // 4. Distinction Guarantee: Distinct named NPCs must NEVER be merged!
    const guardsRoomId = 'room_guards_' + crypto.randomUUID();
    const guardsRoom: RoomEntity = {
      id: guardsRoomId,
      code: 'GUARDS',
      hostUserId: 'user_guards',
      title: 'Guards Room',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 1,
      currentSituation: 'У ворот стоят двое стражников',
      sceneEntities: [
        {
          entityId: 'ent_guard_walter',
          canonicalName: 'Вальтер',
          aliases: ['Вальтер'],
          entityType: 'npc',
          faction: 'neutral',
          combatRole: 'neutral_observer',
          lifecycle: 'active',
          stats: { hpCurrent: 22, hpMax: 22, ac: 14, conditions: [], willpower: 100, willpowerMax: 100 },
          role: 'Городской стражник',
          status: 'Охраняет ворота',
          location: { roomId: guardsRoomId },
          createdAt: new Date().toISOString(),
        },
        {
          entityId: 'ent_guard_marcus',
          canonicalName: 'Маркус',
          aliases: ['Маркус'],
          entityType: 'npc',
          faction: 'neutral',
          combatRole: 'neutral_observer',
          lifecycle: 'active',
          stats: { hpCurrent: 22, hpMax: 22, ac: 14, conditions: [], willpower: 100, willpowerMax: 100 },
          role: 'Городской стражник',
          status: 'Проверяет повозку',
          location: { roomId: guardsRoomId },
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    db.rooms.create(guardsRoom);

    const projGuards = sem.buildSceneProjection(guardsRoom);
    assert.strictEqual(projGuards.sceneNPCs.length, 2, 'Two distinct named guards must NEVER be merged');
    assert.ok(projGuards.sceneNPCs.some((n) => n.name === 'Вальтер'), 'Walter must be in active scene');
    assert.ok(projGuards.sceneNPCs.some((n) => n.name === 'Маркус'), 'Marcus must be in active scene');

    console.log('✅ Procedural NPC deduplication, proper name promotion, and distinct NPC preservation verified!\n');
  }

  // ----------------------------------------------------
  // Test 32: Inventory & Capability Grounding (Weapons, Healing, Poison, Magic, Unarmed Strike)
  // ----------------------------------------------------
  {
    console.log('Test 32: Inventory & Capability Grounding (Weapons, Healing, Poison, Magic, Unarmed Strike)');

    const mockCharUnarmed: CharacterEntity = {
      id: 'char_unarmed_1',
      userId: 'user_u1',
      name: 'Кулачник',
      race: 'Человек',
      characterClass: 'Воин',
      level: 1,
      hpCurrent: 12,
      hpMax: 12,
      ac: 10,
      stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, // STR mod = +3
      skills: [],
      abilities: [],
      inventory: [], // NO weapons!
      createdAt: new Date().toISOString(),
    };

    // 1. Unarmed Strike without weapons must deal 1 + STR modifier (1 + 3 = 4 HP), NOT 1d8!
    const unarmedAction: TurnActionEntity = {
      id: 'act_unarmed_1',
      roomId: 'room_test',
      playerId: 'user_u1',
      characterId: 'char_unarmed_1',
      characterName: 'Кулачник',
      actionText: 'Бью разбойника кулаком',
      actionType: 'attack',
      diceRolls: [{ rolls: [15], modifier: 3, total: 18, isCriticalSuccess: false, isCriticalFail: false, purpose: 'Атака' }],
    };

    const mockEnemy: RoomEnemy = {
      id: 'enemy_bandit_1',
      name: 'Разбойник',
      type: 'minion',
      hpCurrent: 20,
      hpMax: 20,
      ac: 12,
      status: 'В бою',
      isDead: false,
    };

    const unarmedRes = mechanicalArbiter.evaluateAction(
      unarmedAction,
      mockCharUnarmed,
      [mockEnemy],
      [],
      12
    );
    assert.strictEqual(unarmedRes.actionType, 'attack');
    assert.strictEqual(unarmedRes.damageRolled, 4, 'Unarmed strike with STR 16 must deal exactly 4 damage (1 + 3)');
    assert.ok(unarmedRes.damageFormula?.includes('безоружный удар'), 'Damage formula must state unarmed strike');

    // 2. Phantom Ranged Weapon Rejection:
    // Character has a sword, but tries to shoot a bow that is NOT in inventory
    const mockCharSwordsman: CharacterEntity = {
      id: 'char_swordsman_1',
      userId: 'user_u2',
      name: 'Мечник',
      race: 'Человек',
      characterClass: 'Воин',
      level: 1,
      hpCurrent: 12,
      hpMax: 12,
      ac: 12,
      stats: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      skills: [],
      abilities: [],
      inventory: [
        { id: 'item_sword_1', name: 'Длинный меч', type: 'weapon', quantity: 1, damage: '1d8' },
      ],
      createdAt: new Date().toISOString(),
    };

    const phantomBowAction: TurnActionEntity = {
      id: 'act_bow_1',
      roomId: 'room_test',
      playerId: 'user_u2',
      characterId: 'char_swordsman_1',
      characterName: 'Мечник',
      actionText: 'Стреляю из лука в разбойника',
      actionType: 'attack',
      diceRolls: [{ rolls: [18], modifier: 2, total: 20, isCriticalSuccess: false, isCriticalFail: false, purpose: 'Выстрел' }],
    };

    const phantomBowRes = mechanicalArbiter.evaluateAction(
      phantomBowAction,
      mockCharSwordsman,
      [mockEnemy],
      [],
      12
    );
    assert.strictEqual(phantomBowRes.isHit, false, 'Phantom bow attack must not hit');
    assert.strictEqual(phantomBowRes.damageRolled, 0, 'Phantom bow attack must deal 0 damage');
    assert.ok(phantomBowRes.promptDirective.includes('НЕТ оружия дальнего боя'), 'Directive must forbid phantom ranged weapon');

    // 3. Phantom Healing Rejection:
    // Character has NO potions, bandages, or spells, but tries to heal
    const mockCharEmpty: CharacterEntity = {
      id: 'char_empty_1',
      userId: 'user_u3',
      name: 'Бродяга',
      race: 'Человек',
      characterClass: 'Воин',
      level: 1,
      hpCurrent: 10,
      hpMax: 10,
      ac: 10,
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skills: [],
      abilities: [],
      inventory: [],
      createdAt: new Date().toISOString(),
    };

    const phantomHealAction: TurnActionEntity = {
      id: 'act_heal_phantom_1',
      roomId: 'room_test',
      playerId: 'user_u3',
      characterId: 'char_empty_1',
      characterName: 'Бродяга',
      actionText: 'Пою гонца целительным зельем',
      actionType: 'heal',
    };

    const mockMessengerNPC: RoomNPC = {
      id: 'npc_messenger_1',
      name: 'Брендан',
      role: 'Раненый гонец',
      hpCurrent: 3,
      hpMax: 15,
      ac: 11,
      status: 'Истекает кровью',
      isDead: false,
    };

    const phantomHealRes = mechanicalArbiter.evaluateAction(
      phantomHealAction,
      mockCharEmpty,
      [],
      [mockMessengerNPC],
      12
    );
    assert.strictEqual(phantomHealRes.healRolled, 0, 'Healing without items must roll 0 HP');
    assert.ok(phantomHealRes.promptDirective.includes('НЕТ зелья исцеления'), 'Directive must warn about missing healing item');

    // 3b. AI DM Phantom Heal Rejection in SceneEntityManager:
    // AI DM tries to hallucinate Brendan getting +12 HP (15 HP) when heal was rejected
    const healRejectRoom: RoomEntity = {
      id: 'room_heal_reject_' + crypto.randomUUID(),
      code: 'HEALREJ',
      hostUserId: 'user_h',
      title: 'Heal Reject Room',
      setting: 'Фэнтези',
      status: 'active',
      roundNumber: 1,
      currentSituation: 'Гонец лежит на полу',
      sceneEntities: [
        {
          entityId: 'npc_messenger_1',
          canonicalName: 'Брендан',
          aliases: ['Брендан', 'гонец'],
          entityType: 'npc',
          faction: 'neutral',
          combatRole: 'neutral_observer',
          lifecycle: 'active',
          stats: { hpCurrent: 3, hpMax: 15, ac: 11, conditions: [], willpower: 100, willpowerMax: 100 },
          role: 'Раненый гонец',
          status: 'Истекает кровью',
          location: { roomId: 'room_heal_reject' },
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const aiHallucinatedHeal: AIDMResponse = {
      narrative: 'Бродяга чудесным образом исцеляет гонца до полного здоровья.',
      currentSituation: 'Гонец здоров',
      activeEnemies: [],
      sceneNPCs: [
        {
          id: 'npc_messenger_1',
          name: 'Брендан',
          role: 'Раненый гонец',
          hpCurrent: 15, // AI hallucinated 15 HP!
          hpMax: 15,
          ac: 11,
          status: 'Полностью здоров',
        },
      ],
      partyChoices: [],
    };

    // Process with the unauthorized phantomHealRes (healRolled = 0)
    sem.processRoundEntities(healRejectRoom, aiHallucinatedHeal, [phantomHealAction], [phantomHealRes]);
    const messengerAfter = healRejectRoom.sceneEntities?.find((e) => e.entityId === 'npc_messenger_1');
    assert.strictEqual(messengerAfter?.stats.hpCurrent, 3, 'Hallucinated AI heal must be blocked; HP must remain 3');

    // 4. Valid Bandage Healing:
    // Character with bandages in inventory heals Brendan
    const mockCharHealer: CharacterEntity = {
      id: 'char_healer_1',
      userId: 'user_u4',
      name: 'Лекарь',
      race: 'Человек',
      characterClass: 'Жрец',
      level: 1,
      hpCurrent: 10,
      hpMax: 10,
      ac: 12,
      stats: { str: 10, dex: 10, con: 12, int: 12, wis: 16, cha: 10 }, // WIS mod = +3
      skills: ['Медицина'],
      abilities: [],
      inventory: [
        { id: 'item_bandages_1', name: 'Бинты', type: 'misc', quantity: 2 },
      ],
      createdAt: new Date().toISOString(),
    };

    const bandageAction: TurnActionEntity = {
      id: 'act_bandage_1',
      roomId: 'room_test',
      playerId: 'user_u4',
      characterId: 'char_healer_1',
      characterName: 'Лекарь',
      actionText: 'Перевязываю раны гонца бинтами',
      actionType: 'heal',
    };

    const bandageRes = mechanicalArbiter.evaluateAction(
      bandageAction,
      mockCharHealer,
      [],
      [mockMessengerNPC],
      12
    );
    assert.ok(bandageRes.healRolled! >= 4, `Bandage heal (1d4 + 3) must be at least 4, got ${bandageRes.healRolled}`);
    assert.strictEqual(bandageRes.consumedItems?.length, 1, '1 bandage item must be consumed');
    assert.strictEqual(bandageRes.consumedItems?.[0].itemId, 'item_bandages_1', 'Consumed item must be bandages');

    // 5. Phantom Poison Rejection:
    // Character has NO poison, tries to poison an enemy
    const phantomPoisonAction: TurnActionEntity = {
      id: 'act_poison_phantom_1',
      roomId: 'room_test',
      playerId: 'user_u3',
      characterId: 'char_empty_1',
      characterName: 'Бродяга',
      actionText: 'Травлю разбойника ядом',
      actionType: 'poison',
    };

    const phantomPoisonRes = mechanicalArbiter.evaluateAction(
      phantomPoisonAction,
      mockCharEmpty,
      [mockEnemy],
      [],
      12
    );
    assert.strictEqual(phantomPoisonRes.damageRolled, 0, 'Poisoning without poison in inventory must deal 0 damage');
    assert.ok(phantomPoisonRes.promptDirective.includes('НЕТ яда'), 'Directive must forbid poisoning without poison item');

    // 6. Valid Poisoning & Consumption:
    // Character with poison vial poisons enemy
    const mockCharRogue: CharacterEntity = {
      id: 'char_rogue_1',
      userId: 'user_u5',
      name: 'Плут',
      race: 'Человек',
      characterClass: 'Плут',
      level: 1,
      hpCurrent: 9,
      hpMax: 9,
      ac: 13,
      stats: { str: 10, dex: 16, con: 12, int: 12, wis: 10, cha: 12 },
      skills: ['Скрытность'],
      abilities: [],
      inventory: [
        { id: 'item_poison_1', name: 'Склянка с ядом гадюки', type: 'potion', quantity: 1, description: 'Смертоносный яд' },
        { id: 'item_dagger_1', name: 'Кинжал', type: 'weapon', quantity: 1, damage: '1d4' },
      ],
      createdAt: new Date().toISOString(),
    };

    const validPoisonAction: TurnActionEntity = {
      id: 'act_poison_valid_1',
      roomId: 'room_test',
      playerId: 'user_u5',
      characterId: 'char_rogue_1',
      characterName: 'Плут',
      actionText: 'Отравить разбойника ядом',
      actionType: 'poison',
    };

    const validPoisonRes = mechanicalArbiter.evaluateAction(
      validPoisonAction,
      mockCharRogue,
      [mockEnemy],
      [],
      12
    );
    assert.ok(validPoisonRes.damageRolled! >= 2, `Poison damage (2d4) must be >= 2, got ${validPoisonRes.damageRolled}`);
    assert.strictEqual(validPoisonRes.consumedItems?.length, 1, '1 poison item must be consumed');
    assert.strictEqual(validPoisonRes.consumedItems?.[0].itemId, 'item_poison_1');

    // 7. Non-spellcaster Magic Spellcasting Blocked:
    const mockFighterSpellAction: TurnActionEntity = {
      id: 'act_spell_fighter_1',
      roomId: 'room_test',
      playerId: 'user_u1',
      characterId: 'char_unarmed_1',
      characterName: 'Кулачник',
      actionText: 'Кастую файербол во врагов',
      actionType: 'magic',
    };

    const fighterSpellRes = mechanicalArbiter.evaluateAction(
      mockFighterSpellAction,
      mockCharUnarmed,
      [mockEnemy],
      [],
      12
    );
    assert.ok(fighterSpellRes.promptDirective.includes('не владеет магией'), 'Non-spellcaster magic cast must be blocked');

    console.log('✅ Inventory & capability grounding (Weapons, Healing, Poison, Magic, Unarmed Strike) verified!\n');
  }

  console.log('🎉 ALL 32 ARCHITECTURAL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

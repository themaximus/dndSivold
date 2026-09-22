import crypto from 'crypto';
import {
  SceneEntity,
  ProjectedEntityView,
  SceneProjectionViewModel,
  EntityFaction,
  EntityCombatRole,
  EntityLifecycle,
  AIDMResponse,
  DepartedNPCEntry,
} from '../../domain/types';
import {
  RoomEntity,
  RoomEnemy,
  RoomNPC,
  WorldNPCEntry,
  SearchedObjectEntry,
} from '../../db';

/**
 * Universal Russian word stemmer for entity alias resolution.
 * Normalizes case endings and fleeting vowels (e.g. "гонец" <-> "гонца" <-> "гонцу").
 */
export function stemRussianWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/ец$/g, 'ц')
    .replace(
      /(а|я|о|е|у|ю|ы|и|ом|ем|ам|ям|ами|ями|ах|ях|ого|его|ому|ему|ым|им|ой|ей|ую|юю|ое|ее|ые|ие|ов|ев)$/g,
      ''
    );
}

/**
 * Extracts searchable 3+ char tokens from text.
 */
export function extractSearchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()«»"']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map(stemRussianWord)
    .filter((s) => s.length >= 3);
}

export class SceneEntityManager {
  /**
   * Generates an immutable UUID for a new scene entity.
   */
  public generateEntityId(prefix: string = 'ent'): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  /**
   * Ensures that the room has a populated sceneEntities array.
   * If not yet initialized, migrates existing activeEnemies and sceneNPCs
   * into unified SceneEntity records with stable UUIDs.
   */
  public ensureSceneEntities(room: RoomEntity): SceneEntity[] {
    if (!room.sceneEntities) {
      room.sceneEntities = [];
    }

    // If sceneEntities is empty but legacy activeEnemies or sceneNPCs exist, migrate them
    if (room.sceneEntities.length === 0) {
      const migratedIds = new Set<string>();

      if (room.activeEnemies && Array.isArray(room.activeEnemies)) {
        for (const enemy of room.activeEnemies) {
          const entityId = enemy.id && !migratedIds.has(enemy.id) ? enemy.id : this.generateEntityId('ent_enemy');
          migratedIds.add(entityId);

          const entity: SceneEntity = {
            entityId,
            canonicalName: enemy.name || 'Враг',
            aliases: [enemy.name || 'Враг'],
            entityType: 'creature',
            faction: 'hostile',
            combatRole: 'hostile_threat',
            lifecycle: enemy.isDead || (enemy.hpCurrent !== undefined && enemy.hpCurrent <= 0) ? 'defeated' : 'active',
            stats: {
              hpCurrent: enemy.hpCurrent ?? 20,
              hpMax: enemy.hpMax ?? 20,
              ac: enemy.ac ?? 12,
              conditions: enemy.conditions ? [...enemy.conditions] : [],
              willpower: enemy.willpower ?? 100,
              willpowerMax: enemy.willpowerMax ?? 100,
            },
            role: enemy.type || 'Противник',
            status: enemy.status || 'В бою',
            location: { roomId: room.id },
            narrativeNotes: [],
            createdAt: new Date().toISOString(),
          };

          room.sceneEntities.push(entity);
        }
      }

      if (room.sceneNPCs && Array.isArray(room.sceneNPCs)) {
        for (const npc of room.sceneNPCs) {
          // Check if already migrated to avoid duplicates
          const existing = this.findEntityByMatch(room.sceneEntities, npc.name, npc.id);
          if (existing) {
            this.addAlias(existing, npc.name);
            continue;
          }

          const entityId = npc.id && !migratedIds.has(npc.id) ? npc.id : this.generateEntityId('ent_npc');
          migratedIds.add(entityId);

          const faction: EntityFaction = npc.disposition === 'hostile' ? 'hostile' : npc.combatRole === 'ally_combatant' ? 'allied' : 'neutral';
          const combatRole: EntityCombatRole = npc.combatRole || 'neutral_observer';

          const entity: SceneEntity = {
            entityId,
            canonicalName: npc.name || 'Персонаж',
            aliases: [npc.name || 'Персонаж'],
            entityType: 'npc',
            faction,
            combatRole,
            lifecycle: npc.isDead || (npc.hpCurrent !== undefined && npc.hpCurrent <= 0) ? 'defeated' : 'active',
            stats: {
              hpCurrent: npc.hpCurrent ?? 15,
              hpMax: npc.hpMax ?? 15,
              ac: npc.ac ?? 11,
              conditions: npc.conditions ? [...npc.conditions] : [],
              willpower: npc.willpower ?? 100,
              willpowerMax: npc.willpowerMax ?? 100,
            },
            role: npc.role || 'Персонаж',
            status: npc.status || 'Присутствует',
            disposition: npc.disposition || 'neutral',
            location: { roomId: room.id },
            narrativeNotes: npc.trustNotes ? [...npc.trustNotes] : [],
            createdAt: new Date().toISOString(),
          };

          room.sceneEntities.push(entity);
        }
      }
    }

    return room.sceneEntities;
  }

  /**
   * Registers a new entity into the room with an immutable UUID.
   */
  public registerEntity(
    room: RoomEntity,
    params: {
      name: string;
      role?: string;
      entityType?: 'creature' | 'npc' | 'interactive_object' | 'boss';
      faction?: EntityFaction;
      combatRole?: EntityCombatRole;
      lifecycle?: EntityLifecycle;
      hpCurrent?: number;
      hpMax?: number;
      ac?: number;
      status?: string;
      disposition?: any;
      aliases?: string[];
      narrativeNotes?: string[];
    }
  ): SceneEntity {
    this.ensureSceneEntities(room);

    // Check if an entity matching this name or alias already exists
    const existing = this.findEntityByMatch(room.sceneEntities!, params.name);
    if (existing) {
      if (params.aliases) {
        params.aliases.forEach((a) => this.addAlias(existing, a));
      }
      return existing;
    }

    const entityId = this.generateEntityId(params.faction === 'hostile' ? 'ent_enemy' : 'ent_npc');
    const initialAliases = Array.from(new Set([params.name, ...(params.aliases || [])])).filter(Boolean);

    const entity: SceneEntity = {
      entityId,
      canonicalName: params.name,
      aliases: initialAliases,
      entityType: params.entityType || 'npc',
      faction: params.faction || 'neutral',
      combatRole: params.combatRole || 'neutral_observer',
      lifecycle: params.lifecycle || 'active',
      stats: {
        hpCurrent: params.hpCurrent ?? 15,
        hpMax: params.hpMax ?? 15,
        ac: params.ac ?? 12,
        conditions: [],
        willpower: 100,
        willpowerMax: 100,
      },
      role: params.role || 'Персонаж',
      status: params.status || 'Присутствует в сцене',
      disposition: params.disposition || (params.faction === 'hostile' ? 'hostile' : 'neutral'),
      location: { roomId: room.id },
      narrativeNotes: params.narrativeNotes ? [...params.narrativeNotes] : [],
      createdAt: new Date().toISOString(),
    };

    room.sceneEntities!.push(entity);
    this.syncLegacyArrays(room);
    return entity;
  }

  /**
   * Adds an alias to an entity.
   */
  public addAlias(entity: SceneEntity, alias: string): void {
    if (!alias || !alias.trim()) return;
    const clean = alias.trim();
    if (!entity.aliases.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      entity.aliases.push(clean);
    }
  }

  /**
   * Resolves a text snippet, name, or ID to an exact SceneEntity.
   */
  public resolveEntity(room: RoomEntity, nameOrTextOrId: string): SceneEntity | null {
    if (!nameOrTextOrId) return null;
    this.ensureSceneEntities(room);
    return this.findEntityByMatch(room.sceneEntities!, nameOrTextOrId);
  }

  /**
   * Robust entity matcher using ID, canonical names, aliases, and Russian stem tokens.
   */
  public findEntityByMatch(
    entities: SceneEntity[],
    query: string,
    explicitId?: string
  ): SceneEntity | null {
    if (!query && !explicitId) return null;

    // 1. Direct ID match
    if (explicitId) {
      const matchById = entities.find((e) => e.entityId === explicitId);
      if (matchById) return matchById;
    }

    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return null;

    // Direct entityId match inside query
    const matchByDirectId = entities.find((e) => e.entityId === cleanQuery);
    if (matchByDirectId) return matchByDirectId;

    const normQuery = cleanQuery.toLowerCase();

    // 2. Direct exact name or alias match
    for (const entity of entities) {
      if (entity.canonicalName.toLowerCase() === normQuery) return entity;
      if (entity.aliases.some((a) => a.toLowerCase() === normQuery)) return entity;
    }

    // 3. Numeric distinction check (e.g. "Бандит 1" vs "Бандит 2")
    const queryNum = normQuery.match(/\b(\d+)\b/);

    // 4. Token & Stemming overlap
    const queryTokens = extractSearchTokens(normQuery);
    if (queryTokens.length === 0) return null;

    let bestEntity: SceneEntity | null = null;
    let highestScore = 0;

    for (const entity of entities) {
      // Check numeric conflict
      if (queryNum) {
        const entityNum = entity.canonicalName.match(/\b(\d+)\b/);
        if (entityNum && entityNum[1] !== queryNum[1]) {
          continue; // Different numbered creature!
        }
      }

      // Collect all tokens for this entity
      const allEntityStrings = [entity.canonicalName, ...entity.aliases, entity.role || ''];
      const entityTokens = new Set<string>();
      for (const str of allEntityStrings) {
        extractSearchTokens(str).forEach((t) => entityTokens.add(t));
      }

      let matchCount = 0;
      for (const qToken of queryTokens) {
        for (const eToken of entityTokens) {
          if (qToken === eToken || (qToken.length >= 4 && eToken.length >= 4 && (qToken.includes(eToken) || eToken.includes(qToken)))) {
            matchCount++;
            break;
          }
        }
      }

      if (matchCount > highestScore) {
        highestScore = matchCount;
        bestEntity = entity;
      }
    }

    // Require at least 1 significant token match
    return highestScore >= 1 ? bestEntity : null;
  }

  /**
   * Updates an entity's stats, conditions, or status authoritatively.
   */
  public updateEntity(
    room: RoomEntity,
    entityId: string,
    updates: {
      hpDelta?: number;
      hpCurrent?: number;
      conditionsToAdd?: string[];
      conditionsToRemove?: string[];
      status?: string;
      combatRole?: EntityCombatRole;
      faction?: EntityFaction;
      lifecycle?: EntityLifecycle;
      note?: string;
    }
  ): SceneEntity | null {
    this.ensureSceneEntities(room);
    const entity = room.sceneEntities!.find((e) => e.entityId === entityId);
    if (!entity) return null;

    if (updates.hpCurrent !== undefined) {
      entity.stats.hpCurrent = Math.max(0, Math.min(entity.stats.hpMax, updates.hpCurrent));
    } else if (updates.hpDelta !== undefined) {
      entity.stats.hpCurrent = Math.max(0, Math.min(entity.stats.hpMax, entity.stats.hpCurrent + updates.hpDelta));
    }

    // If HP drops to 0, mark as defeated
    if (entity.stats.hpCurrent <= 0) {
      entity.lifecycle = 'defeated';
    } else if (entity.lifecycle === 'defeated' && entity.stats.hpCurrent > 0) {
      entity.lifecycle = 'active';
    }

    if (updates.conditionsToAdd) {
      for (const cond of updates.conditionsToAdd) {
        if (!entity.stats.conditions.includes(cond)) {
          entity.stats.conditions.push(cond);
        }
      }
    }

    if (updates.conditionsToRemove) {
      entity.stats.conditions = entity.stats.conditions.filter((c: string) => !updates.conditionsToRemove!.includes(c));
    }

    if (updates.status !== undefined) entity.status = updates.status;
    if (updates.combatRole !== undefined) entity.combatRole = updates.combatRole;
    if (updates.faction !== undefined) entity.faction = updates.faction;
    if (updates.lifecycle !== undefined) entity.lifecycle = updates.lifecycle;
    if (updates.note) {
      if (!entity.narrativeNotes) entity.narrativeNotes = [];
      entity.narrativeNotes.push(updates.note);
    }

    entity.updatedAt = new Date().toISOString();
    this.syncLegacyArrays(room);
    return entity;
  }

  /**
   * Procedural Entity Synthesis:
   * Analyzes narrative and current situation. If a key actor (e.g. messenger, merchant, guard, ally)
   * is actively introduced or participating, ensures that they exist as a registered SceneEntity with UUID.
   * Eliminates Bug #7 (characters failing to spawn).
   */
  public synthesizeEntitiesFromNarrative(
    room: RoomEntity,
    narrative: string,
    currentSituation: string
  ): SceneEntity[] {
    this.ensureSceneEntities(room);
    const fullText = `${narrative}\n${currentSituation}`;
    const newlySpawned: SceneEntity[] = [];

    // Common archetypes to detect if mentioned as interactive actors
    const archetypePatterns: Array<{
      regex: RegExp;
      canonicalName: string;
      role: string;
      faction: EntityFaction;
      combatRole: EntityCombatRole;
      disposition: any;
      defaultHp: number;
      defaultAc: number;
    }> = [
      {
        regex: /(?:ранен(?:ый|ого|ому|ым)?\s+)?(?:гонец|посланник|курьер|вестник)/i,
        canonicalName: 'Раненый гонец',
        role: 'Посланник графской стражи',
        faction: 'neutral',
        combatRole: 'neutral_observer',
        disposition: 'friendly',
        defaultHp: 12,
        defaultAc: 11,
      },
      {
        regex: /(?:купец|торговец|караванщик|коробейник)\s*([А-ЯЁ][а-яё]+)?/i,
        canonicalName: 'Купец',
        role: 'Караванщик и торговец',
        faction: 'neutral',
        combatRole: 'neutral_observer',
        disposition: 'friendly',
        defaultHp: 18,
        defaultAc: 12,
      },
      {
        regex: /(?:стражник|дозорный|патрульный|егерь|караульный)\s*([А-ЯЁ][а-яё]+)?/i,
        canonicalName: 'Стражник',
        role: 'Городской дозорный',
        faction: 'neutral',
        combatRole: 'neutral_observer',
        disposition: 'neutral',
        defaultHp: 22,
        defaultAc: 14,
      },
      {
        regex: /(?:трактирщик|хозяин\s+таверны|бармен)\s*([А-ЯЁ][а-яё]+)?/i,
        canonicalName: 'Трактирщик',
        role: 'Владелец таверны',
        faction: 'neutral',
        combatRole: 'neutral_observer',
        disposition: 'neutral',
        defaultHp: 20,
        defaultAc: 10,
      },
    ];

    for (const arch of archetypePatterns) {
      const match = fullText.match(arch.regex);
      if (match) {
        // If matched a specific proper name (e.g. "Купец Бальтазар" -> group 1 is "Бальтазар")
        let assignedName = arch.canonicalName;
        if (match[1] && match[1].length >= 3) {
          assignedName = `${arch.canonicalName} ${match[1]}`;
        }

        // Check if an entity already matches this
        const existing = this.findEntityByMatch(room.sceneEntities!, assignedName);
        if (!existing) {
          const newEnt = this.registerEntity(room, {
            name: assignedName,
            role: arch.role,
            entityType: 'npc',
            faction: arch.faction,
            combatRole: arch.combatRole,
            disposition: arch.disposition,
            hpCurrent: arch.defaultHp,
            hpMax: arch.defaultHp,
            ac: arch.defaultAc,
            status: 'Встречен в сцене',
            aliases: [match[0].trim(), assignedName],
          });
          newlySpawned.push(newEnt);
        } else {
          // Register the matched phrase as alias
          this.addAlias(existing, match[0].trim());
        }
      }
    }

    return newlySpawned;
  }

  /**
   * Detects NPC departures, movement transitions, or retreats,
   * archives them to worldNPCRegistry and updates lifecycle to 'departed'.
   */
  public handleNPCDepartures(
    room: RoomEntity,
    narrative: string,
    currentSituation: string,
    aiDepartedNPCs?: DepartedNPCEntry[]
  ): SceneEntity[] {
    this.ensureSceneEntities(room);
    const departedEntities: SceneEntity[] = [];
    const text = `${narrative}\n${currentSituation}`.toLowerCase();

    // 1. Explicit AI departed list
    if (aiDepartedNPCs && Array.isArray(aiDepartedNPCs)) {
      for (const dep of aiDepartedNPCs) {
        const ent = this.findEntityByMatch(room.sceneEntities!, dep.name);
        if (ent && ent.lifecycle === 'active') {
          ent.lifecycle = 'departed';
          ent.status = dep.narrativeNote || 'Покинул сцену';
          departedEntities.push(ent);
          this.archiveToWorldRegistry(room, ent, dep.reason || 'departed', dep.narrativeNote);
        }
      }
    }

    // 2. Location transition detection (e.g. traveling to a new city/dungeon room)
    const isLocationTransition =
      /(въезжа(?:ет|ют)|прибыва(?:ет|ют)|входят\s+в|ворота\s+город|добрались\s+до|перешли\s+в\s+новую\s+локацию)/i.test(
        text
      );

    for (const entity of room.sceneEntities!) {
      if (entity.lifecycle !== 'active') continue;

      const entStatus = (entity.status || '').toLowerCase();

      // Detection: Left behind
      const isLeftBehind =
        /(остал(?:ся|ась|ись)|позади|на\s+развилк|в\s+лагер|на\s+мест|у\s+повозк|далек[оа]\s+позади|не\s+последовал|отстал)/i.test(
          entStatus
        ) ||
        (text.includes(entity.canonicalName.toLowerCase()) &&
          /(остал(?:ся|ась|ись)\s+позади|брошен\s+на\s+дороге|не\s+пошел\s+с\s+отрядом)/i.test(text));

      // Detection: Departed / Traveled away
      const isDeparted =
        /(покинул\s+локацию|ушел\s+в\s+(?:город|деревню|лагерь|горы)|уехал|скрылся\s+за\s+горизонтом|удалился)/i.test(
          entStatus
        );

      // Detection: Stationary road NPC when whole party moves to city
      const isStationaryRoadNPC =
        isLocationTransition &&
        entity.combatRole !== 'ally_combatant' &&
        entity.faction !== 'hostile' &&
        !entity.status.toLowerCase().includes('сопровождает');

      if (isLeftBehind || isDeparted || isStationaryRoadNPC) {
        entity.lifecycle = 'departed';
        departedEntities.push(entity);
        const reason = isLeftBehind
          ? 'left_behind'
          : isLocationTransition
          ? 'location_transition'
          : 'departed';
        this.archiveToWorldRegistry(room, entity, reason, entity.status);
      }
    }

    this.syncLegacyArrays(room);
    return departedEntities;
  }

  /**
   * Saves a departed entity to worldNPCRegistry in the room.
   */
  private archiveToWorldRegistry(
    room: RoomEntity,
    entity: SceneEntity,
    reason: string,
    narrativeNote?: string
  ): void {
    if (!room.worldNPCRegistry) {
      room.worldNPCRegistry = [];
    }

    const existingIndex = room.worldNPCRegistry.findIndex(
      (w) => w.id === entity.entityId || w.name.toLowerCase() === entity.canonicalName.toLowerCase()
    );

    const record: WorldNPCEntry = {
      id: entity.entityId,
      roomId: room.id,
      name: entity.canonicalName,
      role: entity.role || 'Персонаж',
      hpCurrent: entity.stats.hpCurrent,
      hpMax: entity.stats.hpMax,
      ac: entity.stats.ac,
      disposition: entity.disposition || 'neutral',
      affinity: 0,
      status: entity.status,
      combatRole:
        entity.combatRole === 'ally_combatant' || entity.combatRole === 'hiding' || entity.combatRole === 'fled'
          ? entity.combatRole
          : 'neutral_observer',
      notes: entity.narrativeNotes || [],
      departureRound: room.roundNumber || 1,
      departureReason: reason,
      narrativeNote: narrativeNote || entity.status,
      potentialHooks: [],
    };

    if (existingIndex >= 0) {
      room.worldNPCRegistry[existingIndex] = record;
    } else {
      room.worldNPCRegistry.push(record);
    }
  }

  /**
   * Synchronizes legacy room.activeEnemies and room.sceneNPCs arrays
   * from authoritative room.sceneEntities to ensure full backwards compatibility.
   */
  public syncLegacyArrays(room: RoomEntity): void {
    if (!room.sceneEntities) return;

    const legacyEnemies: RoomEnemy[] = [];
    const legacyNPCs: RoomNPC[] = [];

    for (const entity of room.sceneEntities) {
      if (entity.lifecycle === 'departed' || entity.lifecycle === 'archived') {
        continue; // Departed entities do not appear in active scene views
      }

      if (entity.faction === 'hostile') {
        legacyEnemies.push({
          id: entity.entityId,
          name: entity.canonicalName,
          type: entity.role || 'monster',
          hpCurrent: entity.stats.hpCurrent,
          hpMax: entity.stats.hpMax,
          ac: entity.stats.ac,
          status: entity.status,
          conditions: [...entity.stats.conditions],
          isDead: entity.lifecycle === 'defeated' || entity.stats.hpCurrent <= 0,
          willpower: entity.stats.willpower ?? 100,
          willpowerMax: entity.stats.willpowerMax ?? 100,
        });
      } else {
        legacyNPCs.push({
          id: entity.entityId,
          name: entity.canonicalName,
          role: entity.role || 'Персонаж',
          hpCurrent: entity.stats.hpCurrent,
          hpMax: entity.stats.hpMax,
          ac: entity.stats.ac,
          disposition: entity.disposition || 'neutral',
          combatRole:
            entity.combatRole === 'ally_combatant' || entity.combatRole === 'hiding' || entity.combatRole === 'fled'
              ? entity.combatRole
              : 'neutral_observer',
          status: entity.status,
          conditions: [...entity.stats.conditions],
          isDead: entity.lifecycle === 'defeated' || entity.stats.hpCurrent <= 0,
          willpower: entity.stats.willpower ?? 100,
          willpowerMax: entity.stats.willpowerMax ?? 100,
        });
      }
    }

    room.activeEnemies = legacyEnemies;
    room.sceneNPCs = legacyNPCs;
  }

  /**
   * Builds the server-projected ViewModel for thin client consumption.
   */
  public buildSceneProjection(room: RoomEntity): SceneProjectionViewModel {
    this.ensureSceneEntities(room);

    const threats: ProjectedEntityView[] = [];
    const allies: ProjectedEntityView[] = [];
    const sceneNPCs: ProjectedEntityView[] = [];

    for (const entity of room.sceneEntities!) {
      if (entity.lifecycle === 'departed' || entity.lifecycle === 'archived') {
        continue;
      }

      const projected: ProjectedEntityView = {
        entityId: entity.entityId,
        name: entity.canonicalName,
        role: entity.role,
        type: entity.entityType,
        faction: entity.faction,
        combatRole: entity.combatRole,
        lifecycle: entity.lifecycle,
        hpCurrent: entity.stats.hpCurrent,
        hpMax: entity.stats.hpMax,
        ac: entity.stats.ac,
        status: entity.status,
        conditions: [...entity.stats.conditions],
        isDead: entity.lifecycle === 'defeated' || entity.stats.hpCurrent <= 0,
        willpower: entity.stats.willpower,
        willpowerMax: entity.stats.willpowerMax,
        disposition: entity.disposition,
      };

      if (entity.faction === 'hostile') {
        threats.push(projected);
      } else if (entity.combatRole === 'ally_combatant' && entity.faction === 'allied') {
        allies.push(projected);
      } else {
        sceneNPCs.push(projected);
      }
    }

    const activeCombat = threats.some((t) => !t.isDead && t.hpCurrent > 0);

    const projection: SceneProjectionViewModel = {
      threats,
      allies,
      sceneNPCs,
      searchedObjects: room.searchedObjectsRegistry ? [...room.searchedObjectsRegistry] : [],
      worldArchive: room.worldNPCRegistry ? [...room.worldNPCRegistry] : [],
      activeCombat,
      currentSituation: room.currentSituation || '',
      roomDC: room.targetDC,
      roomDCReason: room.dcReason,
    };

    room.sceneProjection = projection;
    return projection;
  }
}

export const sceneEntityManager = new SceneEntityManager();

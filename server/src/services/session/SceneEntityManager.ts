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
  TurnActionEntity,
} from '../../db';
import { IWorldNPCRepository, worldNPCRepository } from '../../repositories';

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

export interface EntityArchetypePattern {
  id: string;
  regex: RegExp;
  canonicalName: string;
  role: string;
  faction: EntityFaction;
  combatRole: EntityCombatRole;
  disposition: any;
  defaultHp: number;
  defaultAc: number;
}

export const SCENE_ARCHETYPE_PATTERNS: EntityArchetypePattern[] = [
  {
    id: 'messenger',
    regex: /(?:ранен(?:ый|ого|ому|ым)?\s+)?(?:гонец|посланник|курьер|вестник|посыльный)/i,
    canonicalName: 'Раненый гонец',
    role: 'Посланник графской стражи',
    faction: 'neutral',
    combatRole: 'neutral_observer',
    disposition: 'friendly',
    defaultHp: 12,
    defaultAc: 11,
  },
  {
    id: 'merchant',
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
    id: 'guard',
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
    id: 'innkeeper',
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

export class SceneEntityManager {
  private worldNPCs: IWorldNPCRepository;

  constructor(worldNPCs: IWorldNPCRepository = worldNPCRepository) {
    this.worldNPCs = worldNPCs;
  }

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
            location: { roomId: room.id, zoneId: room.currentZoneKey },
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
            location: { roomId: room.id, zoneId: room.currentZoneKey },
            narrativeNotes: npc.trustNotes ? [...npc.trustNotes] : [],
            createdAt: new Date().toISOString(),
          };

          room.sceneEntities.push(entity);
        }
      }
    }

    // Procedural deduplication: merge duplicate archetype twins if any exist
    this.deduplicateActiveEntities(room);

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

    // 1. Check if an entity matching this name or alias already exists
    const existing = this.findEntityByMatch(room.sceneEntities!, params.name);
    if (existing) {
      if (params.aliases) {
        params.aliases.forEach((a) => this.addAlias(existing, a));
      }
      return existing;
    }

    // 2. Archetype promotion & deduplication check
    const npcArch = this.getNPCArchetype({ name: params.name, role: params.role });
    if (npcArch) {
      if (this.isGenericArchetypeName(params.name, npcArch)) {
        // Trying to register a generic archetype when an entity of that archetype already exists
        const existingArchetype = room.sceneEntities!.find(
          (e) => e.lifecycle === 'active' && this.matchesArchetype(e, npcArch)
        );
        if (existingArchetype) {
          this.addAlias(existingArchetype, params.name);
          if (params.aliases) {
            params.aliases.forEach((a) => this.addAlias(existingArchetype, a));
          }
          return existingArchetype;
        }
      } else {
        // Registering a named NPC when a generic archetype already exists -> promote it!
        const genericCandidate = room.sceneEntities!.find(
          (e) =>
            e.lifecycle === 'active' &&
            this.matchesArchetype(e, npcArch) &&
            this.isGenericArchetypeName(e.canonicalName, npcArch)
        );
        if (genericCandidate) {
          this.addAlias(genericCandidate, genericCandidate.canonicalName);
          genericCandidate.canonicalName = params.name.trim();
          this.addAlias(genericCandidate, params.name.trim());
          if (params.aliases) {
            params.aliases.forEach((a) => this.addAlias(genericCandidate, a));
          }
          if (params.role) genericCandidate.role = params.role;
          if (params.hpCurrent !== undefined) genericCandidate.stats.hpCurrent = params.hpCurrent;
          if (params.hpMax !== undefined) genericCandidate.stats.hpMax = params.hpMax;
          if (params.status) genericCandidate.status = params.status;
          this.syncLegacyArrays(room);
          return genericCandidate;
        }
      }
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
      location: { roomId: room.id, zoneId: room.currentZoneKey },
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
   * Checks whether an entity matches a known archetypal pattern (by name, aliases, or role).
   */
  public matchesArchetype(entity: SceneEntity, arch: EntityArchetypePattern): boolean {
    if (arch.regex.test(entity.canonicalName)) return true;
    if (entity.role && arch.regex.test(entity.role)) return true;
    if (entity.aliases && entity.aliases.some((a) => arch.regex.test(a))) return true;
    return false;
  }

  /**
   * Identifies which archetype pattern an entity belongs to, if any.
   */
  public getEntityArchetype(entity: SceneEntity): EntityArchetypePattern | undefined {
    return SCENE_ARCHETYPE_PATTERNS.find((arch) => this.matchesArchetype(entity, arch));
  }

  /**
   * Checks whether an incoming NPC name or role matches an archetype pattern.
   */
  public getNPCArchetype(npc: { name?: string; role?: string }): EntityArchetypePattern | undefined {
    return SCENE_ARCHETYPE_PATTERNS.find((arch) => {
      if (npc.name && arch.regex.test(npc.name)) return true;
      if (npc.role && arch.regex.test(npc.role)) return true;
      return false;
    });
  }

  /**
   * Determines if a name is a generic archetype description (e.g. "Раненый гонец", "Купец")
   * as opposed to a unique individual proper name (e.g. "Брендан", "Бальтазар").
   */
  public isGenericArchetypeName(name: string, arch: EntityArchetypePattern): boolean {
    if (!name) return false;
    const clean = name.trim();
    if (clean.toLowerCase() === arch.canonicalName.toLowerCase()) return true;

    // Remove known generic archetype keywords, adjectives and affixes
    const withoutKeywords = clean
      .replace(/(?:ранен(?:ый|ого|ому|ым)?|тяжелоранен(?:ый|ого|ому|ым)?|городск(?:ой|ого|ому|им)?|графск(?:ой|ого|ому|им)?|караванн(?:ый|ого|ому|ым)?)\s*/gi, '')
      .replace(/(?:гонец|посланник|курьер|вестник|посыльный|купец|торговец|караванщик|коробейник|стражник|дозорный|патрульный|егерь|караульный|трактирщик|бармен|хозяин\s+таверны)/gi, '')
      .replace(/[\s\-_«»"']+/g, '')
      .trim();

    return withoutKeywords.length < 2 || /^\d+$/.test(withoutKeywords);
  }

  /**
   * Procedural Deduplication:
   * Scans active entities in the scene for duplicate archetype representations.
   * If both a generic entity (e.g. "Раненый гонец") and a named entity (e.g. "Брендан")
   * exist in the same room for the same archetype:
   * 1. Merges aliases and narrativeNotes into the named entity.
   * 2. Preserves the best/healthiest stats (e.g. current HP if healed).
   * 3. Retires the redundant generic entity (lifecycle 'departed').
   */
  public deduplicateActiveEntities(room: RoomEntity): void {
    if (!room.sceneEntities || room.sceneEntities.length <= 1) return;

    for (const arch of SCENE_ARCHETYPE_PATTERNS) {
      const matchingActive = room.sceneEntities.filter(
        (e) => e.lifecycle === 'active' && this.matchesArchetype(e, arch)
      );

      if (matchingActive.length <= 1) continue;

      for (let i = 0; i < matchingActive.length; i++) {
        for (let j = i + 1; j < matchingActive.length; j++) {
          const e1 = matchingActive[i];
          const e2 = matchingActive[j];
          if (e1.lifecycle !== 'active' || e2.lifecycle !== 'active') continue;

          // Check numbered conflict (e.g. "Стражник 1" vs "Стражник 2")
          const num1 = e1.canonicalName.match(/\b(\d+)\b/);
          const num2 = e2.canonicalName.match(/\b(\d+)\b/);
          if (num1 && num2 && num1[1] !== num2[1]) continue;

          const isGeneric1 = this.isGenericArchetypeName(e1.canonicalName, arch);
          const isGeneric2 = this.isGenericArchetypeName(e2.canonicalName, arch);

          // If BOTH have distinct personal names (neither is generic and names differ), do NOT merge
          if (!isGeneric1 && !isGeneric2 && e1.canonicalName.toLowerCase() !== e2.canonicalName.toLowerCase()) {
            continue;
          }

          // Decide primary: prefer named entity over generic, or the one with higher HP
          let primary: SceneEntity;
          let dup: SceneEntity;
          if (!isGeneric1 && isGeneric2) {
            primary = e1;
            dup = e2;
          } else if (isGeneric1 && !isGeneric2) {
            primary = e2;
            dup = e1;
          } else {
            if (e1.stats.hpCurrent >= e2.stats.hpCurrent) {
              primary = e1;
              dup = e2;
            } else {
              primary = e2;
              dup = e1;
            }
          }

          // Transfer aliases
          this.addAlias(primary, dup.canonicalName);
          if (dup.aliases) {
            dup.aliases.forEach((a) => this.addAlias(primary, a));
          }

          // Transfer narrative notes
          if (dup.narrativeNotes) {
            if (!primary.narrativeNotes) primary.narrativeNotes = [];
            for (const note of dup.narrativeNotes) {
              if (!primary.narrativeNotes.includes(note)) {
                primary.narrativeNotes.push(note);
              }
            }
          }

          // Preserve healed HP (e.g. 13 HP vs 3 HP)
          if (dup.stats.hpCurrent > primary.stats.hpCurrent) {
            primary.stats.hpCurrent = Math.min(primary.stats.hpMax, dup.stats.hpCurrent);
          }

          // Preserve more descriptive status
          if (dup.status && !dup.status.includes('Встречен') && (!primary.status || primary.status.includes('Присутствует'))) {
            primary.status = dup.status;
          }

          // Retire the duplicate
          dup.lifecycle = 'departed';
          dup.status = `Объединен с ${primary.canonicalName}`;
        }
      }
    }
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

    for (const arch of SCENE_ARCHETYPE_PATTERNS) {
      const match = fullText.match(arch.regex);
      if (match) {
        // If matched a specific proper name (e.g. "Купец Бальтазар" -> group 1 is "Бальтазар")
        let assignedName = arch.canonicalName;
        if (match[1] && match[1].length >= 3) {
          assignedName = `${arch.canonicalName} ${match[1]}`;
        }

        // Check if an entity already matches this by name or alias
        let existing = this.findEntityByMatch(room.sceneEntities!, assignedName);

        // Procedural Guard: Also check if any active scene entity already belongs to this archetype
        // (e.g. active NPC "Брендан" with role "Раненый курьер графской стражи")
        if (!existing) {
          existing = room.sceneEntities!.find(
            (e) => e.lifecycle === 'active' && this.matchesArchetype(e, arch)
          ) || null;
        }

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
          // Register the matched phrase as alias so future lookups find it
          this.addAlias(existing, match[0].trim());
          if (assignedName !== existing.canonicalName) {
            this.addAlias(existing, assignedName);
          }
        }
      }
    }

    // Procedural deduplication cleanup
    this.deduplicateActiveEntities(room);

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
   * Authoritatively archives an entity (departed, left behind, or defeated) into
   * room.worldNPCRegistry and the underlying persistent repository.
   */
  public archiveEntity(
    room: RoomEntity,
    entity: SceneEntity,
    reason: string,
    narrativeNote?: string
  ): WorldNPCEntry {
    if (!room.worldNPCRegistry) {
      room.worldNPCRegistry = [];
    }

    const existingIndex = room.worldNPCRegistry.findIndex(
      (w) => w.id === entity.entityId || w.name.toLowerCase().trim() === entity.canonicalName.toLowerCase().trim()
    );

    const record: WorldNPCEntry = {
      id: entity.entityId,
      roomId: room.id,
      name: entity.canonicalName,
      role: entity.role || (entity.faction === 'hostile' ? 'Противник' : 'Персонаж'),
      hpCurrent: entity.stats.hpCurrent,
      hpMax: entity.stats.hpMax,
      ac: entity.stats.ac,
      disposition: entity.disposition || (entity.faction === 'hostile' ? 'hostile' : 'neutral'),
      affinity: 0,
      status: entity.status,
      combatRole:
        entity.combatRole === 'ally_combatant' || entity.combatRole === 'hiding' || entity.combatRole === 'fled'
          ? entity.combatRole
          : 'neutral_observer',
      notes: entity.narrativeNotes ? [...entity.narrativeNotes] : [],
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

    try {
      this.worldNPCs.archiveNPC(
        room.id,
        {
          id: entity.entityId,
          name: entity.canonicalName,
          role: record.role,
          type: record.role,
          hpCurrent: entity.stats.hpCurrent,
          hpMax: entity.stats.hpMax,
          ac: entity.stats.ac,
          disposition: record.disposition as any,
          combatRole: record.combatRole as any,
          status: entity.status,
          conditions: [...entity.stats.conditions],
          isDead: entity.lifecycle === 'defeated' || entity.stats.hpCurrent <= 0,
        } as any,
        reason,
        room.roundNumber || 1,
        narrativeNote || entity.status
      );
    } catch (err) {
      // Fail-safe in case repo is in-memory or stubbed
    }

    return record;
  }

  /**
   * Internal backwards-compatible alias for archiveEntity.
   */
  private archiveToWorldRegistry(
    room: RoomEntity,
    entity: SceneEntity,
    reason: string,
    narrativeNote?: string
  ): void {
    this.archiveEntity(room, entity, reason, narrativeNote);
  }

  /**
   * Extracts dynamic narrative status from round narrative text for an entity.
   * Ensures NPC status reflects current scene happenings rather than staying static.
   */
  public extractDynamicStatusFromNarrative(entity: SceneEntity, text: string): string | null {
    if (!text || !text.trim()) return null;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const tokens = [
      entity.canonicalName.toLowerCase().trim(),
      ...entity.aliases.map((a) => a.toLowerCase().trim()),
      ...extractSearchTokens(entity.canonicalName),
    ].filter((t) => t.length >= 3);

    for (const sentence of sentences) {
      const clean = sentence.trim();
      if (clean.length < 8 || clean.length > 180) continue;
      const lower = clean.toLowerCase();
      const matched = tokens.some((t) => lower.includes(t));
      if (matched) {
        // Return cleaned sentence stripped of markdown symbols
        return clean.replace(/^[-—*#\s]+/, '').trim();
      }
    }

    if (entity.stats.hpCurrent < entity.stats.hpMax) {
      return `Ранен в бою (ОЗ: ${entity.stats.hpCurrent}/${entity.stats.hpMax})`;
    }

    return null;
  }

  /**
   * Authoritative round processor for scene entities.
   * Handles:
   * 1. Faction transition from neutral/ally to threats (when hostile, attacked, or hostile action)
   * 2. Dynamic status updating (from explicit AI sceneNPCs or narrative extraction)
   * 3. Syncing enemy states (HP, conditions, defeated)
   * 4. Auto-archiving fallen/defeated entities into worldNPCRegistry
   * 5. Synchronization of legacy activeEnemies/sceneNPCs and projection
   */
  public processRoundEntities(
    room: RoomEntity,
    dmResult: AIDMResponse,
    actionsToResolve: TurnActionEntity[] = [],
    mechanicalResolutions: any[] = []
  ): void {
    this.ensureSceneEntities(room);

    const updatedEntityIds = new Set<string>();

    // 1. Process explicit activeEnemies from AI
    if (dmResult.activeEnemies && Array.isArray(dmResult.activeEnemies)) {
      for (const enemy of dmResult.activeEnemies) {
        if (!enemy || !enemy.name) continue;
        const existing = this.findEntityByMatch(room.sceneEntities!, enemy.name, enemy.id);
        if (existing) {
          existing.faction = 'hostile';
          existing.combatRole = 'hostile_threat';
          existing.disposition = 'hostile';
          if (enemy.status && enemy.status.trim()) {
            existing.status = enemy.status.trim();
          }
          if (enemy.hpCurrent !== undefined) {
            existing.stats.hpCurrent = Math.max(0, enemy.hpCurrent);
          }
          if (enemy.hpMax !== undefined) {
            existing.stats.hpMax = Math.max(existing.stats.hpMax, enemy.hpMax);
          }
          if (enemy.ac !== undefined) {
            existing.stats.ac = enemy.ac;
          }
          if (enemy.conditions && Array.isArray(enemy.conditions)) {
            for (const c of enemy.conditions) {
              if (!existing.stats.conditions.includes(c)) existing.stats.conditions.push(c);
            }
          }
          if (enemy.isDead || existing.stats.hpCurrent <= 0) {
            existing.lifecycle = 'defeated';
          }
          existing.updatedAt = new Date().toISOString();
          updatedEntityIds.add(existing.entityId);
        } else {
          const newEnt = this.registerEntity(room, {
            name: enemy.name,
            role: enemy.type || 'Враг',
            entityType: 'creature',
            faction: 'hostile',
            combatRole: 'hostile_threat',
            disposition: 'hostile',
            hpCurrent: enemy.hpCurrent ?? 20,
            hpMax: enemy.hpMax ?? 20,
            ac: enemy.ac ?? 12,
            status: enemy.status || 'В бою с отрядом',
          });
          updatedEntityIds.add(newEnt.entityId);
        }
      }
    }

    // 2. Process explicit sceneNPCs from AI
    if (dmResult.sceneNPCs && Array.isArray(dmResult.sceneNPCs)) {
      for (const npc of dmResult.sceneNPCs) {
        if (!npc || !npc.name) continue;
        let existing = this.findEntityByMatch(room.sceneEntities!, npc.name, npc.id);

        // Proper Name Promotion: If direct match fails, check if an active generic archetype exists
        if (!existing) {
          const npcArch = this.getNPCArchetype(npc);
          if (npcArch && !this.isGenericArchetypeName(npc.name, npcArch)) {
            const genericCandidate = room.sceneEntities!.find(
              (e) =>
                e.lifecycle === 'active' &&
                this.matchesArchetype(e, npcArch) &&
                this.isGenericArchetypeName(e.canonicalName, npcArch)
            );
            if (genericCandidate) {
              this.addAlias(genericCandidate, genericCandidate.canonicalName);
              genericCandidate.canonicalName = npc.name.trim();
              this.addAlias(genericCandidate, npc.name.trim());
              if (npc.role) genericCandidate.role = npc.role;
              existing = genericCandidate;
            }
          }
        }

        if (existing) {
          // If NPC turned hostile in sceneNPCs
          if (npc.disposition === 'hostile') {
            existing.faction = 'hostile';
            existing.combatRole = 'hostile_threat';
            existing.disposition = 'hostile';
          } else {
            if (npc.disposition) existing.disposition = npc.disposition;
            if (npc.combatRole === 'ally_combatant') {
              existing.combatRole = 'ally_combatant';
              existing.faction = 'allied';
            } else if (
              existing.faction === 'hostile' &&
              (npc.disposition === 'friendly' || npc.disposition === 'neutral')
            ) {
              // De-escalated / surrendered
              existing.faction = 'neutral';
              existing.combatRole = 'neutral_observer';
            }
          }

          // DYNAMIC STATUS UPDATE: Never keep status static!
          if (npc.status && npc.status.trim()) {
            existing.status = npc.status.trim();
          }

          if (npc.hpCurrent !== undefined) {
            existing.stats.hpCurrent = Math.max(0, npc.hpCurrent);
          }
          if (npc.hpMax !== undefined) {
            existing.stats.hpMax = Math.max(existing.stats.hpMax, npc.hpMax);
          }
          if (npc.ac !== undefined) {
            existing.stats.ac = npc.ac;
          }
          if (npc.conditions && Array.isArray(npc.conditions)) {
            for (const c of npc.conditions) {
              if (!existing.stats.conditions.includes(c)) existing.stats.conditions.push(c);
            }
          }
          if (npc.isDead || existing.stats.hpCurrent <= 0) {
            existing.lifecycle = 'defeated';
          }
          if (npc.trustNotes && Array.isArray(npc.trustNotes)) {
            if (!existing.narrativeNotes) existing.narrativeNotes = [];
            existing.narrativeNotes.push(...npc.trustNotes);
          }
          existing.updatedAt = new Date().toISOString();
          updatedEntityIds.add(existing.entityId);
        } else {
          // Brand new NPC mentioned in sceneNPCs array
          const faction: EntityFaction =
            npc.disposition === 'hostile'
              ? 'hostile'
              : npc.combatRole === 'ally_combatant'
              ? 'allied'
              : 'neutral';
          const combatRole: EntityCombatRole =
            npc.disposition === 'hostile' ? 'hostile_threat' : npc.combatRole || 'neutral_observer';
          const newEnt = this.registerEntity(room, {
            name: npc.name,
            role: npc.role || 'Персонаж',
            entityType: 'npc',
            faction,
            combatRole,
            disposition: npc.disposition || 'neutral',
            hpCurrent: npc.hpCurrent ?? 15,
            hpMax: npc.hpMax ?? 15,
            ac: npc.ac ?? 11,
            status: npc.status || 'Присутствует в сцене',
          });
          updatedEntityIds.add(newEnt.entityId);
        }
      }
    }

    // 3. Process Player Hostile Actions & Damage against NPCs
    if (Array.isArray(mechanicalResolutions)) {
      for (const res of mechanicalResolutions) {
        if (res.targetUpdate && (res.targetUpdate.targetType === 'npc' || res.targetUpdate.targetType === 'enemy')) {
          const ent = this.findEntityByMatch(
            room.sceneEntities!,
            res.targetUpdate.targetName || '',
            res.targetUpdate.targetId
          );
          if (ent) {
            if (res.targetUpdate.damage > 0 || (res.damageRolled && res.damageRolled > 0)) {
              ent.faction = 'hostile';
              ent.combatRole = 'hostile_threat';
              ent.disposition = 'hostile';
              if (res.targetUpdate.newStatus) {
                ent.status = res.targetUpdate.newStatus;
              } else if (!ent.status.toLowerCase().includes('атак')) {
                ent.status = 'Враждебен: атакован отрядом, вступает в бой';
              }
            }
            updatedEntityIds.add(ent.entityId);
          }
        }
      }
    }

    for (const action of actionsToResolve) {
      const meta = (action as any).meta;
      if (action.actionType === 'attack' || meta?.actionType === 'attack') {
        const targetQuery = meta?.targetEnemyName || meta?.targetEnemyId;
        if (targetQuery) {
          const ent = this.findEntityByMatch(room.sceneEntities!, targetQuery);
          if (ent && ent.faction !== 'hostile') {
            ent.faction = 'hostile';
            ent.combatRole = 'hostile_threat';
            ent.disposition = 'hostile';
            ent.status = 'Враждебен: атакован игроком, вступает в бой';
            updatedEntityIds.add(ent.entityId);
          }
        }
      }
    }

    // 4. Narrative Dynamic Status Fallback: If an entity was NOT updated explicitly by AI sceneNPCs,
    // extract their current action/state from narrative so status is never frozen!
    const narrativeText = `${dmResult.narrative || ''}\n${dmResult.currentSituation || ''}`;
    for (const entity of room.sceneEntities!) {
      if (entity.lifecycle === 'departed' || entity.lifecycle === 'archived') continue;

      if (!updatedEntityIds.has(entity.entityId)) {
        const dynamicStatus = this.extractDynamicStatusFromNarrative(entity, narrativeText);
        if (dynamicStatus) {
          entity.status = dynamicStatus;
        }
      }
    }

    // 5. Departures & Archival
    this.handleNPCDepartures(
      room,
      dmResult.narrative || '',
      dmResult.currentSituation || '',
      dmResult.departedNPCs
    );

    // 6. Auto-archive any defeated/killed entities (HP <= 0 or lifecycle === 'defeated')
    for (const entity of room.sceneEntities!) {
      if (entity.lifecycle === 'defeated' || entity.stats.hpCurrent <= 0) {
        this.archiveEntity(
          room,
          entity,
          'defeated',
          `Повержен в бою в раунде ${room.roundNumber || 1}. ${entity.status}`
        );
      }
    }

    // 7. Deduplicate active entities, sync legacy arrays and build projection
    this.deduplicateActiveEntities(room);
    this.syncLegacyArrays(room);
    this.buildSceneProjection(room);
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

      // If spatial zones are configured, exclude entities left in other zones
      if (entity.location?.zoneId && room.currentZoneKey && entity.location.zoneId !== room.currentZoneKey) {
        continue;
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

      // If spatial zones are configured, exclude entities left in other zones
      if (entity.location?.zoneId && room.currentZoneKey && entity.location.zoneId !== room.currentZoneKey) {
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

    const currentZone = room.spatialZones?.find((z) => z.isCurrent || z.zoneKey === room.currentZoneKey);
    const currentZoneName = currentZone?.name || (room.currentZoneKey ? 'Текущая локация' : undefined);

    const projection: SceneProjectionViewModel = {
      threats,
      allies,
      sceneNPCs,
      searchedObjects: room.searchedObjectsRegistry ? [...room.searchedObjectsRegistry] : [],
      worldArchive: room.worldNPCRegistry ? [...room.worldNPCRegistry] : [],
      environmentObjects: room.environmentObjects ? [...room.environmentObjects] : [],
      currentZoneName,
      spatialZones: room.spatialZones ? [...room.spatialZones] : [],
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

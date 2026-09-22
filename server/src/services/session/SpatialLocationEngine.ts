import crypto from 'crypto';
import {
  RoomEntity,
  SpatialZoneEntity,
  SpatialEntitySnapshot,
  VehicleManifest,
  EnvironmentObjectEntity,
  SearchedObjectEntry,
} from '../../db';
import { SceneEntity } from '../../domain/types';

export interface LocationReturnDetectionResult {
  isReturn: boolean;
  targetZoneKey?: string;
  targetZoneName?: string;
  targetEntityName?: string;
}

export interface LocationTransitionDetectionResult {
  isTransition: boolean;
  toZoneKey?: string;
  toZoneName?: string;
}

export interface TimeDeltaSimulationResult {
  restoredEntities: SceneEntity[];
  promptDirective: string;
  auditNote: string;
}

/**
 * SpatialLocationEngine
 *
 * Implements a persistent spatial world graph and zone registry.
 * - Manages location transitions and passenger manifests (VehicleManifest).
 * - Evacuates non-traveling entities into persistent zone state (leftEntities)
 *   so they disappear from the active HUD when the party departs.
 * - Detects backtracking (returning to a previously left location).
 * - Simulates world time delta upon return (e.g. unconscious NPC left behind
 *   is found dead/devoured by monsters after 2+ rounds, with dropped items).
 */
export class SpatialLocationEngine {
  private readonly defaultZones: Array<{ key: string; name: string; aliases: string[] }> = [
    {
      key: 'crossroads_seven_roads',
      name: 'Перепутье Семи Дорог',
      aliases: ['перепуть', 'развилк', 'семи дорог', 'лагер', 'crossroads'],
    },
    {
      key: 'highway_road',
      name: 'Ровный тракт',
      aliases: ['тракт', 'ровный тракт', 'дорог', 'шоссе', 'highway', 'road'],
    },
    {
      key: 'town_gates',
      name: 'Городские ворота',
      aliases: ['город', 'ворот', 'какахинск', 'замок', 'поселени', 'gates', 'town'],
    },
  ];

  /**
   * Ensures the room has initialized spatial zones and a current active zone.
   */
  public ensureCurrentZone(room: RoomEntity, fallbackName: string = 'Перепутье Семи Дорог'): SpatialZoneEntity {
    if (!room.spatialZones || room.spatialZones.length === 0) {
      const initialZone: SpatialZoneEntity = {
        id: `zone_${crypto.randomUUID()}`,
        roomId: room.id,
        zoneKey: 'crossroads_seven_roads',
        name: fallbackName,
        isCurrent: true,
        firstVisitedRound: room.roundNumber || 1,
        lastVisitedRound: room.roundNumber || 1,
        leftEntities: [],
        environmentObjects: room.environmentObjects ? [...room.environmentObjects] : [],
        threatsPresent: ['Тени Пустоты'],
      };
      room.spatialZones = [initialZone];
      room.currentZoneKey = initialZone.zoneKey;
      return initialZone;
    }

    if (!room.currentZoneKey) {
      room.currentZoneKey = room.spatialZones[0].zoneKey;
    }

    let current = room.spatialZones.find((z) => z.zoneKey === room.currentZoneKey);
    if (!current) {
      current = room.spatialZones[0];
      room.currentZoneKey = current.zoneKey;
    }
    current.isCurrent = true;
    return current;
  }

  /**
   * Retrieves a spatial zone by key.
   */
  public getZone(room: RoomEntity, zoneKey: string): SpatialZoneEntity | undefined {
    return (room.spatialZones || []).find((z) => z.zoneKey === zoneKey);
  }

  /**
   * Retrieves all registered zones in the room.
   */
  public getAllZones(room: RoomEntity): SpatialZoneEntity[] {
    return room.spatialZones || [];
  }

  /**
   * Matches a zone by name or alias.
   */
  public findZoneByQuery(room: RoomEntity, queryText: string): SpatialZoneEntity | undefined {
    if (!queryText) return undefined;
    const lower = queryText.toLowerCase();

    // 1. Check existing room zones
    for (const zone of room.spatialZones || []) {
      if (lower.includes(zone.name.toLowerCase()) || lower.includes(zone.zoneKey.toLowerCase())) {
        return zone;
      }
    }

    // 2. Check defaults
    for (const def of this.defaultZones) {
      if (def.aliases.some((a) => lower.includes(a))) {
        const existing = (room.spatialZones || []).find((z) => z.zoneKey === def.key);
        if (existing) return existing;
        // Lazy create
        const newZone: SpatialZoneEntity = {
          id: `zone_${crypto.randomUUID()}`,
          roomId: room.id,
          zoneKey: def.key,
          name: def.name,
          isCurrent: false,
          firstVisitedRound: room.roundNumber,
          lastVisitedRound: room.roundNumber,
          leftEntities: [],
          environmentObjects: [],
        };
        if (!room.spatialZones) room.spatialZones = [];
        room.spatialZones.push(newZone);
        return newZone;
      }
    }

    return undefined;
  }

  /**
   * Detects if player action declares returning / backtracking to a previously visited location.
   */
  public detectLocationReturn(actionText: string, room: RoomEntity): LocationReturnDetectionResult {
    if (!actionText) return { isReturn: false };
    const lower = actionText.toLowerCase();

    const isReturnVerb = /(возвраща(?:юсь|емся)|вернуть(?:ся|ем)|назад|обратно|разворачива(?:ю|ем)|еду\s+назад|мчусь\s+назад|скачу\s+назад)/i.test(
      lower
    );

    if (!isReturnVerb) {
      return { isReturn: false };
    }

    // Identify target zone
    const targetZone = this.findZoneByQuery(room, lower);
    const mentionsAcolyte = /(послушник|ранен|гонец|ключ)/i.test(lower);

    // If player explicitly mentions "назад" and we have previous zones
    const currentZoneKey = room.currentZoneKey || 'crossroads_seven_roads';
    const otherZones = (room.spatialZones || []).filter((z) => z.zoneKey !== currentZoneKey);

    let resolvedZone = targetZone;
    if (!resolvedZone && otherZones.length > 0) {
      // Default to most recently visited previous zone
      resolvedZone = otherZones.sort((a, b) => b.lastVisitedRound - a.lastVisitedRound)[0];
    } else if (!resolvedZone && mentionsAcolyte) {
      // Crossroads is where the acolyte was
      resolvedZone = (room.spatialZones || []).find((z) => z.zoneKey === 'crossroads_seven_roads');
    }

    if (resolvedZone) {
      return {
        isReturn: true,
        targetZoneKey: resolvedZone.zoneKey,
        targetZoneName: resolvedZone.name,
        targetEntityName: mentionsAcolyte ? 'Беглый послушник' : undefined,
      };
    }

    return { isReturn: true, targetEntityName: mentionsAcolyte ? 'Беглый послушник' : undefined };
  }

  /**
   * Detects if the action and narrative describe a transition to a new location / road.
   */
  public detectLocationTransition(
    actionText: string,
    narrativeText: string,
    room: RoomEntity
  ): LocationTransitionDetectionResult {
    const combined = `${actionText} ${narrativeText}`.toLowerCase();

    // 1. Check movement onto the highway / road
    if (
      /(вылетает\s+на\s+(?:ровный\s+)?тракт|выезжа(?:ет|ем)\s+на\s+тракт|мчит(?:ся)?\s+по\s+тракту|уносит(?:ся)?\s+прочь|уезжа(?:ет|ем)\s+в\s+город|едем\s+по\s+дороге)/i.test(
        combined
      )
    ) {
      if (room.currentZoneKey !== 'highway_road') {
        return {
          isTransition: true,
          toZoneKey: 'highway_road',
          toZoneName: 'Ровный тракт',
        };
      }
    }

    // 2. Check movement to town gates
    if (
      /(прибыва(?:ет|ем)\s+к\s+город|ворота\s+город|въезжа(?:ет|ем)\s+в\s+город|стены\s+город)/i.test(
        combined
      )
    ) {
      if (room.currentZoneKey !== 'town_gates') {
        return {
          isTransition: true,
          toZoneKey: 'town_gates',
          toZoneName: 'Городские ворота',
        };
      }
    }

    return { isTransition: false };
  }

  /**
   * Evacuates non-traveling entities from active scene into persistent zone state (leftEntities).
   * Ensures that when the party travels by cart or foot, only travelers move to the new zone,
   * while everyone left behind disappears from the active HUD and is archived in the old zone.
   */
  public evacuateNonTravelers(
    room: RoomEntity,
    fromZoneKey: string,
    toZoneKey: string,
    travelerNames: string[],
    narrativeText: string = ''
  ): SpatialEntitySnapshot[] {
    const fromZone = this.ensureCurrentZone(room);
    if (fromZone.zoneKey !== fromZoneKey) {
      const match = (room.spatialZones || []).find((z) => z.zoneKey === fromZoneKey);
      if (match) {
        // use matched fromZone
      }
    }

    const currentZone = this.getZone(room, fromZoneKey) || fromZone;
    const targetZone = this.findZoneByQuery(room, toZoneKey) || this.ensureZone(room, toZoneKey, toZoneKey);

    const leftSnapshots: SpatialEntitySnapshot[] = [];
    const activeEntities = room.sceneEntities || [];

    // Filter travelers (case-insensitive check)
    const travelerLower = travelerNames.map((n) => n.trim().toLowerCase());

    for (const ent of activeEntities) {
      if (ent.lifecycle !== 'active') continue;

      const entNameLower = ent.canonicalName.toLowerCase();
      const isAboard = travelerLower.some(
        (t) => entNameLower.includes(t) || t.includes(entNameLower)
      );

      if (!isAboard) {
        // Entity stays behind in fromZone!
        const heldItems: string[] = [];
        if (/медн.*ключ|ключ/i.test(`${ent.status} ${narrativeText}`)) {
          heldItems.push('Медный ключ');
        }

        const snapshot: SpatialEntitySnapshot = {
          entityId: ent.entityId,
          canonicalName: ent.canonicalName,
          role: ent.role || 'Персонаж',
          faction: ent.faction,
          combatRole: ent.combatRole,
          lifecycle: ent.lifecycle,
          hpCurrent: ent.stats.hpCurrent,
          hpMax: ent.stats.hpMax,
          ac: ent.stats.ac,
          status: ent.status || 'Остался на месте',
          conditions: [...ent.stats.conditions],
          leftAtRound: room.roundNumber,
          heldItems,
          narrativeStateNote: `Оставлен в локации «${currentZone.name}» в раунде ${room.roundNumber}.`,
        };

        currentZone.leftEntities = (currentZone.leftEntities || []).filter(
          (s) => s.entityId !== ent.entityId
        );
        currentZone.leftEntities.push(snapshot);
        leftSnapshots.push(snapshot);

        // Mark entity departed from active scene
        ent.lifecycle = 'departed';
        ent.status = `Остался позади в локации «${currentZone.name}»`;
        ent.location = { roomId: room.id, zoneId: currentZone.zoneKey };
      } else {
        // Traveling entity moves to target zone
        ent.location = { roomId: room.id, zoneId: targetZone.zoneKey };
      }
    }

    // Synchronize legacy arrays: remove departed non-travelers from active sceneNPCs & activeEnemies
    if (room.sceneNPCs) {
      room.sceneNPCs = room.sceneNPCs.filter((n) =>
        travelerLower.some(
          (t) => n.name.toLowerCase().includes(t) || t.includes(n.name.toLowerCase())
        )
      );
    }
    if (room.activeEnemies) {
      room.activeEnemies = room.activeEnemies.filter((e) =>
        travelerLower.some(
          (t) => e.name.toLowerCase().includes(t) || t.includes(e.name.toLowerCase())
        )
      );
    }

    // Switch active zone
    currentZone.isCurrent = false;
    currentZone.lastVisitedRound = room.roundNumber;
    targetZone.isCurrent = true;
    targetZone.lastVisitedRound = room.roundNumber;
    room.currentZoneKey = targetZone.zoneKey;

    return leftSnapshots;
  }

  /**
   * Simulates world time delta upon returning to a previously left zone.
   * If an unconscious/wounded entity was left surrounded by monsters:
   * - After 2+ rounds: entity is dead/devoured, dropped key/items are left on ground.
   * - After 1 round: entity is dying at 0-1 HP, clinging to life.
   * Restores entities to active scene HUD with simulated status.
   */
  public simulateTimeDeltaOnReturn(room: RoomEntity, targetZoneKey: string): TimeDeltaSimulationResult {
    const targetZone = this.getZone(room, targetZoneKey) || this.findZoneByQuery(room, targetZoneKey);
    if (!targetZone) {
      return {
        restoredEntities: [],
        promptDirective: '',
        auditNote: `Target zone ${targetZoneKey} not found.`,
      };
    }

    const currentRound = room.roundNumber;
    const restoredEntities: SceneEntity[] = [];
    const narrativeLines: string[] = [];

    const leftSnapshots = [...(targetZone.leftEntities || [])];

    for (const snap of leftSnapshots) {
      const deltaRounds = Math.max(1, currentRound - snap.leftAtRound);
      const isSeverelyWoundedOrUnconscious =
        snap.hpCurrent <= 2 ||
        /(без сознания|тяжело ранен|смертельно|лежит в траве|бездыхан)/i.test(snap.status);
      const hasHostileThreats =
        (targetZone.threatsPresent && targetZone.threatsPresent.length > 0) ||
        /(тени|пустот|монстр|твар|разбойник)/i.test(targetZone.description || '');

      let updatedHp = snap.hpCurrent;
      let updatedStatus = snap.status;
      let updatedLifecycle = snap.lifecycle;
      let consequenceText = '';

      if (deltaRounds >= 2 && isSeverelyWoundedOrUnconscious && hasHostileThreats) {
        // Fatal simulation: devoured or bled out
        updatedHp = 0;
        updatedLifecycle = 'defeated';
        updatedStatus = 'Мёртв: растерзан тенями в траве, медный ключ лежит рядом';
        consequenceText = `Поскольку отряд отсутствовал ${deltaRounds} раунда, враги расправились с беспомощным героем: «${snap.canonicalName}» погиб, его тело лежит в окровавленной траве, а ${snap.heldItems?.join(', ') || 'медный ключ'} выпал на землю.`;
      } else if (deltaRounds === 1 && isSeverelyWoundedOrUnconscious) {
        // Urgent rescue opportunity
        updatedHp = 1;
        updatedLifecycle = 'active';
        updatedStatus = 'При смерти: 1 HP, тяжело хрипит в траве, сжимая ключ';
        consequenceText = `Отряд вернулся стремительно (спустя 1 раунд). «${snap.canonicalName}» ещё дышит (1 HP), но твари уже нависли над ним! Требуется немедленная помощь.`;
      } else {
        // Standard return
        updatedLifecycle = 'active';
        consequenceText = `«${snap.canonicalName}» обнаружен на месте (статус: ${snap.status}).`;
      }

      // Re-hydrate or update entity in room.sceneEntities
      if (!room.sceneEntities) room.sceneEntities = [];
      let entity = room.sceneEntities.find((e) => e.entityId === snap.entityId);

      if (entity) {
        entity.lifecycle = updatedLifecycle as any;
        entity.stats.hpCurrent = updatedHp;
        entity.status = updatedStatus;
        entity.location = { roomId: room.id, zoneId: targetZone.zoneKey };
      } else {
        entity = {
          entityId: snap.entityId,
          canonicalName: snap.canonicalName,
          aliases: [snap.canonicalName, 'послушник', 'раненый послушник', 'беглый послушник'],
          entityType: 'npc',
          faction: snap.faction as any,
          combatRole: snap.combatRole as any,
          lifecycle: updatedLifecycle as any,
          stats: {
            hpCurrent: updatedHp,
            hpMax: snap.hpMax,
            ac: snap.ac || 11,
            conditions: snap.conditions || [],
          },
          role: snap.role,
          status: updatedStatus,
          location: { roomId: room.id, zoneId: targetZone.zoneKey },
          narrativeNotes: [consequenceText],
        };
        room.sceneEntities.push(entity);
      }

      // Update room.sceneNPCs legacy array so client HUD receives it immediately
      if (!room.sceneNPCs) room.sceneNPCs = [];
      const npcIndex = room.sceneNPCs.findIndex((n) => n.id === entity!.entityId || n.name === entity!.canonicalName);
      const npcPayload: any = {
        id: entity.entityId,
        name: entity.canonicalName,
        role: entity.role || 'Персонаж',
        hpCurrent: updatedHp,
        hpMax: entity.stats.hpMax,
        ac: entity.stats.ac,
        disposition: 'friendly',
        combatRole: 'neutral_observer',
        status: updatedStatus,
        isDead: updatedHp <= 0,
      };

      if (npcIndex >= 0) {
        room.sceneNPCs[npcIndex] = npcPayload;
      } else {
        room.sceneNPCs.push(npcPayload);
      }

      restoredEntities.push(entity);
      narrativeLines.push(consequenceText);
    }

    // Set target zone as current
    if (room.currentZoneKey) {
      const prev = this.getZone(room, room.currentZoneKey);
      if (prev) prev.isCurrent = false;
    }
    targetZone.isCurrent = true;
    targetZone.lastVisitedRound = currentRound;
    room.currentZoneKey = targetZone.zoneKey;

    // Clear evacuated entities since they are now back in active scene
    targetZone.leftEntities = [];

    const promptDirective =
      `🏛️ СИМУЛЯЦИЯ ВОЗВРАЩЕНИЯ В ЛОКАЦИЮ «${targetZone.name}» (Прошло ${currentRound - (leftSnapshots[0]?.leftAtRound || currentRound)} раунда):\n` +
      narrativeLines.map((l) => `- ${l}`).join('\n') +
      `\nОбязательно опиши возвращение отряда на старое место, состояние персонажей и ключевые предметы окружения!`;

    return {
      restoredEntities,
      promptDirective,
      auditNote: `Restored ${restoredEntities.length} entities on return to ${targetZone.zoneKey}.`,
    };
  }

  private ensureZone(room: RoomEntity, key: string, name: string): SpatialZoneEntity {
    if (!room.spatialZones) room.spatialZones = [];
    let existing = room.spatialZones.find((z) => z.zoneKey === key);
    if (!existing) {
      existing = {
        id: `zone_${crypto.randomUUID()}`,
        roomId: room.id,
        zoneKey: key,
        name,
        isCurrent: false,
        firstVisitedRound: room.roundNumber,
        lastVisitedRound: room.roundNumber,
        leftEntities: [],
        environmentObjects: [],
      };
      room.spatialZones.push(existing);
    }
    return existing;
  }
}

export const spatialLocationEngine = new SpatialLocationEngine();

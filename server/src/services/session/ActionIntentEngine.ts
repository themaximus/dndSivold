import { TurnActionEntity, CharacterEntity, RoomEntity } from '../../db';
import { ActionIntentDTO, ActionIntentClass, SceneEntity } from '../../domain/types';
import { sceneEntityManager, extractSearchTokens } from './SceneEntityManager';
import { systemLocator } from './ServiceLocator';

export class ActionIntentEngine {
  /**
   * Parses and classifies a raw player action into a structured ActionIntentDTO.
   * Resolves target entities to their immutable UUIDs via SceneEntityManager.
   */
  public parseActionIntent(
    action: TurnActionEntity,
    character: CharacterEntity | undefined,
    room: RoomEntity
  ): ActionIntentDTO {
    const rawText = action.actionText || '';
    const speechAndAction = this.extractSpeechAndAction(rawText);
    const physicalText = speechAndAction.physicalAction || rawText;

    // 1. Classify intent type
    const intentClass = this.classifyIntent(physicalText, action.actionType, speechAndAction.isPureSpeech);

    // 2. Resolve target entity UUID
    const targetEntity = this.resolveTargetEntity(physicalText, room, speechAndAction.addressedTargetName);

    // 3. Resolve target searched object key (e.g. cart, chest, room)
    const targetObjectKey = this.resolveSearchedObjectKey(physicalText, room);

    // 4. Resolve used item from character's inventory
    const usedItem = this.resolveUsedItem(physicalText, character);

    // 5. Resolve target zone if location return
    let targetZoneKey: string | undefined;
    if (intentClass === 'location_return') {
      const spatialEngine = systemLocator.get('spatialLocationEngine');
      const ret = spatialEngine.detectLocationReturn(rawText, room);
      targetZoneKey = ret.targetZoneKey;
    }

    return {
      actorUserId: action.playerId,
      actorCharacterId: action.characterId,
      actorCharacterName: character?.name || action.characterName || 'Игрок',
      intentClass,
      actionText: rawText,
      spokenDialogue: speechAndAction.spokenDialogue,
      physicalAction: physicalText,
      isPureSpeech: speechAndAction.isPureSpeech,
      targetEntityId: targetEntity?.entityId,
      targetEntityName: targetEntity?.canonicalName,
      targetObjectKey,
      targetZoneKey,
      usedItemId: usedItem?.id,
      usedItemName: usedItem?.name,
      confidence: 1.0,
    };
  }

  /**
   * Extracts dialogue / spoken text from physical narrative action.
   */
  public extractSpeechAndAction(text: string): {
    spokenDialogue: string[];
    physicalAction: string;
    isPureSpeech: boolean;
    addressedTargetName?: string;
  } {
    const raw = (text || '').trim();
    if (!raw) {
      return { spokenDialogue: [], physicalAction: '', isPureSpeech: false };
    }

    const spokenDialogue: string[] = [];

    // Match text inside quotes: "...", «...», "...", '...'
    const quoteRegex = /(?:["«“'])([\s\S]*?)(?:["»”'])/g;
    let match: RegExpExecArray | null;
    while ((match = quoteRegex.exec(raw)) !== null) {
      const dialogue = match[1].trim();
      if (dialogue.length > 0) {
        spokenDialogue.push(dialogue);
      }
    }

    // Match text after speech introduction: говорит/спрашивает/кричит: ...
    const speechColonRegex = /(?:говор(?:ит|ю|ят)|спрашива(?:ет|ю|ют)|крич(?:ит|у|ат)|шепч(?:ет|у|ут)|обраща(?:ется|юсь)|отвеча(?:ет|ю|ют)|произнос(?:ит|шу|ят))\s*:\s*([^.!?\n]+[.!?]?)/gi;
    while ((match = speechColonRegex.exec(raw)) !== null) {
      const dialogue = match[1].trim();
      if (dialogue.length > 0 && !spokenDialogue.includes(dialogue)) {
        spokenDialogue.push(dialogue);
      }
    }

    // Remove dialogue portions from physical action
    let physicalAction = raw
      .replace(/(?:["«“'])([\s\S]*?)(?:["»”'])/g, ' ')
      .replace(/(?:говор(?:ит|ю|ят)|спрашива(?:ет|ю|ют)|крич(?:ит|у|ат)|шепч(?:ет|у|ут)|обраща(?:ется|юсь)|отвеча(?:ет|ю|ют)|произнос(?:ит|шу|ят))\s*:\s*([^.!?\n]+[.!?]?)/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if remaining action is negligible (pure speech)
    const isPureSpeech = physicalAction.length === 0 || /^(?:говор(?:ит|ю|ят)|сказал[аои]?|спросил[аои]?|ответил[аои]?)$/i.test(physicalAction);

    // Extract potential addressee: e.g. "обращаюсь к Бальтазару", "говорю гонцу"
    let addressedTargetName: string | undefined;
    const addressMatch = raw.match(/(?:обраща(?:юсь|ется)|говор(?:ю|ит)|спрашива(?:ю|ет)|к)\s+(?:к\s+)?([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)/i);
    if (addressMatch && addressMatch[1]) {
      addressedTargetName = addressMatch[1].trim();
    }

    return {
      spokenDialogue,
      physicalAction: isPureSpeech ? '' : physicalAction,
      isPureSpeech,
      addressedTargetName,
    };
  }

  /**
   * Classifies action text into a semantic action intent class.
   */
  public classifyIntent(
    physicalText: string,
    explicitType?: string,
    isPureSpeech?: boolean
  ): ActionIntentClass {
    const text = physicalText.toLowerCase();

    // 1. If user explicitly selected an actionType in UI
    if (explicitType) {
      if (explicitType === 'attack') return 'combat_attack';
      if (explicitType === 'social') return 'social_influence';
      if (explicitType === 'investigation') return 'investigate_search';
      if (explicitType === 'magic') return 'heal_assist'; // or attack depending on spell
    }

    // 2. Pure speech defaults to social interaction
    if (isPureSpeech) {
      return 'social_influence';
    }

    // 2.5. Poisoning / applying poison
    if (/(?:травлю|отрав(?:ить|ляю|лю)|подсып(?:ать|аю|ал)\s+.*яд|подмеш(?:ать|иваю)\s+.*яд|нанес(?:ти|у)\s+яд\s+на)/i.test(text)) {
      return 'poison_apply';
    }

    // 3. Healing & assistance
    if (/(?:леч(?:у|ить)|исцел(?:яю|ить)|перевяз(?:ка|ать|ываю)|зелье\s+лечени|бинту(?:ю|ем)|стабилиз|помо(?:щь|гаю)|оказываю\s+помощь)/i.test(text)) {
      return 'heal_assist';
    }

    // 4. Investigation & search
    if (/(?:обыск(?:ать|иваю)?|осмотр(?:еть|ю)?|ищ(?:у|ем)|проверя(?:ю|ем)\s+(?:повозк|сундук|комнат|карман|труп|отсек)|исследу(?:ю|ем)|взлом(?:ать|ываю))/i.test(text)) {
      return 'investigate_search';
    }

    // 5. Defensive stance / guarding
    if (/(?:закрыва(?:юсь|ем)|защища(?:юсь|ем)|париру(?:ю|ем)|прикрыва(?:юсь|ем)\s+щит|занима(?:ю|ем)\s+оборон|уклоня(?:юсь|ем)|в\s+укрыти)/i.test(text)) {
      return 'defensive_guard';
    }

    // 6. Fleeing / retreat
    if (/(?:бегств|убега(?:ю|ем)|отступа(?:ю|ем)|беж(?:им|у)|уход(?:им|у)\s+из\s+боя|драпа(?:ем|ть))/i.test(text)) {
      return 'flee_retreat';
    }

    // 7. Location Return / Backtracking
    if (/(?:возвраща(?:юсь|емся)|вернуть(?:ся|ем)|назад\s+на\s+развилк|разворачива(?:ю|ем)|еду\s+назад|мчусь\s+назад|к\s+послушник|обратно\s+на)/i.test(text)) {
      return 'location_return';
    }

    // 7. Combat attack
    if (/(?:атак(?:ую|а)|стреля(?:ю|ем)|бь(?:ю|ем)|рубл(?:ю|ем)|кол(?:ю|ем)|удар(?:ить|яю)|мечом|арбалет|лук|заклинани(?:е|ем)\s+урон|файербол|снаряд)/i.test(text)) {
      return 'combat_attack';
    }

    // 8. Social influence / dialogue
    if (/(?:убежд(?:аю|аем)|договор|торг(?:уюсь|уемся)|расспрашива(?:ю|ем)|угрожа(?:ю|ем)|обман(?:ываю|ем)|предлага(?:ю|ем)|прош(?:у|им))/i.test(text)) {
      return 'social_influence';
    }

    // 9. Environmental interaction
    if (/(?:рычаг|кнопк|дверь|факел|костер|веревк|открыва(?:ю|ем)|толка(?:ю|ем)|поджига(?:ю|ем)|туш(?:у|им))/i.test(text)) {
      return 'environment_interaction';
    }

    // 10. Rest
    if (/(?:отдых|привал|ночлег|спим|лагерь)/i.test(text)) {
      return 'rest_recovery';
    }

    return 'general_action';
  }

  /**
   * Resolves target SceneEntity from physical text or speech addressee.
   */
  private resolveTargetEntity(
    text: string,
    room: RoomEntity,
    addressedName?: string
  ): SceneEntity | null {
    sceneEntityManager.ensureSceneEntities(room);
    const entities = room.sceneEntities || [];

    // Check addressed name first
    if (addressedName) {
      const match = sceneEntityManager.findEntityByMatch(entities, addressedName);
      if (match) return match;
    }

    // Check direct mention in text
    return sceneEntityManager.findEntityByMatch(entities, text);
  }

  /**
   * Resolves target searched object key (e.g. cart, chest, secret cache).
   */
  private resolveSearchedObjectKey(text: string, room: RoomEntity): string | undefined {
    const lower = text.toLowerCase();
    const registry = room.searchedObjectsRegistry || [];

    for (const entry of registry) {
      // Check targetKey or targetName
      if (lower.includes(entry.targetKey.toLowerCase()) || lower.includes(entry.targetName.toLowerCase())) {
        return entry.targetKey;
      }
    }

    // Generic key generation for newly targeted search targets
    if (/повозк|телег/i.test(lower)) return 'vehicle_cart';
    if (/сундук/i.test(lower)) return 'container_chest';
    if (/шкаф/i.test(lower)) return 'container_wardrobe';
    if (/потайной|тайник/i.test(lower)) return 'cache_secret';
    if (/труп|тело/i.test(lower)) return 'corpse_target';
    if (/комнат|помещени/i.test(lower)) return 'room_area';

    return undefined;
  }

  /**
   * Resolves used item from actor's inventory.
   */
  private resolveUsedItem(
    text: string,
    character: CharacterEntity | undefined
  ): { id: string; name: string } | undefined {
    if (!character || !character.inventory || character.inventory.length === 0) {
      return undefined;
    }

    const textTokens = extractSearchTokens(text);

    for (const item of character.inventory) {
      const itemTokens = extractSearchTokens(item.name);
      const isMatch = itemTokens.some((it) =>
        textTokens.some((tt) => tt === it || (tt.length >= 4 && it.length >= 4 && (tt.includes(it) || it.includes(tt))))
      );

      if (isMatch) {
        return { id: item.id, name: item.name };
      }
    }

    return undefined;
  }
}

export const actionIntentEngine = new ActionIntentEngine();

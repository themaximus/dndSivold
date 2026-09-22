import {
  IRoomRepository,
  roomRepository,
  ICharacterRepository,
  characterRepository,
} from '../../repositories';
import { talentTreeGenerator } from '../progression/TalentTreeGenerator';
import { CharacterEntity } from '../../db';

export class CharacterProgressionService {
  private rooms: IRoomRepository;
  private characters: ICharacterRepository;

  constructor(
    rooms: IRoomRepository = roomRepository,
    characters: ICharacterRepository = characterRepository
  ) {
    this.rooms = rooms;
    this.characters = characters;
  }

  /**
   * Applies a Death Saving throw to a downed character.
   */
  public rollDeathSave(
    characterId: string,
    rollRequest: { rollTotal: number; isNat20: boolean; isNat1: boolean }
  ) {
    return this.characters.applyDeathSave(
      characterId,
      rollRequest.rollTotal,
      rollRequest.isNat20,
      rollRequest.isNat1
    );
  }

  /**
   * Generates the progression talent tree for a character.
   */
  public getCharacterTalents(characterId: string) {
    const character = this.characters.findById(characterId);
    if (!character) return null;
    return talentTreeGenerator.generateTree(character);
  }

  /**
   * Learns a talent from the tree, applying stat bonuses or ability unlocks.
   */
  public learnTalent(characterId: string, talentId: string) {
    const character = this.characters.findById(characterId);
    if (!character) return null;

    const tree = talentTreeGenerator.generateTree(character);
    const allTalents = [
      ...tree.classBranch.talents,
      ...tree.raceBranch.talents,
      ...tree.quentaBranch.talents,
    ];

    const talent = allTalents.find((t) => t.id === talentId);
    if (!talent) return null;

    return this.characters.learnTalent(characterId, talentId, talent.effects);
  }

  /**
   * Performs a short rest to spend hit dice and regain HP.
   */
  public performShortRest(roomId: string, characterId: string, diceCount?: number) {
    const room = this.rooms.findById(roomId);
    if (room && room.activeEnemies && room.activeEnemies.some((e) => !e.isDead && e.hpCurrent > 0)) {
      throw new Error('Нельзя отдыхать во время активного боя! Сначала одолейте противников.');
    }
    return this.characters.performShortRest(characterId, diceCount);
  }

  /**
   * Performs a long rest to restore full HP, hit dice, and spell slots.
   */
  public performLongRest(roomId: string, characterId: string) {
    const room = this.rooms.findById(roomId);
    if (room && room.activeEnemies && room.activeEnemies.some((e) => !e.isDead && e.hpCurrent > 0)) {
      throw new Error('Нельзя отдыхать во время активного боя! Сначала одолейте противников.');
    }
    return this.characters.performLongRest(characterId, room?.roundNumber);
  }
}

export const characterProgressionService = new CharacterProgressionService();

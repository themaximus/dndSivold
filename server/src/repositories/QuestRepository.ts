import crypto from 'crypto';
import { db, QuestEntity, QuestStatus, QuestCategory } from '../db';
import { IRepository } from './IRepository';

export interface IQuestRepository extends IRepository<QuestEntity> {
  findByRoomId(roomId: string): QuestEntity[];
  getActiveQuests(roomId: string): QuestEntity[];
  getCompletedQuests(roomId: string): QuestEntity[];
  createOrGetQuest(
    roomId: string,
    title: string,
    description: string,
    category: QuestCategory,
    roundNumber: number,
    giverName?: string,
    targetName?: string
  ): QuestEntity;
  completeQuest(
    roomId: string,
    questIdOrTitle: string,
    roundNumber: number,
    resolutionNote?: string
  ): QuestEntity | null;
  failQuest(
    roomId: string,
    questIdOrTitle: string,
    roundNumber: number,
    note?: string
  ): QuestEntity | null;
  update(id: string, updates: Partial<QuestEntity>, roomId?: string): QuestEntity | null;
}

export class QuestRepository implements IQuestRepository {
  public findById(id: string): QuestEntity | undefined {
    return db.quests.findById(id);
  }

  public create(entry: QuestEntity): QuestEntity {
    return db.quests.create(entry);
  }

  public findByRoomId(roomId: string): QuestEntity[] {
    return db.quests.findByRoomId(roomId);
  }

  public getActiveQuests(roomId: string): QuestEntity[] {
    return db.quests.findByRoomId(roomId).filter(q => q.status === 'active');
  }

  public getCompletedQuests(roomId: string): QuestEntity[] {
    return db.quests.findByRoomId(roomId).filter(q => q.status === 'completed');
  }

  public createOrGetQuest(
    roomId: string,
    title: string,
    description: string,
    category: QuestCategory,
    roundNumber: number,
    giverName?: string,
    targetName?: string
  ): QuestEntity {
    const existing = db.quests.findByRoomId(roomId).find(
      q => q.title.toLowerCase().trim() === title.toLowerCase().trim()
    );

    if (existing) {
      return existing;
    }

    const newQuest: QuestEntity = {
      id: `quest_${crypto.randomUUID().slice(0, 8)}`,
      roomId,
      title: title.trim(),
      description: description.trim(),
      category,
      status: 'active',
      giverName,
      targetName,
      roundCreated: roundNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return db.quests.create(newQuest);
  }

  public completeQuest(
    roomId: string,
    questIdOrTitle: string,
    roundNumber: number,
    resolutionNote?: string
  ): QuestEntity | null {
    return db.quests.complete(roomId, questIdOrTitle, roundNumber, resolutionNote);
  }

  public failQuest(
    roomId: string,
    questIdOrTitle: string,
    roundNumber: number,
    note?: string
  ): QuestEntity | null {
    return db.quests.fail(roomId, questIdOrTitle, roundNumber, note);
  }

  public update(id: string, updates: Partial<QuestEntity>, roomId?: string): QuestEntity | null {
    return db.quests.update(id, updates, roomId);
  }
}

export const questRepository = new QuestRepository();

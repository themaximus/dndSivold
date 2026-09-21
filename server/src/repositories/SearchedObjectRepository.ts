import crypto from 'crypto';
import { db, SearchedObjectEntry, SearchedObjectType } from '../db';
import { IRepository } from './IRepository';

export interface ISearchedObjectRepository extends IRepository<SearchedObjectEntry> {
  findByRoomId(roomId: string): SearchedObjectEntry[];
  findMatching(roomId: string, query: string): SearchedObjectEntry | undefined;
  recordSearch(
    roomId: string,
    targetName: string,
    targetType: SearchedObjectType,
    roundNumber: number,
    extractedItems?: string[],
    narrativeNote?: string
  ): SearchedObjectEntry;
}

export class SearchedObjectRepository implements ISearchedObjectRepository {
  public findById(id: string): SearchedObjectEntry | undefined {
    return (db.searchedObjects?.findByRoomId?.('') || []).find((s: SearchedObjectEntry) => s.id === id);
  }

  public create(entry: SearchedObjectEntry): SearchedObjectEntry {
    return db.searchedObjects.record(entry);
  }

  public findByRoomId(roomId: string): SearchedObjectEntry[] {
    return db.searchedObjects.findByRoomId(roomId);
  }

  public findMatching(roomId: string, query: string): SearchedObjectEntry | undefined {
    return db.searchedObjects.findMatching(roomId, query);
  }

  public recordSearch(
    roomId: string,
    targetName: string,
    targetType: SearchedObjectType = 'other',
    roundNumber: number,
    extractedItems: string[] = [],
    narrativeNote?: string
  ): SearchedObjectEntry {
    const targetKey = targetName.toLowerCase().trim().replace(/[^a-zа-яё0-9]+/gi, '_');
    const entry: SearchedObjectEntry = {
      id: crypto.randomUUID(),
      roomId,
      targetKey,
      targetName,
      targetType,
      status: 'searched',
      searchedInRound: roundNumber,
      extractedItems,
      narrativeNote,
      timestamp: new Date().toISOString(),
    };
    return db.searchedObjects.record(entry);
  }
}

export const searchedObjectRepository = new SearchedObjectRepository();

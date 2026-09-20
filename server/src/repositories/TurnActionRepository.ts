import { db, TurnActionEntity } from '../db';
import { IRepository } from './IRepository';

export interface ITurnActionRepository extends IRepository<TurnActionEntity> {
  findByRoomAndRound(roomId: string, roundNumber: number): TurnActionEntity[];
}

export class TurnActionRepository implements ITurnActionRepository {
  public findById(id: string): TurnActionEntity | undefined {
    return undefined;
  }

  public create(action: TurnActionEntity): TurnActionEntity {
    return db.turnActions.create(action);
  }

  public findByRoomAndRound(roomId: string, roundNumber: number): TurnActionEntity[] {
    return db.turnActions.findByRoomAndRound(roomId, roundNumber);
  }
}

export const turnActionRepository = new TurnActionRepository();

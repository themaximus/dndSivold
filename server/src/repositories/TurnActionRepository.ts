import { db, TurnActionEntity } from '../db';
import { IRepository } from './IRepository';

export interface ITurnActionRepository extends IRepository<TurnActionEntity> {
  findByRoomAndRound(roomId: string, roundNumber: number): TurnActionEntity[];
  delete(id: string): void;
  deleteByPlayerAndRound(roomId: string, roundNumber: number, playerId: string): void;
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

  public delete(id: string): void {
    db.turnActions.remove(id);
  }

  public deleteByPlayerAndRound(roomId: string, roundNumber: number, playerId: string): void {
    db.turnActions.removeByPlayerAndRound(roomId, roundNumber, playerId);
  }
}

export const turnActionRepository = new TurnActionRepository();

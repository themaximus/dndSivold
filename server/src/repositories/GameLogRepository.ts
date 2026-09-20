import { db, GameLogEntity } from '../db';
import { IRepository } from './IRepository';

export interface IGameLogRepository extends IRepository<GameLogEntity> {
  findByRoomId(roomId: string): GameLogEntity[];
}

export class GameLogRepository implements IGameLogRepository {
  public findById(id: string): GameLogEntity | undefined {
    return undefined;
  }

  public create(log: GameLogEntity): GameLogEntity {
    return db.gameLogs.create(log);
  }

  public findByRoomId(roomId: string): GameLogEntity[] {
    return db.gameLogs.findByRoomId(roomId);
  }
}

export const gameLogRepository = new GameLogRepository();

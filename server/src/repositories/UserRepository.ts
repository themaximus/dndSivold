import { db, UserEntity } from '../db';
import { IRepository } from './IRepository';

export interface IUserRepository extends IRepository<UserEntity> {
  findByUsername(username: string): UserEntity | undefined;
}

export class UserRepository implements IUserRepository {
  public findById(id: string): UserEntity | undefined {
    return db.users.findById(id);
  }

  public findByUsername(username: string): UserEntity | undefined {
    return db.users.findByUsername(username);
  }

  public create(user: UserEntity): UserEntity {
    return db.users.create(user);
  }
}

export const userRepository = new UserRepository();

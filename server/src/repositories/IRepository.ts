export interface IRepository<T, TId = string> {
  findById(id: TId): T | undefined;
  create(entity: T): T;
}

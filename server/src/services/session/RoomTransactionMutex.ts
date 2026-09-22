/**
 * RoomTransactionMutex
 * 
 * Provides sequential, transactional execution per room.
 * Prevents race conditions where simultaneous player submissions, automated turn resolutions,
 * AI completion callbacks, or rest actions read and overwrite state concurrently.
 */
export class RoomTransactionMutex {
  private activeLocks: Map<string, Promise<any>> = new Map();

  /**
   * Executes an asynchronous operation exclusively for a given room.
   * Ensures that subsequent operations for the same roomId wait until this operation completes.
   */
  public async runExclusive<T>(roomId: string, operation: () => Promise<T>): Promise<T> {
    const currentPromise = this.activeLocks.get(roomId) || Promise.resolve();

    let releaseLock: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Chain the new operation after the existing lock
    this.activeLocks.set(
      roomId,
      currentPromise.catch(() => {}).then(() => nextPromise)
    );

    try {
      await currentPromise.catch(() => {});
      return await operation();
    } finally {
      releaseLock!();
      // If no other operations are pending, cleanup the map entry
      if (this.activeLocks.get(roomId) === nextPromise) {
        this.activeLocks.delete(roomId);
      }
    }
  }

  /**
   * Checks if a room currently has an operation in progress.
   */
  public isLocked(roomId: string): boolean {
    return this.activeLocks.has(roomId);
  }
}

export const roomTransactionMutex = new RoomTransactionMutex();

type Handler<R> = () => Promise<R>
interface HandlerPack<R, T> {
	handler: Handler<R>
	ok: (result: R) => void
	bad: (error: unknown) => void
	ids: readonly T[] | null
}

/** A set of locks.
 * Intended for case when you have several objects, but want to manipulate one at a time, sometimes several at a time, sometimes all of them.
 *
 * Not very performant, but will do for this app. */
export class LockSet<T> {
	private globalLock = 0
	private lockedIds = new Set<T>()
	private waiters = new Set<HandlerPack<any, T>>()

	withLock<R>(id: T, handler: Handler<R>): Promise<R> {
		return this.withLocks([id], handler)
	}

	withLocks<R>(ids: readonly T[], handler: Handler<R>): Promise<R> {
		return this.addPack([...ids], handler)
	}

	withGlobalLock<R>(handler: Handler<R>): Promise<R> {
		return this.addPack(null, handler)
	}

	private addPack<R>(ids: readonly T[] | null, handler: Handler<R>): Promise<R> {
		return new Promise<R>((ok, bad) => {
			const pack: HandlerPack<R, T> = {handler, ids, ok, bad}
			this.waiters.add(pack)
			void this.checkAndTryRunning(pack)
		})
	}

	private canRun<R>(pack: HandlerPack<R, T>): boolean {
		if(this.globalLock){
			return false
		}

		if(pack.ids === null){
			if(this.lockedIds.size > 0){
				return false
			}
		} else {
			for(const id of pack.ids){
				if(this.lockedIds.has(id)){
					return false
				}
			}
		}

		return true
	}

	private lockPack<R>(pack: HandlerPack<R, T>): void {
		if(pack.ids !== null){
			for(const id of pack.ids){
				this.lockedIds.add(id)
			}
		} else {
			this.globalLock++
		}
	}

	private unlockPack<R>(pack: HandlerPack<R, T>): void {
		if(pack.ids !== null){
			for(const id of pack.ids){
				this.lockedIds.delete(id)
			}
		} else {
			this.globalLock--
		}
	}

	private async checkAndTryRunning<R>(pack: HandlerPack<R, T>): Promise<void> {
		if(!this.canRun(pack)){
			return
		}

		this.waiters.delete(pack)
		this.lockPack(pack)

		try {
			const result = await pack.handler.call(null)
			pack.ok(result)
		} catch(e){
			pack.bad(e)
		}

		this.unlockPack(pack)
		this.tryMoveQueue()
	}

	private tryMoveQueue(): void {
		for(const pack of [...this.waiters]){
			void this.checkAndTryRunning(pack)
		}
	}
}
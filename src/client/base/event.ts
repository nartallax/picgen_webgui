type Handler<T> = (value: T) => void

export class Event<T> {
	private subs: Handler<T>[] = []

	fire(value: T) {
		for(const sub of this.subs){
			sub(value)
		}
	}

	subscribe(handler: Handler<T>): void {
		this.subs.push(handler)
	}

	unsubscribe(handler: Handler<T>): void {
		this.subs = this.subs.filter(x => x !== handler)
	}

	async subscribeUntil<X>(promise: Promise<X>, handler: Handler<T>): Promise<X> {
		this.subscribe(handler)
		try {
			return await promise
		} finally {
			this.unsubscribe(handler)
		}
	}
}
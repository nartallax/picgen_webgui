type BoxSubscriber<T> = (box: T) => void

/** Stack of boxes that are currently computing their value
 * Each box that can possibly want to call other boxes should put an item on top of the stack
 * That way, proper dependency graph can be built */
export class BoxNotificationStack<T> {
	private notificationStack: (BoxSubscriber<T> | null)[] = []
	withAccessNotifications<R>(action: () => R, onAccess: BoxSubscriber<T> | null): R {
		this.notificationStack.push(onAccess)
		let result: R
		try {
			result = action()
		} finally {
			this.notificationStack.pop()
		}
		return result
	}

	notifyOnAccess(v: T): void {
		const stackTop = this.notificationStack[this.notificationStack.length - 1]
		if(stackTop){
			stackTop(v)
		}
	}
}
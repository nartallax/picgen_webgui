export interface User {
	readonly id: number
	readonly creationTime: number
	avatarUrl: string
	displayName: string | null
}

enum GenerationStatus {
	queued = 1,
	running = 2,
	done = 3
}

export interface GenerationTask {
	readonly id: number
	readonly userId: number
	status: GenerationStatus
	readonly creationTime: number
	startTime: number | null
	finishTime: number | null
}

export interface Picture {
	readonly id: number
	readonly generationTaskId: number
	readonly creationTime: number
}
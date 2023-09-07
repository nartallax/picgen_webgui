import {WBox} from "@nartallax/cardboard"
import {TaskPanel} from "client/components/task_panel/task_panel"
import {Feed, SimpleFeedFetcherParams, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {GenerationTask, GenerationTaskWithPictures} from "common/entities/generation_task"

import * as css from "./feeds.module.scss"

interface Props {
	fetch: SimpleFeedFetcherParams<GenerationTask, GenerationTaskWithPictures>["fetch"]
	values?: WBox<GenerationTaskWithPictures[]>
}

export const TaskFeed = (props: Props) => Feed({
	scrollToTopButton: true,
	getId: task => task.id,
	loadNext: makeSimpleFeedFetcher<GenerationTask, GenerationTaskWithPictures>({
		fetch: props.fetch,
		desc: true,
		packSize: 10
	}),
	values: props.values,
	renderElement: taskBox => TaskPanel({task: taskBox}),
	class: css.mainPageFeed
})
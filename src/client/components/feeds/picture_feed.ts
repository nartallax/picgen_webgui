import {Feed, SimpleFeedFetcherParams, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import * as css from "./feeds.module.scss"
import {TaskPicture} from "client/components/task_picture/task_picture"
import {thumbnailProvider} from "client/app/global_values"
import {Picture, PictureWithTask} from "common/entities/picture"

interface Props extends Partial<SimpleFeedFetcherParams<Picture, PictureWithTask>> {
	fetch: SimpleFeedFetcherParams<Picture, PictureWithTask>["fetch"]
}

export const PictureFeed = (props: Props) => {
	const thumbContext = thumbnailProvider.makeContext()
	return Feed({
		scrollToTopButton: true,
		class: css.mainPageFeed,
		containerClass: css.favoritesFeed,
		getId: picture => picture.id,
		renderElement: picture => TaskPicture({picture, thumbContext}),
		loadNext: makeSimpleFeedFetcher<Picture, PictureWithTask>({
			desc: true,
			packSize: 50,
			...props
		})
	})
}
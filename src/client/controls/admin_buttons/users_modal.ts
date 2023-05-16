import {box} from "@nartallax/cardboard"
import {tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {Feed, makeSimpleFeedFetcher} from "client/controls/feed/feed"
import {showModal} from "client/controls/modal_base/modal"
import {User} from "common/entities/user"
import * as css from "./admin.module.scss"

export function showUsersModal(): void {

	showModal({title: "Users", width: ["300px", "50vw", "600px"], height: ["300px", "75vh", null]}, [
		Feed({
			values: box([] as User[]),
			getId: user => user.id,
			loadNext: makeSimpleFeedFetcher<User>({
				fetch: ClientApi.adminListUsers,
				packSize: 25
			}),
			renderElement: user => tag({class: css.userLine, tag: "button"}, [
				tag([user.prop("discordId")]),
				tag([user.prop("displayName")]),
				tag([user.map(user => {
					return [
						!user.isAdmin ? "" : "admin",
						!user.isAllowed ? "" : "allowed"
					].filter(x => !!x).join(", ")
				})])
			])
		})
	])

}
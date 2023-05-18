import {ClientApi} from "client/app/client_api"
import {showModal} from "client/controls/modal_base/modal"
import {User} from "common/entities/user"
import {Table} from "client/controls/table/table"
import {box} from "@nartallax/cardboard"
import {showUserModal} from "client/components/admin_buttons/user_modal"
import {currentUser} from "client/app/global_values"

export function showUsersModal(): void {

	const values = box([] as User[])

	async function editUser(user: User): Promise<void> {
		const value = box({...user})
		const modal = showUserModal({value})
		const closeEvt = await modal.waitClose()
		if(closeEvt.reason === "confirm"){
			await ClientApi.adminUpdateUser(value())
			values([])
			if(user.id === currentUser()?.id){
				currentUser(await ClientApi.getUserData())
			}
		}
	}

	showModal({title: "Users", width: ["25rem", "50vw", "50rem"], height: ["25rem", "75vh", null]}, [
		Table<User>({
			values,
			headers: [{
				label: "ID",
				getValue: user => user.id + "",
				width: "2.5rem"
			}, {
				label: "Discord ID",
				getValue: user => user.discordId,
				width: "13rem"
			}, {
				label: "Name",
				getValue: user => user.displayName
			}, {
				label: "Caps",
				width: "9rem",
				getValue: user => {
					return [
						!user.isAdmin ? "" : "admin",
						!user.isAllowed ? "" : "allowed"
					].filter(x => !!x).join(", ")
				}
			}],
			fetch: ClientApi.adminListUsers,
			onRowClick: user => editUser(user)
		})
	])

}
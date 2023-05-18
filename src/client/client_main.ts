import {waitDocumentLoaded} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser, isUserControlEnabled, pages} from "client/app/global_values"
import {MultiPanel} from "client/controls/multi_panel/multi_panel"
import {ApiError} from "common/infra_entities/api_error"

export async function main() {
	await waitDocumentLoaded()

	document.body.appendChild(MultiPanel({
		items: pages,
		value: currentPage
	}))

	try {
		const [user, isUserControlEnabledValue] = await Promise.all([
			ClientApi.getUserData(),
			ClientApi.getIsUserControlEnabled()
		])
		isUserControlEnabled(isUserControlEnabledValue)
		currentUser(user)
		currentPage("main")
	} catch(e){
		if(ApiError.isApiError(e)){
			switch(e.errorType){
				case "not_logged_in":
					currentPage("login")
					return
				case "permission":
					currentPage("not_allowed")
					return
			}
		}

		throw e
	}
}

main()
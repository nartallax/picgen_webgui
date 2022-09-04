import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser, pages} from "client/app/global_values"
import {waitDocumentLoaded} from "client/base/wait_document_loaded"
import {MultiPanel} from "client/controls/multi_panel/multi_panel"
import {ApiError} from "common/api_error"

export async function main() {
	await waitDocumentLoaded()

	document.body.appendChild(MultiPanel({
		items: pages,
		value: currentPage
	}))

	try {
		const user = await ClientApi.getUserData()
		console.log(user)
		currentUser(user)
		currentPage("main")
	} catch(e){
		if(e instanceof ApiError && e.errorType === "not_logged_in"){
			currentPage("login")
		} else {
			throw e
		}
	}
}
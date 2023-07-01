import {waitDocumentLoaded, whileMounted} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {currentPage, currentUser, isUserControlEnabled, pages, uiScale, visualTheme} from "client/app/global_values"
import {MultiPanel} from "client/controls/multi_panel/multi_panel"
import {ApiError} from "common/infra_entities/api_error"

export async function main() {
	await waitDocumentLoaded()

	const rootPanel = MultiPanel({
		items: pages,
		value: currentPage
	})

	document.body.appendChild(rootPanel)

	whileMounted(rootPanel, uiScale, scale => {
		document.documentElement.style.fontSize = Math.round((12 * scale)) + "px"
	})

	whileMounted(rootPanel, visualTheme, theme => {
		document.body.setAttribute("data-visual-theme", theme)
	})

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
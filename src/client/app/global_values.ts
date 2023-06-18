import {WBox, box} from "@nartallax/cardboard"
import {localStorageBox} from "@nartallax/cardboard-dom"
import {LoadingPage} from "client/pages/loading_page/loading_page"
import {LoginPage} from "client/pages/login_page/login_page"
import {MainPage} from "client/pages/main_page/main_page"
import {NotAllowedPage} from "client/pages/not_allowed_page/not_allowed_page"
import {GenerationTaskArgument} from "common/entities/arguments"
import {JsonFileListItemDescription} from "common/entities/json_file_list"
import {GenerationParameterSet} from "common/entities/parameter"
import {User} from "common/entities/user"


export const currentUser = box<User | null>(null)
export const currentPage = box<PageName>("loading")
export const isUserControlEnabled = box(true)

export const uiScale = localStorageBox("userSettings.uiScale", 1)
export const jsonFileListOrdering = localStorageBox<Record<string, string[]>>("userSettings.jsonFileListOrdering", {})
export const hideSomeScrollbars = localStorageBox<boolean>("userSettings.hideSomeScrollbars", false)

export const currentArgumentBoxes = box<{[key: string]: WBox<GenerationTaskArgument>}>({})
export const currentParamSetName = localStorageBox("fixedGenArgument.selectedParamSetName", "")
export const currentShapeTag = localStorageBox<string | null>("fixedGenArgument.prompt.shape", null)
export const currentPrompt = localStorageBox("fixedGenArgument.prompt.prompt", "")

export const allKnownShapeTags = box<null | readonly string[]>(null)
export const allKnownParamSets = box<GenerationParameterSet[]>([])
export const allKnownJsonFileLists = box<{readonly [name: string]: readonly JsonFileListItemDescription[]}>({})

export type PageName = keyof typeof _pages

const _pages = {
	login: LoginPage,
	main: MainPage,
	loading: LoadingPage,
	not_allowed: NotAllowedPage
}

export const pages = _pages as {readonly [key in PageName]: () => HTMLElement}
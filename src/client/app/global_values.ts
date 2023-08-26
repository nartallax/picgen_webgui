import {box} from "@nartallax/cardboard"
import {localStorageBox} from "@nartallax/cardboard-dom"
import {ThumbnailProvider} from "client/app/thumbnail_provider"
import {globalCssVariableLocalStorageBox} from "client/base/css_variable_box"
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

export const uiScale = localStorageBox(document.body, "userSettings.uiScale", 1)
export const jsonFileListOrdering = localStorageBox<Record<string, string[]>>(document.body, "userSettings.jsonFileListOrdering", {})
export const hideSomeScrollbars = localStorageBox<boolean>(document.body, "userSettings.hideSomeScrollbars", false)
export const preventGalleryImageInteractions = localStorageBox(document.body, "preventGalleryImageInteractions", false)
export const paramsColumnWidth = globalCssVariableLocalStorageBox("--params-column-width", "20vw")
export const paramsColumnMaxWidth = globalCssVariableLocalStorageBox("--params-column-max-width", "35rem")
export const paramsColumnMinWidth = globalCssVariableLocalStorageBox("--params-column-min-width", "20rem")
export const formLabelWidth = globalCssVariableLocalStorageBox("--form-label-width", "50%")
export const visualTheme = localStorageBox<"default" | "dark">(document.body, "userSettings.visualTheme", "default")

export const argumentsByParamSet = localStorageBox<Record<string, Record<string, GenerationTaskArgument>>>(document.body, "genArguments", {})
export const currentParamSetName = localStorageBox(document.body, "fixedGenArgument.selectedParamSetName", "")
export const currentShapeTag = localStorageBox<string | null>(document.body, "fixedGenArgument.prompt.shape", null)
export const currentPrompt = localStorageBox(document.body, "fixedGenArgument.prompt.prompt", "")
export const currentParamSetArgs = box(argumentsByParamSet.get()[currentParamSetName.get()] ?? {})

export const allKnownShapeTags = box<null | readonly string[]>(null)
export const allKnownParamSets = box<GenerationParameterSet[]>([])
export const allKnownJsonFileLists = box<{readonly [name: string]: readonly JsonFileListItemDescription[]}>({})

// export const currentArguments = calcBox([argumentsByParamSet, currentParamSetName, allKnownParamSets],
// 	(allArgs, name, allParamSets) => {
// 		const paramSet = allParamSets.find(set => set.internalName === name)
// 		if(!paramSet){
// 			return null
// 		}
// 		console.log("fwdmap", allArgs)
// 		return fixArgumentMap(allArgs[name] ?? {}, paramSet.parameterGroups)
// 	},
// 	(value, allArgs, name, allParamSets) => [value === null ? allArgs : {...allArgs, [name]: value}, name, allParamSets]
// )

export const thumbnailProvider = new ThumbnailProvider()

export type PageName = keyof typeof _pages

const _pages = {
	login: LoginPage,
	main: MainPage,
	loading: LoadingPage,
	not_allowed: NotAllowedPage
}

export const pages = _pages as {readonly [key in PageName]: () => HTMLElement}
import {WBox, box} from "@nartallax/cardboard"
import {localStorageBox} from "@nartallax/cardboard-dom"
import {ThumbnailProvider} from "client/app/thumbnail_provider"
import {cssVariableLocalStorageBox} from "client/base/css_variable_box"
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
export const preventGalleryImageInteractions = localStorageBox("preventGalleryImageInteractions", false)
export const paramsColumnWidth = cssVariableLocalStorageBox("--params-column-width", "20vw")
export const paramsColumnMaxWidth = cssVariableLocalStorageBox("--params-column-max-width", "35rem")
export const paramsColumnMinWidth = cssVariableLocalStorageBox("--params-column-min-width", "20rem")
export const formLabelWidth = cssVariableLocalStorageBox("--form-label-width", "50%")

export const currentArgumentBoxes = box<{[key: string]: WBox<GenerationTaskArgument>}>({})
export const currentParamSetName = localStorageBox("fixedGenArgument.selectedParamSetName", "")
export const currentShapeTag = localStorageBox<string | null>("fixedGenArgument.prompt.shape", null)
export const currentPrompt = localStorageBox("fixedGenArgument.prompt.prompt", "")

export const allKnownShapeTags = box<null | readonly string[]>(null)
export const allKnownParamSets = box<GenerationParameterSet[]>([])
export const allKnownJsonFileLists = box<{readonly [name: string]: readonly JsonFileListItemDescription[]}>({})

export const thumbnailProvider = new ThumbnailProvider()

export type PageName = keyof typeof _pages

const _pages = {
	login: LoginPage,
	main: MainPage,
	loading: LoadingPage,
	not_allowed: NotAllowedPage
}

export const pages = _pages as {readonly [key in PageName]: () => HTMLElement}
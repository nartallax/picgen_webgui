import {box} from "@nartallax/cardboard"
import {LoadingPage} from "client/controls/loading_page/loading_page"
import {LoginPage} from "client/controls/login_page/login_page"
import {MainPage} from "client/controls/main_page/main_page"
import {User} from "common/entity_types"


export const currentUser = box(null as User | null)
export const currentPage = box("loading" as PageName)

export type PageName = keyof typeof _pages

const _pages = {
	login: LoginPage,
	main: MainPage,
	loading: LoadingPage
}

export const pages = _pages as {readonly [key in PageName]: () => HTMLElement}
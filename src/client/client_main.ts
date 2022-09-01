import {waitDocumentLoaded} from "client/base/wait_document_loaded"
import {Page} from "client/controls/page/page"

export async function main() {
	await waitDocumentLoaded()
	document.body.appendChild(Page())
}
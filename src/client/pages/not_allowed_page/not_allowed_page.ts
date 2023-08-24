import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {Button} from "client/controls/button/button"
import {Col, Row} from "client/controls/layout/row_col"
import {TextBlock} from "client/controls/text_block/text_block"

export function NotAllowedPage(): HTMLElement {
	return Row({grow: 1}, [
		Col({grow: 1}, [
			BlockPanel([
				BlockPanelHeader({header: "Not allowed"}),
				TextBlock({text: "Ask admin for permission to use this application."}),
				Row({padding: "top"}, [
					Button({
						text: "Refresh page",
						onClick: () => window.location.reload()
					})
				])
			])
		])
	])
}
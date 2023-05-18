import {RBox, WBox, box, unbox, viewBox} from "@nartallax/cardboard"
import {whileMounted} from "@nartallax/cardboard-dom"
import {BlockPanel} from "client/components/block_panel/block_panel"
import {BlockPanelHeader} from "client/components/block_panel_header/block_panel_header"
import {TagList} from "client/controls/tag_list/tag_list"
import {TextInput} from "client/controls/text_input/text_input"
import {PrefixTree} from "client/data_structure/prefix_tree"

interface TagSearchBlockProps {
	selectedContentTags: WBox<readonly string[]>
	contentTags: RBox<null | {readonly [tagContent: string]: readonly string[]}>
	visibleTagLimit: number
}

export function TagSearchBlock(props: TagSearchBlockProps): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	const prompt = box("")

	const visibleContentTags = viewBox(() => {
		const promptStr = prompt().toLowerCase()
		const selectedTagSet = new Set(props.selectedContentTags())
		const visibleTags = prefixTree().getAllValuesWhichKeysInclude(promptStr, selectedTagSet, props.visibleTagLimit)
		return [...visibleTags] as readonly string[]
	})

	const prefixTree = props.contentTags.map(rawTags => {
		if(!rawTags){
			return new PrefixTree([])
		}

		const transformedTags = [] as [string, string[]][]
		for(const tag in rawTags){
			const searchText = [tag, ...rawTags[tag]!].map(x => x.toLowerCase())
			transformedTags.push([tag, searchText])
		}
		return new PrefixTree(transformedTags)
	})

	function renderItems(): HTMLElement[] {
		const tags = unbox(props.contentTags)
		if(!tags){
			return [BlockPanelHeader({header: "Loading..."})]
		}

		return [
			BlockPanelHeader({header: "Tags"}),
			TextInput({
				value: prompt,
				iconClass: "icon-search-1",
				updateAsUserType: true
			}),
			TagList({
				values: visibleContentTags,
				onclick: tagStr => {
					props.selectedContentTags([...props.selectedContentTags(), tagStr])
				}
			})
		]
	}

	const result = BlockPanel(contentItems)

	whileMounted(result, props.contentTags, () => contentItems(renderItems()))

	return result

}
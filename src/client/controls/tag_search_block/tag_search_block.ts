import {getBinder} from "client/base/binder/binder"
import {box, RBox, unbox, viewBox, WBox} from "client/base/box"
import {SettingsBlock} from "client/controls/settings_block/settings_block"
import {SettingsSubblock} from "client/controls/settings_subblock/settings_subblock"
import {TagList} from "client/controls/tag_list/tag_list"
import {TextInput} from "client/controls/text_input/text_input"
import {PrefixTree} from "client/data_structure/prefix_tree"

interface TagSearchBlockOptions {
	selectedContentTags: WBox<string[]>
	contentTags: RBox<null | {readonly [tagContent: string]: readonly string[]}>
	visibleTagLimit: number
}

export function TagSearchBlock(opts: TagSearchBlockOptions): HTMLElement {

	const contentItems = box([] as HTMLElement[])

	const prompt = box("")

	const visibleContentTags = viewBox(() => {
		const promptStr = prompt().toLowerCase()
		const selectedTagSet = new Set(opts.selectedContentTags())
		const visibleTags = prefixTree().getAllValuesWhichKeysInclude(promptStr, selectedTagSet, opts.visibleTagLimit)
		return [...visibleTags] as readonly string[]
	})

	const prefixTree = viewBox(() => {
		const rawTags = unbox(opts.contentTags)
		if(!rawTags){
			return new PrefixTree([])
		}

		const transformedTags = [] as [string, string[]][]
		for(const tag in rawTags){
			const searchText = [...rawTags[tag]!, tag].map(x => x.toLowerCase())
			transformedTags.push([tag, searchText])
		}
		console.trace(transformedTags)
		return new PrefixTree(transformedTags)
	})

	function renderItems(): HTMLElement[] {
		const tags = unbox(opts.contentTags)
		if(!tags){
			return [SettingsSubblock({header: "Loading..."})]
		}

		return [
			SettingsSubblock({header: "Tags"}, [
				TextInput({
					value: prompt,
					iconClass: "icon-search-1",
					updateAsUserType: true
				}),
				TagList({
					values: visibleContentTags,
					onclick: tagStr => {
						opts.selectedContentTags().push(tagStr)
						opts.selectedContentTags.notify()
					}
				})
			])
		]
	}

	const result = SettingsBlock(contentItems)

	const binder = getBinder(result)
	binder.watch(opts.contentTags, () => contentItems(renderItems()))

	return result

}
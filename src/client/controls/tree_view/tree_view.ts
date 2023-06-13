import {isWBox, MRBox, RBox, unbox, WBox} from "@nartallax/cardboard"
import {BoxedProps, defineControl, tag, whileMounted} from "@nartallax/cardboard-dom"
import * as css from "./tree_view.module.scss"
import {addMouseDragHandler, pointerEventsToClientCoords} from "client/client_common/mouse_drag"

export type TreeViewNode<T> = {
	id: number
	parent?: TreeViewNode<T>
	children?: TreeViewNode<T>[]
	value: T
	selectable?: boolean
}

export type TreeViewProps<T> = {
	nodes: RBox<TreeViewNode<T>[]>
	/** A sequence of tree nodes that lead to selected node  */
	value?: WBox<TreeViewNode<T> | null>
	uncollapseLevel?: number
	canReorder?: boolean
	grow?: number
	shrink?: number
	render: (value: T) => string | HTMLElement
}

const defaults = {
	uncollapseLevel: 0,
	grow: 0,
	shrink: 0
} satisfies Partial<TreeViewProps<unknown>>

export const TreeView = defineControl<TreeViewProps<unknown>, typeof defaults>(defaults, <T>(props: BoxedProps<TreeViewProps<T>, typeof defaults>) => {

	let selectedNode: HTMLElement | null = null

	function updateNodeSelection(node: TreeViewNode<T> | null): void {
		if(!props.value){
			return
		}
		if(selectedNode){
			selectedNode.classList.remove(css.selected!)
			selectedNode = null
		}
		if(node){
			const el = findNodeElementById(node.id)
			selectedNode = el
			selectedNode.classList.add(css.selected!)
		}
	}

	function findNodeElementById(id: number): HTMLElement {
		const el = treeRoot.querySelector(`*[data-tree-node-id="${id}"]`)
		if(!(el instanceof HTMLElement)){
			throw new Error("No element for tree node #" + id)
		}
		return el
	}

	function renderChildWrap(children: TreeViewNode<T>[], depth: number): HTMLElement {
		return tag(children.map(child => TreeElement(child, depth + 1)))
	}

	const TreeElement = (node: TreeViewNode<T>, depth: number): HTMLElement => {
		allNodes.set(node.id, node)
		const haveChildren = node.children && node.children.length > 0
		let collapsed = !haveChildren ? false : !uncollapsedNodes.has(node.id) && unbox(props.uncollapseLevel) <= depth
		let childWrap: HTMLElement | null = null
		if(!collapsed && haveChildren){
			childWrap = renderChildWrap(node.children!, depth)
			uncollapsedNodes.add(node.id)
		}
		const line = tag({
			attrs: {"data-tree-node-id": node.id},
			class: [css.treeLine, {
				[css.collapsed!]: collapsed,
				[css.withChildren!]: haveChildren
			}],
			style: {paddingLeft: (depth + 0.25) + "rem"},
			onClick: () => {
				if(haveChildren){
					if(collapsed){
						collapsed = false
						line.classList.remove(css.collapsed!)
						uncollapsedNodes.add(node.id)
						childWrap ||= renderChildWrap(node.children!, depth)
						lineWrap.appendChild(childWrap)
					} else {
						collapsed = true
						line.classList.add(css.collapsed!)
						uncollapsedNodes.delete(node.id)
						if(childWrap){
							childWrap.remove()
							childWrap = null
						}
					}
				}
				if(node.selectable && props.value){
					props.value(node)
				}
			}
		}, [unbox(props.render)(node.value)])

		addReorderHandlers(line)

		const lineWrap = node.children && node.children.length > 0 ? tag([line, childWrap]) : line

		return lineWrap
	}

	const uncollapsedNodes = new Set<number>()
	const allNodes = new Map<number, TreeViewNode<T>>()
	const addReorderHandlers = makeDragHandlers(allNodes, () => treeRoot, props.canReorder, (target, dest, pos) => {
		if(!isWBox(props.nodes)){
			throw new Error("Cannot reorder tree: nodes are not writable")
		}
		props.nodes(reorderTree(props.nodes(), target, dest, pos))
	})

	// yuuup, extra unoptimal, but who cares
	// if I'll ever need something more optimal - I could do that, but right now I just don't want to
	// (this weird trick with another wrapper node is required for proper line sizing in display: grid)
	// (and display: grid solves problem of not properly stretched lines when content overflows width)
	const treeRoot = tag({
		class: css.tree,
		style: {
			flexGrow: props.grow,
			flexShrink: props.shrink
		}
	}, [tag(props.nodes.map(nodes => {
		allNodes.clear()
		nodes.forEach(node => traverse(node, node => allNodes.set(node.id, node)))
		const result = nodes.map(node => TreeElement(node, 0))
		return result
	}))])

	whileMounted<TreeViewNode<T> | null | undefined>(treeRoot, props.value, value => {
		updateNodeSelection(value ?? null)
	})

	return treeRoot
})

function traverse<T>(tree: TreeViewNode<T>, handler: (node: TreeViewNode<T>) => void): void {
	handler(tree)
	if(tree.children){
		for(const child of tree.children){
			traverse(child, handler)
		}
	}
}

function reorderTree<T>(root: TreeViewNode<T>[], target: TreeViewNode<T>, destination: TreeViewNode<T>, position: DragDestinationPosition): TreeViewNode<T>[] {
	if(target.parent){
		if(target.parent.children){
			target.parent.children = target.parent.children.filter(child => child !== target)
		}
		target.parent = undefined
	} else {
		root = root.filter(rootItem => rootItem !== target)
	}
	if(position === "inside"){
		destination.children = [...(destination.children ?? []), target]
		target.parent = destination
	} else {
		let siblingArr: TreeViewNode<T>[]
		if(destination.parent){
			target.parent = destination.parent
			siblingArr = target.parent.children ?? []
		} else {
			siblingArr = root
		}
		let destIndex = siblingArr.indexOf(destination)
		if(destIndex < 0){
			throw new Error("Node #" + destination.id + " is not present in array")
		}
		if(position === "below"){
			destIndex += 1
		}
		siblingArr = [...siblingArr.slice(0, destIndex), target, ...siblingArr.slice(destIndex)]
		if(destination.parent){
			destination.parent.children = siblingArr
		} else {
			root = siblingArr
		}
	}

	return [...root]
}

export function getTreeViewNodePath<T>(leaf: TreeViewNode<T>, result: T[] = []): T[] {
	result.push(leaf.value)
	if(leaf.parent === undefined){
		return result.reverse()
	}
	return getTreeViewNodePath(leaf.parent, result)
}

type DragDestinationPosition = "above" | "below" | "inside"

function makeDragHandlers<T>(allNodes: Map<number, TreeViewNode<T>>, getTreeRoot: () => HTMLElement, canReorder: MRBox<boolean | undefined>, onReorder: (target: TreeViewNode<T>, destination: TreeViewNode<T>, position: DragDestinationPosition) => void): (el: HTMLElement) => void {
	let dragItem: HTMLElement | null = null
	let dragItemWidth: number | null = null
	let dragItemHeight: number | null = null
	let branchDropOverlay: HTMLElement | null = null
	let branchDropOverlayWidth: number | null = null
	let insertLineOverlay: HTMLElement | null = null
	let insertLineOverlayWidth: number | null = null
	let insertLineOverlayHeight: number | null = null
	let treeRoot: HTMLElement | null = null
	let currentDragTarget: TreeViewNode<T> | null = null
	let currentDragDestination: TreeViewNode<T> | null = null
	let currentDragDestinationPosition: DragDestinationPosition = "above"


	function updateBranchDropOverlay(x: number, y: number): void {
		if(insertLineOverlay && insertLineOverlay.parentNode){
			insertLineOverlay.remove()
		}
		if(!branchDropOverlay){
			branchDropOverlay = tag({class: css.branchDropOverlay})
		}
		if(!branchDropOverlay.parentNode){
			document.body.appendChild(branchDropOverlay)
		}
		if(branchDropOverlayWidth === null){
			branchDropOverlayWidth = branchDropOverlay.getBoundingClientRect().width
		}
		branchDropOverlay.style.left = (x - (branchDropOverlayWidth / 2)) + "px"
		branchDropOverlay.style.top = y + "px"
	}

	function updateInsertLineOverlay(x: number, y: number): void {
		if(branchDropOverlay && branchDropOverlay.parentNode){
			branchDropOverlay.remove()
		}
		if(!insertLineOverlay){
			insertLineOverlay = tag({class: css.insertLineOverlay})
		}
		if(!insertLineOverlay.parentNode){
			document.body.appendChild(insertLineOverlay)
		}
		if(insertLineOverlayWidth === null || insertLineOverlayHeight === null){
			const rect = insertLineOverlay.getBoundingClientRect()
			insertLineOverlayWidth = rect.width
			insertLineOverlayHeight = rect.height
		}
		insertLineOverlay.style.left = (x - (insertLineOverlayWidth / 2)) + "px"
		insertLineOverlay.style.top = (y - (insertLineOverlayHeight / 2)) + "px"
	}

	function startDrag(e: MouseEvent | TouchEvent): boolean {
		if(!unbox(canReorder) || !(e.target instanceof Node)){
			return false
		}
		const target = findNodeByAttr(e.target)
		if(!target){
			throw new Error("Cannot start drag: element has no tree node attached")
		}
		currentDragTarget = target
		dragItem ||= tag({class: css.dragItem})
		document.body.appendChild(dragItem)
		document.body.classList.add(css.noCursorImportant!)
		return true
	}

	function stopDrag(): void {
		if(insertLineOverlay && insertLineOverlay.parentNode){
			insertLineOverlay.remove()
		}
		if(branchDropOverlay && branchDropOverlay.parentNode){
			branchDropOverlay.remove()
		}
		document.body.removeChild(dragItem!)
		document.body.classList.remove(css.noCursorImportant!)
		if(currentDragDestination && currentDragTarget && currentDragTarget !== currentDragDestination){
			onReorder(currentDragTarget, currentDragDestination, currentDragDestinationPosition)
		}
		currentDragTarget = null
		currentDragDestination = null
	}

	function onDragMove(e: MouseEvent | PointerEvent): void {
		const coords = pointerEventsToClientCoords(e)
		if(dragItemWidth === null || dragItemHeight === null){
			const rect = dragItem!.getBoundingClientRect()
			dragItemWidth = rect.width
			dragItemHeight = rect.height
		}
		dragItem!.style.left = (coords.x - (dragItemWidth / 2)) + "px"
		dragItem!.style.top = (coords.y - (dragItemHeight / 2)) + "px"

		let dest: EventTarget | Element | null | undefined = e.target
		treeRoot ||= getTreeRoot()
		if(dest === treeRoot){
			dest = treeRoot.lastElementChild?.lastElementChild
		}
		if(!(dest instanceof HTMLElement)){
			return
		}

		const destNode = findNodeByAttr(dest)
		if(!destNode){
			if(branchDropOverlay && branchDropOverlay.parentNode){
				branchDropOverlay.remove()
			}
			if(insertLineOverlay && insertLineOverlay.parentNode){
				insertLineOverlay.remove()
			}
			currentDragDestination = null
			return
		}

		const targetRect = dest.getBoundingClientRect()
		const height = targetRect.height
		const top = targetRect.top
		const dy = coords.y - top
		const isInTopHalf = (height / 2) > dy
		const isInCentralPart = (height / 4) < dy && (height * (3 / 4)) > dy
		currentDragDestination = destNode
		if(destNode.children && isInCentralPart){
			updateBranchDropOverlay(coords.x, targetRect.top)
			currentDragDestinationPosition = "inside"
		} else if(isInTopHalf){
			updateInsertLineOverlay(coords.x, targetRect.top)
			currentDragDestinationPosition = "above"
		} else {
			updateInsertLineOverlay(coords.x, targetRect.bottom)
			currentDragDestinationPosition = "below"
		}
	}

	function findNodeByAttr(el: Node): TreeViewNode<T> | undefined {
		if(!(el instanceof HTMLElement) || el.getAttribute("data-tree-node-id") === null){
			if(el.parentNode && el.parentNode !== document.body){
				return findNodeByAttr(el.parentNode)
			}
			return undefined
		}
		const targetNodeId = parseInt(el.getAttribute("data-tree-node-id") ?? "-1")
		return allNodes.get(targetNodeId)
	}

	function addReorderHandlers(el: HTMLElement): void {
		addMouseDragHandler({
			element: el,
			distanceBeforeMove: 3,
			start: startDrag,
			stop: stopDrag,
			onMove: onDragMove
		})
	}

	return addReorderHandlers
}
import {tag} from "@nartallax/cardboard-dom"
import {RCV} from "@nartallax/ribcage-validation"
import {Button} from "client/controls/button/button"
import {Col, Row} from "client/controls/layout/row_col"
import {showModal} from "client/controls/modal_base/modal"
import {ModalCloseEvent} from "client/controls/modal_base/modal_base"
import {GenerationTaskInputData} from "common/entities/generation_task"

export async function showTaskArgsModal(args?: GenerationTaskInputData): Promise<GenerationTaskInputData | null> {
	let text = ""
	if(args){
		// args may contain some other fields, which are undesireable to show
		const purifiedArgs: GenerationTaskInputData = {
			arguments: args.arguments,
			paramSetName: args.paramSetName
		}
		text = JSON.stringify(purifiedArgs)
	}

	const textArea = tag({
		tag: "textarea",
		attrs: {readonly: !!args, rows: 4},
		style: {resize: "none", padding: "0.25rem", width: "100%"},
		onKeydown: e => {
			if(e.key === "Escape"){
				textArea.blur()
			}
		}
	})

	const modal = showModal({
		title: "Task arguments",
		width: "300px",
		closeByEsc: true
	}, [Col({gap: true}, [
		textArea,
		args ? null : Row({gap: true}, [
			Button({
				text: "OK",
				onClick: () => modal.close("confirm")
			}),
			Button({
				text: "Cancel",
				onClick: () => modal.close()
			})
		])
	])])

	let enterHandler: ((e: KeyboardEvent) => void) | null = null
	if(!args){
		enterHandler = e => {
			if(e.key === "Enter"){
				modal.close("confirm")
			}
		}
		window.addEventListener("keydown", enterHandler)
	}

	if(text){
		textArea.value = text
		textArea.select()
	} else {
		textArea.focus()
	}

	let closeEvt: ModalCloseEvent
	try {
		closeEvt = await modal.waitClose()
	} finally {
		if(enterHandler){
			window.removeEventListener("keydown", enterHandler)
		}
	}

	if(args){
		return args
	} else {
		if(closeEvt.reason !== "confirm"){
			return null
		}
		try {
			const newText = textArea.value
			const newArgsRaw = JSON.parse(newText)
			const newArgs: GenerationTaskInputData = newArgsRaw

			// legacy: "arguments" was named "params" before
			if("params" in newArgsRaw && !("arguments" in newArgsRaw)){
				newArgsRaw["arguments"] = newArgsRaw["params"]
				delete newArgsRaw["params"]
			}

			// legacy: prompt used to be separate value
			if("prompt" in newArgsRaw && !("prompt" in newArgs.arguments)){
				newArgs.arguments["prompt"] = newArgsRaw["prompt"]
				delete newArgsRaw["prompt"]
			}

			const validator = RCV.getValidatorBuilder().build(GenerationTaskInputData)
			validator(newArgs)
			return newArgs
		} catch(e){
			showModal({
				title: "Wrong input",
				closeByBackgroundClick: true,
				closeByEsc: true,
				width: "30rem"
			}, [tag(["Failed to process your input: " + e])])
			throw e
		}
	}

}
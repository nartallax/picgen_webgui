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
			params: args.params,
			paramSetName: args.paramSetName,
			prompt: args.prompt
		}
		text = JSON.stringify(purifiedArgs)
	}

	const textArea = tag({
		tag: "textarea",
		attrs: {readonly: !!args, rows: 4},
		style: {resize: "none", padding: "0.25rem", width: "100%"}
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
				onclick: () => modal.close("confirm")
			}),
			Button({
				text: "Cancel",
				onclick: () => modal.close()
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
			const newArgs: GenerationTaskInputData = JSON.parse(newText)
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
import {WBox, box, calcBox} from "@nartallax/cardboard"
import {bindBox, tag} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {generateUniqDomID} from "client/client_common/generate_uniq_dom_id"
import {readFileToArrayBuffer} from "client/client_common/read_file_to_array_buffer"
import {showImageMaskInput} from "client/components/image_mask_input/image_mask_input"
import * as css from "./picture_input.module.scss"
import {Picture, pictureTypeSet} from "common/entities/picture"
import {PictureGenParam} from "common/entities/parameter"
import {currentParamSetName} from "client/app/global_values"
import {PictureArgument} from "common/entities/arguments"
import {Icon} from "client/generated/icons"

interface PictureInputProps {
	readonly value: WBox<PictureArgument>
	readonly param: PictureGenParam
}

interface ErrorState {
	type: "error"
	error: Error
}

interface LoadingState {
	type: "loading"
	id: number
}

interface UploadingState {
	type: "uploading"
	file: File
}

interface EmptyState {
	type: "empty"
}

interface NonEmptyState {
	type: "value"
	picture: Picture
}

type State = LoadingState | UploadingState | EmptyState | NonEmptyState | ErrorState

export function PictureInput(props: PictureInputProps): HTMLElement {
	const pictureTypesArr: string[] = props.param.allowedTypes ? [...props.param.allowedTypes] : [...pictureTypeSet]
	if(pictureTypesArr.includes("jpg")){
		pictureTypesArr.push("jpeg")
	}

	const state = box<State>({type: "empty"})
	const isFocused = box(false)

	async function onFileSelected(file: File | undefined) {
		if(!file){
			props.value.set({id: 0, salt: 0})
			state.set({type: "empty"})
			return
		}

		state.set({type: "uploading", file})

		try {
			const fileData = await readFileToArrayBuffer(file)
			if(!isUploadingThisFile(file)){
				console.log("Stopping upload process after file is red because different file is selected")
				return
			}
			const name = file.name
			const nameWithoutExt = name.replace(/\.[^.]*$/, "")
			const picture = await ClientApi.uploadPictureAsArgument(currentParamSetName.get(), props.param.jsonName, nameWithoutExt, fileData)
			if(!isUploadingThisFile(file)){
				console.log("Stopping upload process after file is uploaded because different file is selected")
				return
			}

			state.set({type: "value", picture: picture})
			props.value.set({id: picture.id, salt: picture.salt})
		} catch(e){
			console.error(e)
			if(!isUploadingThisFile(file)){
				console.log("Won't show upload error because different file is selected")
				return
			}

			if(!(e instanceof Error)){
				throw e
			}

			state.set({type: "error", error: e})
			props.value.set({id: 0, salt: 0})
		}
	}

	const inputDomId = generateUniqDomID()
	const input: HTMLInputElement = tag({
		tag: "input",
		attrs: {
			id: inputDomId,
			type: "file",
			accept: pictureTypesArr.map(x => "." + x).join(",")
		},
		onChange: () => onFileSelected(input.files?.[0]),
		onKeydown: e => {
			if(e.key === "Escape"){
				input.blur()
			}
		}
	})

	bindBox(input, props.value, async({id, salt}) => {
		// handing external ID changes
		// need to download data about picture and put it into state
		if(id === 0){
			state.set({type: "empty"})
			input.value = ""
			return
		}

		const s = state.get()
		if(s.type === "value" && s.picture.id === id){
			return
		}

		state.set({type: "loading", id})
		try {
			const picture = await ClientApi.getPictureInfoById(id, salt)
			if(!isLoadingThisPicture(id)){
				return
			}
			state.set({type: "value", picture})
		} catch(e){
			console.error(e)
			if(!isLoadingThisPicture(id)){
				return
			}

			if(!(e instanceof Error)){
				throw e
			}

			state.set({type: "error", error: e})
			props.value.set({id: 0, salt: 0})
		}
	})


	function isUploadingThisFile(file: File): boolean {
		const s = state.get()
		return s.type === "uploading" && s.file === file
	}

	function isLoadingThisPicture(id: number): boolean {
		const s = state.get()
		return s.type === "loading" && s.id === id
	}

	const text = calcBox([state, isFocused], (stateValue, inFocus) => {
		switch(stateValue.type){
			case "loading": return `Loading (#${stateValue.id})`
			case "uploading": return `Uploading (${stateValue.file.name})`
			case "empty": return inFocus ? "Paste enabled" : "Select file"
			case "error": return "Error!"
			case "value": return stateValue.picture.width + "x" + stateValue.picture.height
		}
	})

	async function tryUsingTextAsUrl(str: string): Promise<void> {
		if(!str.toLowerCase().startsWith("http")){
			return
		}
		let url: URL
		try {
			url = new URL(str)
		} catch(e){
			console.log("Text is not URL: " + str, e)
			return
		}
		try {
			const body = await(await fetch(url)).blob()
			const f = new File([body], "image")
			void onFileSelected(f)
		} catch(e){
			if(e instanceof Error){
				console.error(e)
				state.set({type: "error", error: e})
			} else {
				throw e
			}
		}

	}

	const result = tag({
		class: [css.pictureInput, state.map(state => css[state.type])],
		attrs: {tabindex: 0},
		onFocus: () => isFocused.set(true),
		onBlur: () => isFocused.set(false),
		onPaste: e => {
			const file = e.clipboardData?.files?.[0]
			if(file){
				void onFileSelected(file)
				return
			}

			e.clipboardData?.items?.[0]?.getAsString(str => tryUsingTextAsUrl(str))
		}
	}, [
		tag({class: css.text}, [text]),
		input,
		tag({
			tag: "label",
			attrs: {for: inputDomId},
			class: [css.selectFileButton, Icon.upload, {
				[css.hidden!]: props.value.map(x => !!x.id)
			}]
		}),
		!props.param.mask ? null : tag({
			class: [css.maskButton, Icon.puzzle, {
				[css.hidden!]: props.value.map(x => !x.id)
			}],
			attrs: {title: "Draw mask for this picture"},
			onClick: async() => {
				const maskBox = box(props.value.get().mask || "")
				await showImageMaskInput({
					imageId: props.value.get().id,
					imageSalt: props.value.get().salt,
					value: maskBox
				}).waitClose()
				props.value.set({
					...props.value.get(),
					mask: maskBox.get()
				})
			}
		})
	])

	return result
}
import {MRBox, WBox, box, unbox} from "@nartallax/cardboard"
import {tag, whileMounted} from "@nartallax/cardboard-dom"
import {ClientApi} from "client/app/client_api"
import {generateUniqDomID} from "client/client_common/generate_uniq_dom_id"
import {readFileToArrayBuffer} from "client/client_common/read_file_to_array_buffer"
import {showImageMaskInput} from "client/controls/image_mask_input/image_mask_input"
import * as css from "./picture_input.module.scss"
import {Picture, PictureArgument, pictureTypeSet} from "common/entities/picture"
import {PictureGenParam} from "common/entities/parameter"

interface PictureInputProps {
	readonly value: WBox<PictureArgument>
	readonly param: PictureGenParam
	readonly paramSetName: MRBox<string>
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

	const inputDomId = generateUniqDomID()
	const input: HTMLInputElement = tag({
		tag: "input",
		attrs: {
			id: inputDomId,
			type: "file",
			accept: pictureTypesArr.map(x => "." + x).join(",")
		},
		onChange: async() => {
			const file = input.files?.[0]
			if(!file){
				props.value({id: 0})
				state({type: "empty"})
				return
			}

			state({type: "uploading", file})

			try {
				const fileData = await readFileToArrayBuffer(file)
				if(!isUploadingThisFile(file)){
					console.log("Stopping upload process after file is red because different file is selected")
					return
				}
				const name = file.name
				const nameWithoutExt = name.replace(/\.[^.]*$/, "")
				const picture = await ClientApi.uploadPictureAsArgument(unbox(props.paramSetName), props.param.jsonName, nameWithoutExt, fileData)
				if(!isUploadingThisFile(file)){
					console.log("Stopping upload process after file is uploaded because different file is selected")
					return
				}

				state({type: "value", picture: picture})
				props.value({id: picture.id})
			} catch(e){
				console.error(e)
				if(!isUploadingThisFile(file)){
					console.log("Won't show upload error because different file is selected")
					return
				}

				if(!(e instanceof Error)){
					throw e
				}

				state({type: "error", error: e})
				props.value({id: 0})
			}

		}
	})

	whileMounted(input, props.value, async({id}) => {
		// handing external ID changes
		// need to download data about picture and put it into state
		if(id === 0){
			state({type: "empty"})
			input.value = ""
			return
		}

		const s = state()
		if(s.type === "value" && s.picture.id === id){
			return
		}

		state({type: "loading", id})
		try {
			const picture = await ClientApi.getPictureInfoById(id)
			if(!isLoadingThisPicture(id)){
				return
			}
			state({type: "value", picture})
		} catch(e){
			console.error(e)
			if(!isLoadingThisPicture(id)){
				return
			}

			if(!(e instanceof Error)){
				throw e
			}

			state({type: "error", error: e})
			props.value({id: 0})
		}
	})


	function isUploadingThisFile(file: File): boolean {
		const s = state()
		return s.type === "uploading" && s.file === file
	}

	function isLoadingThisPicture(id: number): boolean {
		const s = state()
		return s.type === "loading" && s.id === id
	}

	const result = tag({class: [css.pictureInput, state.map(state => css[state.type])]}, [
		tag({
			tag: "label",
			attrs: {for: inputDomId}
		}, [state.map(state => {
			switch(state.type){
				case "loading": return `Loading (#${state.id})`
				case "uploading": return `Uploading (${state.file.name})`
				case "empty": return "Select file"
				case "error": return "Error!"
				case "value": return state.picture.name + "." + state.picture.ext
			}
		})]),
		input,
		!props.param.mask ? null : tag({
			class: [css.maskButton, "icon-puzzle", {
				[css.hidden!]: props.value.map(x => !x.id)
			}],
			attrs: {title: "Draw mask for this picture"},
			onClick: async() => {
				const maskBox = box(props.value().mask || "")
				await showImageMaskInput({
					imageId: props.value().id,
					value: maskBox
				}).waitClose()
				props.value({
					...props.value(),
					mask: maskBox()
				})
			}
		})
	])

	return result
}
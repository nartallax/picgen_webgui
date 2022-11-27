import {ClientApi} from "client/app/client_api"
import {getBinder} from "client/base/binder/binder"
import {box, MaybeRBoxed, unbox, WBox} from "client/base/box"
import {tag} from "client/base/tag"
import {generateUniqDomID} from "client/client_common/generate_uniq_dom_id"
import {readFileToArrayBuffer} from "client/client_common/read_file_to_array_buffer"
import {showImageMaskInput} from "client/controls/image_mask_input/image_mask_input"
import {PictureGenParamDefinition, pictureTypeSet} from "common/common_types"
import {Picture, PictureParameterValue} from "common/entity_types"

interface PictureInputOptions {
	readonly value: WBox<PictureParameterValue>
	readonly param: PictureGenParamDefinition
	readonly paramSetName: MaybeRBoxed<string>
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

export function PictureInput(opts: PictureInputOptions): HTMLElement {
	const pictureTypesArr: string[] = opts.param.allowedTypes ? [...opts.param.allowedTypes] : [...pictureTypeSet]
	if(pictureTypesArr.includes("jpg")){
		pictureTypesArr.push("jpeg")
	}

	const state = box<State>({type: "empty"})

	const inputDomId = generateUniqDomID()
	const input: HTMLInputElement = tag({
		tagName: "input",
		attrs: {
			id: inputDomId,
			type: "file",
			accept: pictureTypesArr.map(x => "." + x).join(",")
		},
		on: {
			change: async() => {
				const file = input.files?.[0]
				if(!file){
					opts.value({id: 0})
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
					const picture = await ClientApi.uploadPictureAsParameterValue(unbox(opts.paramSetName), opts.param.jsonName, nameWithoutExt, fileData)
					if(!isUploadingThisFile(file)){
						console.log("Stopping upload process after file is uploaded because different file is selected")
						return
					}

					state({type: "value", picture: picture})
					opts.value({id: picture.id})
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
					opts.value({id: 0})
				}

			}
		}
	})

	const binder = getBinder(input)
	binder.watchAndRun(opts.value, async({id}) => {
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
			opts.value({id: 0})
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

	const result = tag({class: ["input picture-input", state.map(state => state.type)]}, [
		tag({
			tagName: "label",
			attrs: {for: inputDomId},
			text: state.map(state => {
				switch(state.type){
					case "loading": return `Loading (#${state.id})`
					case "uploading": return `Uploading (${state.file.name})`
					case "empty": return "Select file"
					case "error": return "Error!"
					case "value": return state.picture.name + "." + state.picture.ext
				}
			})
		}),
		input,
		!opts.param.mask ? null : tag({
			class: ["icon-puzzle mask-button", {
				hidden: opts.value.map(x => !x.id)
			}],
			attrs: {title: "Draw mask for this picture"},
			on: {
				click: async() => {
					const maskBox = box(opts.value().mask || "")
					await showImageMaskInput({
						imageId: opts.value().id,
						value: maskBox
					}).waitClose()
					opts.value({
						...opts.value(),
						mask: maskBox()
					})
				}
			}
		})
	])

	return result
}
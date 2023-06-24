import type * as ProbeImageSize from "probe-image-size"

// this is a hack to make sqlite3 compatible with esmodules
// .d.ts of sqlite3 does not contain a default export, so you cannot import it
// but in fact our build system/runtime will allow us to do that
// so the only problem is typings
declare module "probe-image-size"{
	const probe: typeof ProbeImageSize
	export default probe
}
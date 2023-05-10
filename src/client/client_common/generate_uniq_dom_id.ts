import {generateRandomIdentifier} from "common/utils/generate_random_identifier"

export function generateUniqDomID(): string {
	return generateRandomIdentifier(id => !!document.getElementById(id))
}
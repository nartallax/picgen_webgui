/** Having a function and a prototype, make a function with this prototype and its properties
 * Unfortunately, this implies that constructor of the parent function cannot be called on the function
 * because since ES6 classes can't be called like regular functions and there is no known workaround
 * But any properties defined on the prototype will be copied to the function instance, so it's not too bad
 * Also the function won't receive proper `this` object. This can be done at the cost of performance; I don't need it that hard */
export function addPrototypeToFunction<R, A extends never[], F extends (this: null, ...args: A) => R, I extends object>(fn: F, obj: I): I & F {
	Object.setPrototypeOf(fn, Object.getPrototypeOf(obj)) // set up the prototype
	Object.assign(fn, obj) // clone the properties
	return fn as I & F
}
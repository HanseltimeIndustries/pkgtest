/**
 * Simple logger class to hold context prefix information
 */
export class Logger {
	context: string;
	debug: boolean;
	constructor(opts: {
		context: string;
		debug: boolean;
	}) {
		this.context = opts.context;
		this.debug = opts.debug;
	}
	error(msg: string | Buffer) {
		console.error(`${this.context} ${msg}`);
	}
	log(msg: string | Buffer) {
		console.log(`${this.context} ${msg}`);
	}
	logDebug(msg: string | Buffer) {
		if (this.debug) {
			this.log(msg);
		}
	}
}

import { basename, resolve } from "path";
import { scanOutForLogFiles } from "../files";
import { Logger } from "./Logger";
import { cpSync, existsSync, mkdirSync } from "fs";

/**
 * Meant to be created for an exec command that runs to a logger.
 *
 * This means that we can scan for log files in the output relative to the cwd
 * of the exec (and not this application).
 *
 * IMPORTANT - create one instance per exec command and make sure that folder paths
 * are unique to the exec command
 */
export class ScanForLogFilesLogger implements Logger {
	context: string;
	debug: boolean;
	logger: Logger;
	/** any log files that were detected in the std out */
	logfiles = new Set<string>();
	/** The CWD that the exec using this logger set up */
	cwd: string;
	/** The folder path to collect these files under - Should be provided by a pkgtest call and propagated here */
	collectUnder: string;

	constructor(logger: Logger, cwd: string, collectUnder: string) {
		this.context = logger.context;
		this.debug = logger.debug;
		this.logger = logger;
		this.cwd = cwd;
		this.collectUnder = collectUnder;
	}

	error(msg: string | Buffer): void {
		this.scanOnly(msg);
		this.logger.error(msg);
	}
	log(msg: string | Buffer): void {
		this.scanOnly(msg);
		this.logger.log(msg);
	}
	logDebug(msg: string | Buffer): void {
		this.scanOnly(msg);
		this.logger.logDebug(msg);
	}
	/**
	 * Just scans the logs and does not print anything.  This is only used in scenarios where we
	 * are turning off printing or something but want to still register things.
	 *
	 * Probably a better pattern for this.
	 */
	scanOnly(msg: string | Buffer) {
		scanOutForLogFiles(msg.toString(), this.cwd).forEach((lf) => {
			this.logfiles.add(lf);
		});
	}

	/**
	 * Moves all log files that were found during calling logs to the collectUnder folder
	 */
	collectLogFiles() {
		// Copy the given logs to a folder
		if (this.logfiles.size > 0) {
			if (!existsSync) {
				mkdirSync(this.collectUnder, {
					recursive: true,
				});
			}
			this.logfiles.forEach((lf) => {
				try {
					if (existsSync(lf)) {
						cpSync(lf, resolve(this.collectUnder, basename(lf)));
					} else {
						// No need to scan this one
						this.logger.error(`Warning: Could not collect log file ${lf}`);
					}
				} catch (err: any) {
					// Since this is a utility operation, if the file system is breaking things, we don't want to propagate it
					this.logger.error(
						`Error: Could not collect log file ${lf}\n${err?.message ?? err.toString()}`,
					);
				}
			});
		}
	}
}

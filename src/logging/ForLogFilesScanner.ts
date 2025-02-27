import { basename, resolve } from "path";
import { scanOutForLogFiles } from "../files";
import { cpSync, existsSync, mkdirSync } from "fs";
import { CollectLogFilesOn } from "../types";

export enum ExecExit {
	Error = 1,
	Normal = 1,
}

export interface ILogFilesScanner {
	/**
	 * Should create a new instance of the LogFilesScanner focused on a subfolder within this instance
	 * @param subFolder
	 */
	createNested(subFolder: string): ILogFilesScanner;

	/**
	 * Just scans the log message for log files and then addes them.  This is only used in scenarios where we
	 * are turning off printing or something but want to still register things.
	 *
	 * @param msg
	 * @param cwd - the current working directory of the exec command that generated the msg
	 * @param exit - what type of exit is associated with the process's msg - affects if we scan it
	 */
	scanOnly(msg: string | Buffer, cwd: string, exit: ExecExit): void;

	/**
	 * Moves all log files that were found during calling logs to the collectUnder folder
	 * Can only be called once
	 */
	collectLogFiles(): void;
}

/**
 * Base Scanner class that makes assumptions about messages fed to it.
 *
 * This assumes that all messages are coming from one exec command in the cwd
 * and that any found objects from 'scanOnly' will be copied to collectUnder
 * folder.
 */
export class ForLogFilesScanner implements ILogFilesScanner {
	/** any log files that were detected in the std out */
	logfiles = new Set<string>();
	/**
	 * The folder path to collect these files under - Should be provided by a pkgtest call and propagated here
	 * This is the toplevel folder and can have prefixes applied during scan
	 */
	collectUnder: string;
	collectOn: CollectLogFilesOn;
	private collected = false;

	constructor(collectUnder: string, collectOn: CollectLogFilesOn) {
		this.collectUnder = collectUnder;
		this.collectOn = collectOn;
	}

	createNested(subFolder: string) {
		return new ForLogFilesScanner(
			resolve(this.collectUnder, subFolder),
			this.collectOn,
		);
	}

	/**
	 * Just scans the log message for log files and then addes them.  This is only used in scenarios where we
	 * are turning off printing or something but want to still register things.
	 *
	 * @param msg
	 * @param cwd - the current working directory of the exec command that generated the msg
	 * @param exit - what type of exit is associated with the process's msg - affects if we scan it
	 */
	scanOnly(msg: string | Buffer, cwd: string, exit: ExecExit) {
		if (
			exit === ExecExit.Normal &&
			this.collectOn === CollectLogFilesOn.Error
		) {
			return;
		}
		const lfs = scanOutForLogFiles(msg.toString(), cwd);

		lfs.forEach((lf) => {
			this.logfiles.add(lf);
		});
	}

	/**
	 * Moves all log files that were found during calling logs to the collectUnder folder
	 */
	collectLogFiles() {
		if (this.collected) {
			throw new Error("Can only collect log files once!");
		}
		this.collected = true;
		// Copy the given logs to a folder
		if (this.logfiles.size > 0) {
			if (!existsSync(this.collectUnder)) {
				mkdirSync(this.collectUnder, {
					recursive: true,
				});
			}
			for (const lf of this.logfiles) {
				try {
					if (existsSync(lf)) {
						cpSync(lf, resolve(this.collectUnder, basename(lf)));
					} else {
						// No need to scan this one
						console.error(`Warning: Could not collect log file ${lf}`);
					}
				} catch (err: any) {
					// Since this is a utility operation, if the file system is breaking things, we don't want to propagate it
					console.error(
						`Error: Could not collect log file ${lf}\n${err?.message ?? err.toString()}`,
					);
				}
			}
		}
	}
}

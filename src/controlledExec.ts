import { exec, ExecOptions } from "child_process";
import { Logger } from "./Logger";

export async function controlledExec(
	cmd: string,
	options: ExecOptions,
	logger: Logger,
) {
	await new Promise<void>((res, rej) => {
		exec(cmd, options, (error, stdout, stderr) => {
			if (error) {
				logger.log(stdout);
				logger.error(stderr);
				rej(error);
			} else {
				if (stdout) {
					logger.logDebug(stdout);
				}
				if (stderr) {
					logger.logDebug(stderr);
				}
				res();
			}
		});
	});
}

import { exec, ExecOptions } from "child_process";
import { ExecExit, ILogFilesScanner, Logger } from "./logging";

export async function controlledExec(
	cmd: string,
	options: ExecOptions,
	logger: Logger,
	/**
	 * If we want to scan and collect any log files mentioned in the stdout/err we provide a
	 * NEW instance of the ForLogFilesScanner (presumably created by .nested())
	 */
	logFilesScanner?: ILogFilesScanner,
	innerOpts?: {
		/** Don't write anything to the logger for stdout if no error */
		onlyReturnStdOut: boolean;
	},
) {
	const cwd = options.cwd ? options.cwd.toString() : process.cwd();
	return await new Promise<string>((res, rej) => {
		exec(cmd, options, (error, stdout, stderr) => {
			if (error) {
				logger.log(stdout);
				logger.error(stderr);
				logFilesScanner?.scanOnly(stdout, cwd, ExecExit.Error);
				logFilesScanner?.scanOnly(stderr, cwd, ExecExit.Error);
				logFilesScanner?.collectLogFiles();
				rej(error);
			} else {
				if (stdout) {
					if (!innerOpts?.onlyReturnStdOut) {
						logger.logDebug(stdout);
					}
				}
				if (stderr) {
					logger.logDebug(stderr);
				}
				logFilesScanner?.scanOnly(stdout, cwd, ExecExit.Error);
				logFilesScanner?.scanOnly(stderr, cwd, ExecExit.Error);
				logFilesScanner?.collectLogFiles();
				res(stdout.trim());
			}
		});
	});
}

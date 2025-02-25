import { join } from "path";
import { writeFile } from "fs/promises";
import { Logger } from "../logging";
import { PkgManager } from "../types";
import { getPkgManagerSetCommand } from "./getPkgManagerSetCommand";
import { sanitizeEnv } from "./sanitizeEnv";
import { CollectLogFilesOptions, controlledExec } from "../controlledExec";

/**
 * The use of corepack pkgManager@latest means that pkgmanager keeps looking up the latest tags.
 *
 * This makes it far more vulnerable to flaky registy lookups and it also means there could be a very
 * rare race condition where we end up running with different versions during a publish event.
 *
 * This method is meant to be called ONCE per test setup per package manager that is meant to be latest
 * and then its returned version is meant to be used as the real version to avoid constant lookups.
 * @param tempDir
 * @param pkgManager
 * @returns the actual version that awas use
 */
export async function preinstallLatest(
	tempDir: string,
	pkgManager: PkgManager,
	logger: Logger,
	collectLogsOptions: false | CollectLogFilesOptions,
) {
	const pkgJsonPath = join(tempDir, "package.json");
	await writeFile(
		pkgJsonPath,
		JSON.stringify(
			{
				name: "dummy-preinstall",
			},
			null,
			4,
		),
	);
	const pkgCommand = getPkgManagerSetCommand(pkgManager);
	return await controlledExec(
		pkgCommand,
		{
			cwd: tempDir,
			env: sanitizeEnv(pkgJsonPath),
		},
		logger,
		collectLogsOptions,
		{
			onlyReturnStdOut: true,
		},
	);
}

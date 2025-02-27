import { join, resolve } from "path";
import {
	applyLockLocalFileEscaping,
	getLocalPackagePath,
	getPkgInstallCommand,
	LockFileMode,
	lockFiles,
} from "./pkgManager";
import { ModuleTypes, PkgManager } from "./types";
import { existsSync } from "fs";
import { writeFile, mkdir, readFile } from "fs/promises";
import { controlledExec } from "./controlledExec";
import { ILogFilesScanner, Logger } from "./logging";
import { createTestProjectFolderPath } from "./files";

export const VERSION_PROJECT_KEY = "localPathVersion";
export const PATH_TO_PROJECT_KEY = "relPathToProject";

export async function performInstall(
	context: {
		projectDir: string;
		testProjectDir: string;
		relPathToProject: string;
		rootDir: string;
		updateLock: boolean;
		env: {
			[e: string]: string | undefined;
		};
		/**
		 * An alias string to track which entry is calling this (used for installation lock storage)
		 */
		entryAlias: string;
		isCI: boolean;
		logger: Logger;
		logFilesScanner?: ILogFilesScanner;
	},
	options: {
		modType: ModuleTypes;
		pkgManager: PkgManager;
		pkgManagerAlias: string;
		pkgManagerVersion?: string;
		installCLiArgs: string;
		lock:
			| false
			| {
					folder: string;
			  };
	},
) {
	const {
		env,
		isCI,
		logger,
		rootDir,
		projectDir,
		testProjectDir,
		updateLock,
		relPathToProject: _relPathToProject,
		entryAlias,
		logFilesScanner,
	} = context;
	const {
		lock,
		modType,
		pkgManager,
		pkgManagerAlias,
		pkgManagerVersion,
		installCLiArgs,
	} = options;
	// Yarn needs this to be double escaped
	const relPathToProject = applyLockLocalFileEscaping(
		pkgManager,
		_relPathToProject,
	);
	const localPackagePath = applyLockLocalFileEscaping(
		pkgManager,
		getLocalPackagePath(pkgManager, relPathToProject),
	);
	let lockFileMode: LockFileMode;
	const lockFileName = lockFiles[pkgManager];
	const lockFileFolder = resolve(
		projectDir,
		rootDir,
		lock === false ? "shouldnotbehere" : lock.folder,
		createTestProjectFolderPath({
			entryAlias,
			modType,
			pkgManager,
			pkgManagerAlias,
		}),
	);
	const lockFilePath = join(lockFileFolder, lockFileName);
	if (lock === false) {
		logger.log("Running with no considerations for lock files!");
		lockFileMode = LockFileMode.None;
	} else {
		if (!existsSync(lockFilePath)) {
			if (isCI && !updateLock) {
				throw new Error(
					`No lockfile found at ${lockFilePath}!  Please make sure you've committed the results of --update-lockfiles`,
				);
			}

			// Default mode in non-ci environments is to update
			lockFileMode = LockFileMode.Update;
			await mkdir(lockFileFolder, {
				recursive: true,
			});
		} else {
			const file = await getInjectedLockFile(lockFilePath, {
				localPackagePath,
				relPathToProject,
			});
			// Copy the found lock file to the project
			await writeFile(resolve(testProjectDir, lockFileName), file);
			lockFileMode = updateLock ? LockFileMode.Update : LockFileMode.Frozen;
		}
	}

	await controlledExec(
		getPkgInstallCommand(
			pkgManager,
			lockFileMode,
			installCLiArgs,
			pkgManagerVersion,
		),
		{
			cwd: testProjectDir,
			env,
		},
		logger,
		logFilesScanner,
	);
	if (lockFileMode === LockFileMode.Update) {
		const writtenLockFile = resolve(testProjectDir, lockFileName);
		if (!existsSync(writtenLockFile)) {
			throw new Error(
				`Could not find a lock file to update at: ${writtenLockFile}`,
			);
		}

		let wereChanges: boolean = false;
		const nextFile = await readFile(writtenLockFile);
		if (!existsSync(lockFilePath)) {
			wereChanges = true;
		} else {
			// TODO smarter compare of these large files
			const prevFile = await getInjectedLockFile(lockFilePath, {
				localPackagePath,
				relPathToProject,
			});
			wereChanges = prevFile !== nextFile.toString();
		}
		if (wereChanges) {
			logger.log(`Updating ${lockFilePath}`);
			// Write the new file with substituted local values we know
			await writeFile(
				lockFilePath,
				nextFile
					.toString()
					.replaceAll(localPackagePath, `\${${VERSION_PROJECT_KEY}}`)
					.replaceAll(relPathToProject, `\${${PATH_TO_PROJECT_KEY}}`),
			);
		}
	}
}

async function getInjectedLockFile(
	path: string,
	opts: {
		localPackagePath: string;
		relPathToProject: string;
	},
) {
	return (await readFile(path))
		.toString()
		.replaceAll(`\${${VERSION_PROJECT_KEY}}`, opts.localPackagePath)
		.replaceAll(`\${${PATH_TO_PROJECT_KEY}}`, opts.relPathToProject);
}

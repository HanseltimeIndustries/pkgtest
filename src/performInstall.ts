import { join, relative, resolve } from "path";
import camelCase from "lodash.camelcase";
import { getPkgInstallCommand, LockFileMode, lockFiles } from "./pkgManager";
import { ModuleTypes, PkgManager } from "./types";
import { existsSync, readFileSync } from "fs";
import { writeFile, mkdir, readFile } from "fs/promises";
import { controlledExec } from "./controlledExec";
import { Logger } from "./Logger";

const PATH_TO_PROJECT_KEY = "relPathToProject";

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
		relPathToProject,
        entryAlias,
	} = context;
	const {
		lock,
		modType,
		pkgManager,
		pkgManagerAlias,
		pkgManagerVersion,
		installCLiArgs,
	} = options;
	let lockFileMode: LockFileMode;
	const lockFileName = lockFiles[pkgManager];
	const lockFileFolder = resolve(
		projectDir,
		rootDir,
		lock === false ? "shouldnotbehere" : lock.folder,
        camelCase(entryAlias),
		modType,
		pkgManager,
		camelCase(pkgManagerAlias),
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
			// Copy the found lock file to the project
			await writeFile(
				resolve(testProjectDir, lockFileName),
				(await readFile(lockFilePath))
					.toString()
					.replaceAll(`\${${PATH_TO_PROJECT_KEY}}`, relPathToProject),
			);
            console.log(readFileSync(resolve(testProjectDir, lockFileName)).toString())
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
	);
	if (lockFileMode === LockFileMode.Update) {
		const writtenLockFile = resolve(testProjectDir, lockFileName);
		if (!existsSync(writtenLockFile)) {
			throw new Error(
				`Could not find a lock file to update at: ${writtenLockFile}`,
			);
		}

		let wereChanges: boolean = false;
		const nextFile = readFileSync(writtenLockFile);
		if (!existsSync(lockFilePath)) {
			wereChanges = true;
		} else {
			// TODO smarter compare of these large files
			const prevFile = readFileSync(lockFilePath);
			wereChanges = prevFile !== nextFile;
		}
		if (wereChanges) {
			logger.log(`Updating ${lockFilePath}`);
			// Write the new file with substituted local values we know
            const fileToWrite = nextFile
            .toString()
            .replaceAll(relPathToProject, `\${${PATH_TO_PROJECT_KEY}}`)
			await writeFile(
				lockFilePath,
                fileToWrite,
			);
            console.log(fileToWrite)
		}
	}
}

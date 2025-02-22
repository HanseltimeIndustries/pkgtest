import { program, Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { findPkgTestProjectsByPrefix, getTempDir } from "../files";
import chalk from "chalk";
import { resolve } from "path";
import { rm } from "fs/promises";

interface Options {
	check?: boolean;
	force?: boolean;
	yes?: boolean;
}

program
	.option(
		"--check",
		"Just reports any files found that match pkgtest temp folders and exits non-zero if found",
	)
	.option(
		"-y, --yes",
		"This will automatically confirm the clean operation.  Otherwise, you will have to manually confirm the deletion.",
	)
	.option(
		"-f, --force",
		"If added, the delete operation will perform a rm -f style removal of any folders",
	)
	.action(async (options: Options, _command: Command) => {
		const tempDir = getTempDir();
		const folders = findPkgTestProjectsByPrefix(tempDir);
		console.log(`Found in ${tempDir}:\n`);
		folders.forEach((f) => {
			console.log(`\t${f}`);
		});

		if (options.check) {
			process.exit(folders.length > 0 ? 22 : 0);
		}

		const del =
			!!options.yes ||
			(await confirm({
				message: `Delete pkgtest folders?`,
				default: false,
			}));

		let deleted = 0;
		const failReasons = [] as any[];
		if (del) {
			const results = await Promise.allSettled(
				folders.map(async (f) => {
					await rm(resolve(tempDir, f), {
						recursive: true,
						force: !!options.force,
					});
				}),
			);

			results.forEach((r1) => {
				if (r1.status === "rejected") {
					failReasons.push(r1.reason);
				} else {
					deleted++;
				}
			});
		}

		console.log(`Deleted ${chalk.green(deleted)} folders`);
		if (failReasons.length > 0) {
			console.error(
				chalk.red(`Failed to delete ${failReasons.length} folders:`),
			);
			failReasons.forEach((r) => {
				console.error(r.toString ? r.toString() : JSON.stringify(r));
			});
			process.exit(33);
		}
	});

program.parse();

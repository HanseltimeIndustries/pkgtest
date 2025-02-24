/**
 * Since corepack can break package manager downloads on older version and node will not upgrade them
 * or maybe even have them in the future, we enforce a certain corepack version
 */

import { execSync } from "child_process";
import { satisfies } from "semver";
import { LIBRARY_NAME } from "../config";

export const MIN_COREPACK = ">=0.31.0";

export function ensureMinimumCorepack(options: {
	cwd: string;
}) {
	let version: string;
	try {
		version = execSync("corepack --version", {
			...options,
			env: process.env,
		})
			.toString()
			.trim();
	} catch (err) {
		console.error("Unable to verify the corepack version on cli!");
		throw err;
	}

	if (!satisfies(version, MIN_COREPACK)) {
		throw new Error(
			`${LIBRARY_NAME} requires corepack version on the shell of: ${MIN_COREPACK}!  Found ${version}.  Please upgrade it via 'npm install -g corepack@${MIN_COREPACK}`,
		);
	}
}

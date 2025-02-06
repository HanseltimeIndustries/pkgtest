/**
 * Simple coercing function since version 1 latest is not actually the same yarn due to yarn berry
 * @param version
 * @returns
 */
export function coerceYarnV1(version: string | "latest") {
	if (version !== "latest" && !version.startsWith("1")) {
		throw new Error(
			`Unexpected error for yarn version 1 (${version}).  Must be in 1 range`,
		);
	}
	return version === "latest" ? "1.x" : version;
}

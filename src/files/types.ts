/**
 * Internal helper for resolved files to copy
 */
export interface AdditionalFilesCopy {
	/**
	 * Fully resolved paths to files or directories that we want to copy over
	 */
	files: string[];
	/**
	 * Fully resolved path to the directory we want to copy into in the test project directory
	 */
	toDir: string;
}

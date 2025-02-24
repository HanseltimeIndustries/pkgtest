import { LIBRARY_NAME } from "../config";

export function getTempProjectDirPrefix() {
	const { PKG_TEST_TEMP_DIR_PREFIX } = process.env;
	if (PKG_TEST_TEMP_DIR_PREFIX) {
		return PKG_TEST_TEMP_DIR_PREFIX;
	}
	return `${LIBRARY_NAME}-`;
}

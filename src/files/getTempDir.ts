import { tmpdir } from "os";
import { isAbsolute, resolve } from "path";

export function getTempDir() {
	const { PKG_TEST_TEMP_DIR } = process.env;
	if (PKG_TEST_TEMP_DIR) {
		return isAbsolute(PKG_TEST_TEMP_DIR)
			? PKG_TEST_TEMP_DIR
			: resolve(process.cwd(), PKG_TEST_TEMP_DIR);
	}
	return tmpdir();
}

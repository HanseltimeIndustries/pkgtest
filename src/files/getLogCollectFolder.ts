import { tmpdir } from "os";
import { isAbsolute, join, resolve } from "path";
import { getTempDir } from "./getTempDir";

/**
 * Retruns a folder for dumping logs of different pkgtest installation issues
 * so that CI processes etc, can better bundle things.
 * @returns
 */
export function getLogCollectFolder() {
	const { PKG_TEST_LOG_COLLECT_DIR } = process.env;

	if (PKG_TEST_LOG_COLLECT_DIR) {
		return isAbsolute(PKG_TEST_LOG_COLLECT_DIR)
			? PKG_TEST_LOG_COLLECT_DIR
			: resolve(process.cwd(), PKG_TEST_LOG_COLLECT_DIR);
	}
	return join(getTempDir(), "pkgtest-logs");
}

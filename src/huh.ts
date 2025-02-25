const foo = `npm error Options:
npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
npm error [--no-bin-links] [--no-fund] [--dry-run]
npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
npm error
npm error aliases: clean-install, ic, install-clean, isntall-clean
npm error
npm error Run "npm help ci" for more info
npm error A complete log of this run can be found in: C:\\npm\\cache\\_logs\\2025-02-25T15_38_33_522Z-debug-0.log

    at __node_internal_genericNodeError (node:internal/errors:865:15)
    at ChildProcess.exithandler (node:child_process:422:12)
    at ChildProcess.emit (node:events:517:28)
    at maybeClose (node:internal/child_process:1098:16)
    at ChildProcess._handle.onexit (node:internal/child_process:303:5) {

  npm error A complete log of this run can be found in: C:\\npm\\cache\\_logs\\2025-02-25T15_38_33_522Z-debug2232-0.log
  code: 1,
  killed: false,
  signal: null,
  cmd: 'corepack npm@11.1.0 ci'
}`;
const reg = /[^\s]+\.log/g;
let log: RegExpExecArray | null = null;
do {
	log = reg.exec(foo);
	if (log) {
		console.log(log[0]);
	}
} while (log);

/**
 * @winccoa-tools-pack/npm-winccoa-ctrl-code-style
 *
 * Check and format WinCC OA CTL sources via WCCOActrl + astyle.ctl.
 * Worker project is runnable; StyleCheck is a non-runnable sub-project.
 */

export type { StyleCheckOptions, StyleCheckResult } from './types';
export type { RegisterProjectsOptions, RegisterProjectsResult } from './register';
export {
    runStyleCheck,
    checkStyle,
    formatStyle,
    buildCtrlArgs,
    ASTYLE_SCRIPT,
} from './style-check';
export {
    getPackageRoot,
    getDefaultStyleCheckProjectPath,
    getAstyleScriptPath,
} from './paths';
export {
    registerStyleCheckSubProject,
    registerWorkerProjectWithStyleCheck,
    resolveWinCCOAVersion,
    spawnRegisterProjectCli,
} from './register';
export { parseArgs, printUsage, main } from './cli';
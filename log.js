export const LOG_INFO  = '';
export const LOG_INFO2 = '\x1B[1;37m';
export const LOG_WARN  = '\x1B[0;33m';
export const LOG_ERR   = '\x1B[1;31m';

export function log(logType, msg) {
const ANSI_RESET = '\x1B[0;37m';

	console.log(logType + msg + ANSI_RESET);
}
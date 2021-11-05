import _ from 'lodash';

export const Log = {
	error(...messages) {
		if(!isDebugMode())
			return;
		if (console && console.error)
			console.error(...messages); // eslint-disable-line no-console
	},

	info(...messages) {
		if(!isDebugMode())
			return;
		if(console && console.info)
			console.info(...messages); // eslint-disable-line no-console
	}
};

export function isDebugMode() {
	const {SNC:{isDebug}={}} = window;
	return !!isDebug;
}

export function debug() {
	if (isDebugMode())
		debugger; // eslint-disable-line no-debugger
}

export function assertDefined(v) {
	if (_.isUndefined(v)) {
		Log.error('Assertion failed. Value is not defined');
		if (isDebugMode())
			debugger; // eslint-disable-line no-debugger
		else
			console.trace(); // eslint-disable-line no-console
	}
}

export function measure(f) {
	if (isDebugMode())
		return function mesureProxy(...args) {
			const t1 = performance.now();
			const ret = f.apply(this, args);
			const t2 = performance.now();
			Log.info('%cTime taken by "' + f.name + '": %c' + (t2-t1) + ' ms', 'color:green; font-style:italics;', 'color:red; font-weight:bold;');
			return ret;
		};
	else
		return f;
}

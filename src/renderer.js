import snabbdom from '@servicenow/ui-renderer-snabbdom';
import {isDebugMode, Log} from './util';

const LAST_VNODE = Symbol('__last_cal_vnode__');

function skipViewUpdate(state) {
	return !state.startMoment || !state.endMoment || !state.dataProvider.eventStore;
}

const CalendarRenderer = {
	...snabbdom,
	onStateChange(...args) {
		const [element,,state] = args;
		let vnode = element[LAST_VNODE];
		if (!vnode || !skipViewUpdate(state)) {
			vnode = snabbdom.onStateChange.apply(this, args);
			element[LAST_VNODE] = vnode;
		} else if (isDebugMode()) {
			Log.info('%cState changed but view update is being skipped', 'background-color:yellow', state);
		}
		return vnode;
	}
};

const RendererConfig = {
	renderer: {type: CalendarRenderer}
};

export default RendererConfig;

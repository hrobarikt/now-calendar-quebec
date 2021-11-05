import {ACTIONS, EVENTS, KEYS, POPOVERS} from './constants';
import {deletePopoverTarget, isPopoverOpen} from  './util';

export function closePopover(state, dispatch) {
	if (isPopoverOpen(state)) {
		/** Delete popover target if any */
		deletePopoverTarget(state);
		dispatch(ACTIONS.INTERNAL_STATE_SET, {popOvers: {}, eventPopoverClosedTime: Date.now()});
		dispatch(ACTIONS.POPOVER_CLOSED);
	}
}

const EventHandlers = [
	{
		events: [EVENTS.MOUSE_CLICKED],
		effect({state, dispatch, action: {payload: {event}}}) {
			let clickedInsidePopover = false;
			let clickedOnPopoverButton = false;
			const clickPath = event.composedPath ? event.composedPath() : event.path;
			clickPath.forEach((elm) => {
				if (elm && elm.getAttribute) {
					let classNames = elm.getAttribute('class');
					if (classNames) {
						classNames = classNames.split(' ');
						if (classNames.indexOf('sn-calendar-popover-content') !== -1) {
							clickedInsidePopover = true;
						}
						if (classNames.indexOf('popover-button') !== -1) {
							clickedOnPopoverButton = true;
						}
					}
				}
			});
			if (!clickedInsidePopover && !clickedOnPopoverButton) {
				closePopover(state, dispatch);
			}
		}
	},
	{
		events: [EVENTS.KEY_DOWN],
		effect({state, dispatch, action: {payload: {event}}}) {
			const {properties: props} = state;
			if (isPopoverOpen(state)) {
				if (event.keyCode == KEYS.ESC) {
					closePopover(state, dispatch);
					const eventPopover = state.popOvers[POPOVERS.EVENT];
					const settingsPopover = state.popOvers[POPOVERS.SETTINGS];
					if (eventPopover && eventPopover.target)
						setTimeout(() => eventPopover.target.focus(), 500);
					else if (settingsPopover && settingsPopover.target)
						settingsPopover.target.focus();
				}
			}
		}
	}
];

export default {
	eventHandlers: EventHandlers
};

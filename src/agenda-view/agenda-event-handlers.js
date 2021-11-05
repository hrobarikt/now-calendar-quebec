import {
	anyToMoment,
	clearTemporaryEvent,
	isMoveAllowed
} from '../util';
import {ACTIONS, EVENT_STATES, EVENT_TYPES} from '../constants';
import moment from 'moment-timezone';

/********************* */

/* Event move handlers */
/********************* */
export function onEventDragStart(mouseEvent, event, viewSettings, state, dispatch) {
	if (!isMoveAllowed(state, event))
		return;

	const tempEvent = {};
	tempEvent.id = 'event-id-' + EVENT_TYPES.AGENDA_DRAG;
	tempEvent.title = event.title;
	tempEvent.startMS = event.startMS;
	tempEvent.endMS = event.endMS;
	tempEvent.startMoment = anyToMoment(event.startMS, state.properties);
	tempEvent.endMoment = anyToMoment(event.endMS, state.properties);

	const externalEvent = {
		id: event.id,
		duration: tempEvent.endMoment.diff(tempEvent.startMoment),
		originatedFromInternal: true,
		startPositionDifference: 0
	}
	const temporaryEventSettings = {
		eventType: EVENT_TYPES.AGENDA_DRAG,
		eventState: EVENT_STATES.ONDRAGSTART,
		tempEvent,
		originalEvent: event,
		eventId: event.id,
		counter: 0
	};

	mouseEvent.dataTransfer.setData('id', event.id);//Firefox needs data attribute for draggable to work
	mouseEvent.dataTransfer.setDragImage(mouseEvent.target, 0, 0);
	mouseEvent.target.classList.add('agenda-drag');
	dispatch.updateProperties({externalEvent});
	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings});
}

export function onEventDragEnd(mouseEvent, event, viewSettings, state, dispatch) {
	mouseEvent.target.classList.remove('agenda-drag');
	clearTemporaryEvent(state, dispatch);
}

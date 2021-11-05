import {ACTIONS, EVENT_STATES, EVENT_TYPES} from '../../../constants';
import {onChunkEventMoveDragOver, onChunkEventCreateDragOver, onChunkEventResizeDragOver} from './chunk-event-handlers';
import {
	onAgendaDragEnter,
	onAgendaEventDragLeave,
	onAgendaEventDragOver,
	onAgendaEventDrop
} from './agenda-event-handlers';
import moment from 'moment-timezone';
import {dispatchGridClickNewEvent} from '../../../util';

export function onDrawingAreaDragOver(event, viewSettings, state, dispatch) {
	const el = event.currentTarget.getRootNode();
	if (el && el.activeElement)
		el.activeElement.blur();
	if (state.temporaryEventSettings) {
		const {eventType} = state.temporaryEventSettings;
		if (eventType === EVENT_TYPES.MOVE)
			onChunkEventMoveDragOver(event, viewSettings, state, dispatch);
		else if (eventType === EVENT_TYPES.CREATE)
			onChunkEventCreateDragOver(event, viewSettings, state, dispatch);
		else if (eventType === EVENT_TYPES.RESIZE)
			onChunkEventResizeDragOver(event, viewSettings, state, dispatch);
		else if (eventType === EVENT_TYPES.AGENDA_DRAG) {
			onAgendaEventDragOver(event, viewSettings, state, dispatch);
			event.preventDefault();
		}
	}
}

export function onDrawingAreaDragEnter(event, viewSettings, state, dispatch) {
	if (state.temporaryEventSettings) {
		const {eventType} = state.temporaryEventSettings;
		if (eventType === EVENT_TYPES.AGENDA_DRAG)
			onAgendaDragEnter(event, viewSettings, state, dispatch);
	}
}


export function onDrawingAreaDrop(event, viewSettings, state, dispatch) {
	if (state.temporaryEventSettings) {
		const {eventType} = state.temporaryEventSettings;
		if (eventType === EVENT_TYPES.AGENDA_DRAG)
			onAgendaEventDrop(event, viewSettings, state, dispatch);
	}
}

export function onDrawingAreaDragLeave(event, viewSettings, state, dispatch) {
	if (state.temporaryEventSettings) {
		const {eventType} = state.temporaryEventSettings;
		if (eventType === EVENT_TYPES.AGENDA_DRAG)
			onAgendaEventDragLeave(event, viewSettings, state, dispatch);
	}
}

export function onGridCellClick(startMoment, endMoment, state, dispatch) {
	const tempEvent = {};
	tempEvent.id = 'event-id-' + EVENT_TYPES.CLICK_CREATE;
	tempEvent.title = '';
	tempEvent.startMS = startMoment.valueOf();
	tempEvent.endMS = endMoment.valueOf();
	dispatch(ACTIONS.INTERNAL_STATE_SET, {
		temporaryEventSettings: {
			eventType: EVENT_TYPES.CLICK_CREATE,
			eventState: EVENT_STATES.ONCLICK,
			tempEvent
		}
	});
	// let the new event be rendered before dispatching event
	setTimeout(function () {
		dispatchGridClickNewEvent(state, dispatch, startMoment, endMoment);
	}, 50);
}




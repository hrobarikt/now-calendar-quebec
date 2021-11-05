import moment from 'moment-timezone';
import {
	anyToMoment,
	clearTemporaryEvent,
	dispatchDragNewEventEnd,
	dispatchEventMove,
	dispatchEventResize,
	getEventById,
	isCreateAllowed,
	isMoveAllowed,
	isResizeAllowed,
	scrollViewOnEventDrag
} from '../../../util';
import {getMomentByPositionChange, isEventModified, isPositionChanged} from '../util';
import {ACTIONS, EVENT_STATES, EVENT_TYPES, POSITION} from '../../../constants';
import {getCurrentPosition, hideActualEvent, hideDragPreview, updateSettingsOnDrag} from './event-handler-utils';


/* ****************************** *
 * Event move handlers			  *
 * ****************************** */
export function onChunkEventMoveDragStart(mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	const parentEvent = getEventById(state, chunkEvent.eventId);
	parentEvent.initializeMoment(state.properties.timezone);
	if (!isMoveAllowed(state, parentEvent))
		return;

	const initialPosition = getCurrentPosition(mouseEvent, viewSettings, state);

	// Change cursor pointer while moving the event
	mouseEvent.target.classList.add('event-dragging');
	let viewElm = mouseEvent.target.closest('.view-body');

	// Creating new event element, which will be shown while move
	const tempEvent = {};
	tempEvent.id = 'event-id-' + EVENT_TYPES.MOVE;
	tempEvent.title = parentEvent.title;
	tempEvent.startMS = parentEvent.startMS;
	tempEvent.endMS = parentEvent.endMS;
	mouseEvent.dataTransfer.setData('text/plain', tempEvent.id); // work around for firefox

	dispatch(ACTIONS.INTERNAL_STATE_SET, {
		temporaryEventSettings: {
			eventType: EVENT_TYPES.MOVE,
			eventState: EVENT_STATES.ONDRAGSTART,
			eventId: chunkEvent.eventId,
			tempEvent,
			initialPosition
		}
	});
}

export function onChunkEventMoveDragOver(mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	const {tempEvent, initialPosition, eventId, eventState} = temporaryEventSettings;
	const parentEvent = getEventById(state, eventId);
	parentEvent.initializeMoment(state.properties.timezone);
	const currentPosition = getCurrentPosition(mouseEvent, viewSettings, state);
	const {stepSize} = viewSettings;
	scrollViewOnEventDrag(mouseEvent);

	// Apply new styles only when mouse position changes
	if (isPositionChanged(currentPosition, temporaryEventSettings.previousPosition, eventState !== EVENT_STATES.ONDRAGSTART)) {
		let tempStartMoment = getMomentByPositionChange(parentEvent.startMoment, initialPosition, currentPosition, false, stepSize);
		let tempEndMoment = moment(parentEvent.endMoment).add(tempStartMoment.diff(parentEvent.startMoment));
		tempEvent.startMS = tempStartMoment.valueOf();
		tempEvent.endMS = tempEndMoment.valueOf();
		updateSettingsOnDrag(viewSettings, state, dispatch, {
			tempEvent,
			previousPosition: currentPosition
		});
	} else if (eventState === EVENT_STATES.ONDRAGSTART)
		updateSettingsOnDrag(viewSettings, state, dispatch);
}

export function onChunkEventMoveDragEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	const parentEvent = getEventById(state, chunkEvent.eventId);
	if (!isMoveAllowed(state, parentEvent))
		return;

	// Change cursor pointer to default when drag ends
	mouseEvent.target.classList.remove('event-dragging');

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;

	const {tempEvent} = temporaryEventSettings;

	const difference = tempEvent.startMS - parentEvent.startMS;
	if (difference !== 0)
		dispatchEventMove(state, dispatch, parentEvent, difference, anyToMoment(tempEvent.startMS, state.properties), anyToMoment(tempEvent.endMS, state.properties));
	else
		clearTemporaryEvent(state, dispatch);

}


/* ****************************** *
 * Drag and create event handlers *
 * ****************************** */
export function onChunkEventCreateDragStart(mouseEvent, viewSettings, state, dispatch) {
	if (!isCreateAllowed(state))
		return;

	const {startMoment} = state;
	const initialPosition = getCurrentPosition(mouseEvent, viewSettings, state);

	// Hide drag preview using empty image
	hideDragPreview(mouseEvent, viewSettings);

	// Creating new event element, which will be shown while move
	const tempEvent = {};
	tempEvent.id = 'event-id-' + EVENT_TYPES.CREATE;
	tempEvent.title = '';
	tempEvent.initialStartMoment = moment(startMoment).add(initialPosition.day, 'd').add(initialPosition.stepTime, 's');
	tempEvent.startMS = tempEvent.initialStartMoment.valueOf();
	tempEvent.endMS = tempEvent.initialStartMoment.valueOf();
	mouseEvent.dataTransfer.setData('text/plain', tempEvent.id); // work around for firefox

	dispatch(ACTIONS.INTERNAL_STATE_SET, {
		temporaryEventSettings: {
			eventType: EVENT_TYPES.CREATE,
			eventState: EVENT_STATES.ONDRAGSTART,
			tempEvent,
			initialPosition
		}
	});
}

export function onChunkEventCreateDragOver(mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	const {tempEvent, initialPosition, eventState} = temporaryEventSettings;
	const {stepSize} = viewSettings;
	const currentPosition = getCurrentPosition(mouseEvent, viewSettings, state);
	scrollViewOnEventDrag(mouseEvent);

	// Apply new styles only when mouse position changes
	if (isPositionChanged(currentPosition, temporaryEventSettings.previousPosition, true)) {
		let tempStartMoment, tempEndMoment;
		if (currentPosition.day > initialPosition.day || (currentPosition.day === initialPosition.day && currentPosition.time >= initialPosition.time)) {
			tempStartMoment = moment(tempEvent.initialStartMoment);
			tempEndMoment = getMomentByPositionChange(tempEvent.initialStartMoment, initialPosition, currentPosition, true);
			tempEndMoment.add(stepSize, 'm');
		} else {
			tempStartMoment = getMomentByPositionChange(tempEvent.initialStartMoment, initialPosition, currentPosition, true);
			tempEndMoment = moment(tempEvent.initialStartMoment);
			tempEndMoment.add(stepSize, 'm');
		}
		if (!tempStartMoment.isSame(tempEndMoment, 'date') && tempEndMoment.hour() === 0 && tempEndMoment.second() === 0) {
			tempEndMoment.add(-1, 'ms');
		}
		tempEvent.startMS = tempStartMoment.valueOf();
		tempEvent.endMS = tempEndMoment.valueOf();
		updateSettingsOnDrag(viewSettings, state, dispatch, {
			tempEvent,
			previousPosition: currentPosition
		});
	} else if (eventState === EVENT_STATES.ONDRAGSTART)
		updateSettingsOnDrag(viewSettings, state, dispatch);
}

export function onChunkEventCreateDragEnd(mouseEvent, viewSettings, state, dispatch) {
	if (!isCreateAllowed(state))
		return;

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;
	const {tempEvent} = temporaryEventSettings;

	if (tempEvent.startMS !== tempEvent.endMS)
		dispatchDragNewEventEnd(state, dispatch, anyToMoment(tempEvent.startMS, state.properties), anyToMoment(tempEvent.endMS, state.properties));
	else
		clearTemporaryEvent(state, dispatch);
}

/* ***************************** *
 * Resize event handlers         *
 * ***************************** */
export function onChunkEventResizeDragStart(resizeType, mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	mouseEvent.stopPropagation();
	const parentEvent = getEventById(state, chunkEvent.eventId);
	parentEvent.initializeMoment(state.properties.timezone);
	if (!isResizeAllowed(state, parentEvent))
		return;

	const initialPosition = getCurrentPosition(mouseEvent, viewSettings, state);

	// Hide drag preview using empty image
	hideDragPreview(mouseEvent, viewSettings);

	// Creating new event element, which will be shown while move
	const tempEvent = {};
	tempEvent.id = 'event-id-' + EVENT_TYPES.RESIZE;
	tempEvent.title = parentEvent.title;
	tempEvent.startMS = parentEvent.startMoment.valueOf();
	tempEvent.endMS = parentEvent.endMoment.valueOf();
	mouseEvent.dataTransfer.setData('text/plain', tempEvent.id); // work around for firefox

	dispatch(ACTIONS.INTERNAL_STATE_SET, {
		temporaryEventSettings: {
			eventType: EVENT_TYPES.RESIZE,
			eventState: EVENT_STATES.ONDRAGSTART,
			eventId: chunkEvent.eventId,
			tempEvent,
			resizeType,
			initialPosition
		}
	});
}

export function onChunkEventResizeDragOver(mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	const {stepSize} = viewSettings;
	const {tempEvent, eventId, resizeType, eventState, initialPosition} = temporaryEventSettings;
	const parentEvent = getEventById(state, eventId);
	parentEvent.initializeMoment(state.properties.timezone);
	const currentPosition = getCurrentPosition(mouseEvent, viewSettings, state);
	scrollViewOnEventDrag(mouseEvent);

	// Hiding actual event chunks
	// to avoid dom manipulations on actual event element, can causes issue on re-rendering
	if (eventState === EVENT_STATES.ONDRAGSTART)
		hideActualEvent(viewSettings, eventId);

	// Apply new styles only when mouse position changes
	if (isPositionChanged(currentPosition, temporaryEventSettings.previousPosition, eventState !== EVENT_STATES.ONDRAGSTART)) {
		if (resizeType === POSITION.START) {
			const newStartMoment = getMomentByPositionChange(parentEvent.startMoment, initialPosition, currentPosition, true);
			if (newStartMoment.isBefore(parentEvent.endMoment))
				tempEvent.startMS = newStartMoment.valueOf();
		} else if (resizeType === POSITION.END) {
			const newEndMoment = getMomentByPositionChange(parentEvent.endMoment, initialPosition, currentPosition, true);
			newEndMoment.add(stepSize, 'm');
			if (!parentEvent.startMoment.isSame(newEndMoment, 'date') && newEndMoment.hour() === 0 && newEndMoment.second() === 0)
				newEndMoment.add(-1, 'ms');
			if (newEndMoment.isAfter(parentEvent.startMoment))
				tempEvent.endMS = newEndMoment.valueOf();
		}
		updateSettingsOnDrag(viewSettings, state, dispatch, {
			tempEvent,
			previousPosition: currentPosition
		});
	} else if (eventState === EVENT_STATES.ONDRAGSTART)
		updateSettingsOnDrag(viewSettings, state, dispatch);
}

export function onChunkEventResizeDragEnd(resizeType, mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	mouseEvent.stopPropagation();
	mouseEvent.preventDefault();
	const parentEvent = getEventById(state, chunkEvent.eventId);
	if (!isResizeAllowed(state, parentEvent))
		return;

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;
	const {tempEvent} = temporaryEventSettings;
	if (temporaryEventSettings && isEventModified(parentEvent, tempEvent))
		dispatchEventResize(state, dispatch, parentEvent, anyToMoment(tempEvent.startMS, state.properties), anyToMoment(tempEvent.endMS, state.properties));
	else
		clearTemporaryEvent(state, dispatch);
}

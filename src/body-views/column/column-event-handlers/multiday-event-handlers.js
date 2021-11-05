import {
	getDirProperty,
	getEventById,
	isCreateAllowed,
	dispatchEventMove,
	dispatchDragNewEventEnd,
	dispatchEventResize,
	dispatchGridClickNewEvent,
	clearTemporaryEvent
} from '../../../util';
import {getMousePositionDayTime, COL_EVENT_CONSTANTS} from '../util';
import moment from 'moment-timezone';
import {ACTIONS, POSITION, EVENT_STATES} from '../../../constants';


export function getMultidayEventConfig() {
	return {
		height: 21,
		gapBetweenEvents: 3,
		leftPadding: 0,
		rightPadding: 0,
		bottomPadding: 12
	};
}

/******************************** */
/* Drag Multi Day events */
/******************************** */
export function onMultiDayEventDragStart(mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	const columnViewEl = viewSettings.multidayEventWrapperRef.current;
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	const initialPosition = getMousePositionDayTime(mouseEvent, gridBounds, viewSettings, state);

	// Change cursor pointer while moving the event
	mouseEvent.target.classList.add('event-dragging');
	mouseEvent.dataTransfer.setData('text/plain', chunkEvent.eventId); // work around for firefox

	let parentEvent = getEventById(state, chunkEvent.eventId);
	parentEvent.initializeMoment(state.properties.timezone);

	let temporaryEventConfig = {
		dragEvent: {...parentEvent},
		dragEventEl: mouseEvent.target,
		initialPosition,
		dragPosition: initialPosition,
		multidayTempEvent: {...parentEvent},
		type: ACTIONS.EVENT_MOVED,
		eventState: EVENT_STATES.ONDRAGSTART
	};
	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: temporaryEventConfig})
}

function eventDragOperation(currentPosition, dragPosition, multidayTempEvent, dragEvent) {
	let diff = currentPosition.day - dragPosition.day;
	dragEvent.startMoment = moment(multidayTempEvent.startMoment).add(diff, 'd');
	dragEvent.endMoment = moment(multidayTempEvent.endMoment).add(diff, 'd');
	return dragEvent;
}

function dragNewEventOperation(currentPosition, initialPosition, dragEvent) {
	let diff = currentPosition.day - initialPosition.day;
	if (diff > 0) {
		dragEvent.startMoment = moment(dragEvent.initialStartMoment);
		dragEvent.endMoment = moment(dragEvent.initialEndMoment).add(diff, 'd');
	} else if (diff === 0) {
		dragEvent.startMoment = moment(dragEvent.initialStartMoment);
		dragEvent.endMoment = moment(dragEvent.initialEndMoment);
	} else {
		dragEvent.startMoment = moment(dragEvent.initialStartMoment).add(diff, 'd');
		dragEvent.endMoment = moment(dragEvent.initialEndMoment);
	}
	return dragEvent;
}

function resizeEventOperation(mouseEvent, temporaryEventSettings, currentPosition, state) {
	const {properties: {dir}} = state;
	let {dragEvent, initialPosition, dragEventEl, eventBounds, gridBounds, resizeType} = temporaryEventSettings;
	let d = mouseEvent.clientX - temporaryEventSettings.startPosition;
	let diff = currentPosition.day - initialPosition.day;
	let resizeAllowed = false;

	if (temporaryEventSettings.resizeType === POSITION.END)
		dragEvent.endMoment = moment(dragEvent.initialEndMoment).add(diff, 'd');

	if (resizeType === POSITION.START)
		dragEvent.startMoment = moment(dragEvent.initialStartMoment).add(diff, 'd');

	if (!dragEvent.startMoment.isSameOrAfter(dragEvent.endMoment, 'd'))
		resizeAllowed = true;

	d = dir === 'ltr' ? d : d * -1;
	if ((resizeType === POSITION.END) && resizeAllowed)
		dragEventEl.style.width = eventBounds.width + d - 2 + 'px'; // negate width by 2px to reduce the event width by size of resize element

	if (resizeType === POSITION.START && resizeAllowed) {
		if(dir === 'ltr') {
			dragEventEl.style['left'] = eventBounds['left'] + d + 5 - gridBounds.x + 'px'; // negate width by 5px to reduce the event width by size of resize element
			dragEventEl.style.width = eventBounds.width - d - 5 + 'px';
		} else {
			dragEventEl.style['right'] = gridBounds.right - eventBounds['right'] + d + 5 + 'px';
			dragEventEl.style.width = eventBounds.width - d - 5 + 'px';
		}
	}
}

export function onMultiDayEventDrag (mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || !temporaryEventSettings.multidayTempEvent)
		return;

	let {dragEvent, multidayTempEvent, initialPosition, dragPosition} = temporaryEventSettings;
	const columnViewEl = viewSettings.multidayEventWrapperRef.current;
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	const currentPosition = getMousePositionDayTime(mouseEvent, gridBounds, viewSettings, state);

	if (temporaryEventSettings.type === ACTIONS.EVENT_MOVED)
		dragEvent = eventDragOperation(currentPosition, dragPosition, multidayTempEvent, dragEvent);
	else if (temporaryEventSettings.type === ACTIONS.DRAG_END_NEW_EVENT)
		dragEvent = dragNewEventOperation(currentPosition, initialPosition, dragEvent);
	else if (temporaryEventSettings.type === ACTIONS.EVENT_RESIZED)
		return resizeEventOperation(mouseEvent, temporaryEventSettings, currentPosition, state);

	if (temporaryEventSettings.eventState === EVENT_STATES.ONDRAGSTART || !multidayTempEvent.startMoment.isSame(dragEvent.startMoment, 'day') || !multidayTempEvent.endMoment.isSame(dragEvent.endMoment, 'day')) {
		const multidayTempEvent = {...temporaryEventSettings.multidayTempEvent};
		multidayTempEvent.startMoment = dragEvent.startMoment;
		multidayTempEvent.endMoment = dragEvent.endMoment;
		multidayTempEvent.startMS = dragEvent.startMoment.valueOf();
		multidayTempEvent.endMS = dragEvent.endMoment.valueOf();
		dragPosition = currentPosition;

		dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: {...state.temporaryEventSettings, multidayTempEvent, dragPosition, eventState: EVENT_STATES.ONDRAG}});
	}
}

export function onMultiDayEventDragEnd (mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	const parentEvent = getEventById(state, chunkEvent.eventId);

	// Change cursor pointer to default when drag ends
	mouseEvent.target.classList.remove('event-dragging');

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;

	if (temporaryEventSettings && temporaryEventSettings.multidayTempEvent) {
		const {startMoment: tempStartMoment, endMoment: tempEndMoment} = temporaryEventSettings.multidayTempEvent;
		if (chunkEvent.startMS !== tempStartMoment.valueOf())
			dispatchEventMove(state, dispatch, parentEvent, tempEndMoment.diff(tempStartMoment), tempStartMoment, tempEndMoment);
		else // reset events
			clearTemporaryEvent(state, dispatch);
	}
}

/**************************************** */
/* Drag and Create new multi day events   */
/**************************************** */
export function onMultidayGridDragStart(mouseEvent, state, viewSettings, dispatch) {
	const { startMoment } = state;
	const { multidayEventWrapperRef } = viewSettings;
	const columnViewEl = multidayEventWrapperRef.current;
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	const initialPosition = getMousePositionDayTime(mouseEvent, gridBounds, viewSettings, state);

	// Hide drag preview using empty image
	mouseEvent.dataTransfer.setDragImage(columnViewEl.querySelector('.' + COL_EVENT_CONSTANTS.DRAG_IMG_CONTAINER), 0, 0);

	//Creating new event element, which will be shown while move
	const dragEvent = {};
	dragEvent.id = 'new-event';
	dragEvent.title = '';
	dragEvent.startMS = dragEvent.startMoment = dragEvent.initialStartMoment = moment(startMoment).add(initialPosition.day, 'd').startOf('day');
	dragEvent.endMS = dragEvent.endMoment = dragEvent.initialEndMoment = moment(startMoment).add(initialPosition.day, 'd').endOf('day');;
	mouseEvent.dataTransfer.setData('text/plain', dragEvent.id); // work around for firefox

	let temporaryEventConfig = {
		dragEvent,
		dragEventEl: mouseEvent.target,
		initialPosition,
		dragPosition: initialPosition,
		multidayTempEvent: {...dragEvent},
		type: ACTIONS.DRAG_END_NEW_EVENT,
		eventState: EVENT_STATES.ONDRAGSTART
	};

	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: temporaryEventConfig});
}

export function onMultidayGridDragEnd(mouseEvent, state, viewSettings, dispatch) {
	if (!isCreateAllowed(state))
		return;

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;

	if (temporaryEventSettings && temporaryEventSettings.multidayTempEvent) {
		const {startMoment: tempStartMoment, endMoment: tempEndMoment} = temporaryEventSettings.multidayTempEvent;
		dispatchDragNewEventEnd(state, dispatch, tempStartMoment, tempEndMoment);
	}
}
export function createMultidayEventOnClick (mouseEvent, state, viewSettings, dispatch, getDayTimePos) {
	const { startMoment } = state;
	const { multidayEventWrapperRef } = viewSettings;
	const columnViewEl = multidayEventWrapperRef.current;
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	const initialPosition = getDayTimePos ? getDayTimePos(mouseEvent, gridBounds, viewSettings, state) : {};


	// Creating new event element, which will be shown while move
	const dragEvent = {};
	dragEvent.id = 'new-event';
	dragEvent.title = '';
	dragEvent.initialStartMoment = moment(startMoment).add(initialPosition.day, 'd').startOf('day');
	dragEvent.initialEndMoment = moment(startMoment).add(initialPosition.day, 'd').endOf('day');
	dragEvent.startMS = dragEvent.initialStartMoment.valueOf();
	dragEvent.endMS = dragEvent.initialEndMoment.valueOf();

	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: {
		dragEvent,
		multidayTempEvent: {...dragEvent},
		type: ACTIONS.GRID_CLICKED_NEW_EVENT
	}});

	// let the new event be rendered before dispatching event
	setTimeout(function () {
		dispatchGridClickNewEvent(state, dispatch, moment(dragEvent.initialStartMoment), moment(dragEvent.initialEndMoment));
	}, 50);
}

export function onResizeMultidayEventStart(mouseEvent, chunkEvent, viewSettings, state, dispatch, resizeType, eventRef) {
	mouseEvent.stopPropagation();
	const columnViewEl = viewSettings.multidayEventWrapperRef.current;
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	const initialPosition = getMousePositionDayTime(mouseEvent, gridBounds, viewSettings, state);

	// Change cursor pointer while moving the event
	mouseEvent.target.classList.add('event-dragging');

	// Hide drag preview using empty image
	mouseEvent.dataTransfer.setDragImage(columnViewEl.querySelector('.' + COL_EVENT_CONSTANTS.DRAG_IMG_CONTAINER), 0, 0);

	mouseEvent.dataTransfer.setData('text/plain', chunkEvent.id); // work around for firefox

	chunkEvent.initializeMoment();
	const dragEvent = {...chunkEvent};
	dragEvent.initialStartMoment = moment(chunkEvent.startMoment);
	dragEvent.initialEndMoment = moment(chunkEvent.endMoment);

	let temporaryEventConfig = {
		dragEvent,
		dragEventEl: eventRef.current,
		resizeType,
		startPosition: mouseEvent.clientX,
		eventBounds: eventRef.current.getBoundingClientRect(),
		gridBounds,
		initialPosition,
		eventState: EVENT_STATES.ONDRAGSTART,
		multidayTempEvent: {},
		type: ACTIONS.EVENT_RESIZED
	};

	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: temporaryEventConfig});
}

export function onResizeMultidayEventEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;

	mouseEvent.stopPropagation();
	const parentEvent = getEventById(state, chunkEvent.eventId);
	parentEvent.initializeMoment(state.properties.timezone);

	let {startMoment: tempStartMoment, endMoment: tempEndMoment} = parentEvent;
	const {dragEvent: {startMoment, endMoment}} = temporaryEventSettings;

	if (temporaryEventSettings.resizeType === POSITION.START)
		tempStartMoment = startMoment.isSame(endMoment, 'day') ? startMoment.startOf('day') : startMoment;
	else
		tempEndMoment = startMoment.isSame(endMoment, 'day') ? endMoment.endOf('day') : endMoment;

	if (parentEvent.startMS !== tempStartMoment.valueOf() || parentEvent.endMS !== tempEndMoment.valueOf())
		dispatchEventResize(state, dispatch, parentEvent, tempStartMoment, tempEndMoment);
	else
		clearTemporaryEvent(state, dispatch);
}

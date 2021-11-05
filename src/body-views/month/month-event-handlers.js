import { getEventBucketIndex } from './month-view-events';
import moment from 'moment-timezone';
import {ACTIONS, DIRECTION, EVENT_STATES, EVENT_TYPES} from '../../constants';
import toHTML from 'snabbdom-to-html';
import { getGridCellPos } from './utils';
import {
	dispatchEventMove,
	dispatchDragNewEventEnd,
	dispatchGridClickNewEvent,
	clearTemporaryEvent,
	anyToMoment,
	scrollViewOnEventDrag
} from '../../util';

export const MONTH_EVENT_CLASSES = {
	CLONE_NODE: 'cloned-node',
	DRAG_IMG_CONTAINER: 'drag-image-container',
	MONTH_VIEW_EVENT_BAR: 'month-event-bar',
	GRID_EVENTS_CONTAINER: 'grid-events',
	HIDE_EVENT_BAR: 'hide-event-bar',
	EVENT_DRAGGING: 'event-dragging',
	DROP_ZONE_ELEMENT: 'ev-drop-zone-el',
	EVENT_MOVE_STATE: 'event-tile-move-state',
	DRAG_CLONE_CONTAINER: 'drag-clone-container',
	EVENT_SELECTED: 'event-selected'
};

export const NUMBER_OF_COLUMNS = 7;

export function getMousePointerPos(mouseEvent, monthViewConfig, state) {
	const {properties: {dir}, startMoment, endMoment} = state;
	const gridAreaEl = getViewBodyContainer(monthViewConfig);
	const gridBounds = gridAreaEl.getBoundingClientRect();
	const columnWidth = gridBounds.width / NUMBER_OF_COLUMNS;
	let columnNumber = Math.floor((mouseEvent.clientX - gridBounds.x) / columnWidth);
	let topOffset = mouseEvent.clientY - gridBounds.top + gridAreaEl.scrollTop;

	let rowNumber = 0;
	let sum = 0;
	do {
		sum += monthViewConfig.rowHeights[rowNumber];
		rowNumber++;
	} while (sum <= topOffset);
	rowNumber--;
	if (dir && dir === DIRECTION.RTL)
		columnNumber = NUMBER_OF_COLUMNS - columnNumber - 1; // Invert the column number

	const startMomentCoords = getEventCoordsDirBased(state, startMoment);
	const endDateCoords = getEventCoordsDirBased(state, endMoment);
	if (rowNumber < startMomentCoords.row)
		rowNumber = startMomentCoords.row;
	if (rowNumber > endDateCoords.row)
		rowNumber = endDateCoords.row;

	return {
		rowNumber,
		columnNumber
	};
}

export function getEventCoordsDirBased(state, aMoment) {
	const {dir, firstDayOfWeek} = state.properties;
	let coords = getEventBucketIndex(firstDayOfWeek, state, aMoment);
	if (dir === DIRECTION.RTL)
		coords.col = NUMBER_OF_COLUMNS - coords.col - 1; // Invert the column number
	return coords;
}

function hideDragImage(mouseEvent, monthViewConfig) {
	let dragImageEl = monthViewConfig.monthViewContainerRef.current.getElementsByClassName(MONTH_EVENT_CLASSES.DRAG_IMG_CONTAINER)[0];
	if (dragImageEl)
		mouseEvent.dataTransfer.setDragImage(dragImageEl, 0, 0);
}

function addDragImage(mouseEvent, templateRenderer, state, event) {
	const {properties: props} = state;
	let dragImageEl = mouseEvent.currentTarget.cloneNode();
	dragImageEl.innerHTML = '';

	let vnode = templateRenderer.eventContainer(event, props);
	dragImageEl.innerHTML = toHTML(vnode);
	dragImageEl.classList.add(MONTH_EVENT_CLASSES.DRAG_CLONE_CONTAINER, MONTH_EVENT_CLASSES.CLONE_NODE, MONTH_EVENT_CLASSES.EVENT_SELECTED);

	mouseEvent.currentTarget.parentNode.appendChild(dragImageEl);

	if (dragImageEl)
		mouseEvent.dataTransfer.setDragImage(dragImageEl, 0, 0);
}

function dragEventHandler(mouseEvent, state, dispatch, monthViewConfig) {
	const { startMoment, endMoment, properties: props, temporaryEventSettings} = state;
	let { rowNumber, columnNumber } = getMousePointerPos(mouseEvent, monthViewConfig, state);

	let daysDiff = (rowNumber - temporaryEventSettings.initialRowNumber) * NUMBER_OF_COLUMNS + (columnNumber - temporaryEventSettings.initialColNumber);
	temporaryEventSettings.finalDaysDiff = daysDiff;

	// update the row and column number
	let eventStartDate, eventEndDate;
	if (temporaryEventSettings.actionName === ACTIONS.DRAG_END_NEW_EVENT) {
		if (rowNumber < temporaryEventSettings.initialRowNumber || (rowNumber === temporaryEventSettings.initialRowNumber && columnNumber < temporaryEventSettings.initialColNumber)) {
			eventStartDate = moment(startMoment).add(rowNumber * NUMBER_OF_COLUMNS + columnNumber, 'days');
		} else
			eventStartDate = moment(startMoment).add(temporaryEventSettings.initialRowNumber * NUMBER_OF_COLUMNS + temporaryEventSettings.initialColNumber, 'days');
			eventEndDate = moment(eventStartDate).add(Math.abs(daysDiff), 'days').endOf('day');

		if (!eventStartDate.isSame(temporaryEventSettings.tempNewEvent.startMoment, 'day') || !eventEndDate.isSame(temporaryEventSettings.tempNewEvent.endMoment, 'day')) {
			let tempEvent = temporaryEventSettings.tempNewEvent;
			tempEvent.startMoment = eventStartDate;
			tempEvent.endMoment = eventEndDate;
			tempEvent.startMS = eventStartDate.valueOf();
			tempEvent.endMS = eventEndDate.valueOf();
			dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: {...state.temporaryEventSettings, tempNewEvent: tempEvent, eventState: EVENT_STATES.ONDRAG}});
		}
	} else if (temporaryEventSettings.actionName === ACTIONS.EVENT_MOVED) {
		let originalEvent = state.dataProvider.getEventById(temporaryEventSettings.eventId);
		eventStartDate = anyToMoment(originalEvent.startMS, props).add(daysDiff, 'days');
		eventEndDate = anyToMoment(originalEvent.endMS, props).add(daysDiff, 'days');
		
		if (eventStartDate.isBefore(startMoment))
			eventStartDate = moment(startMoment);
		if (eventEndDate.isAfter(endMoment))
			eventEndDate = moment(endMoment);

		if (!eventStartDate.isSame(temporaryEventSettings.tempEvent.startMoment, 'day') || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGSTART) {
			const tempEvent = temporaryEventSettings.tempEvent;
			tempEvent.startMoment = eventStartDate;
			tempEvent.endMoment = eventEndDate;
			tempEvent.startMS = eventStartDate.valueOf();
			tempEvent.endMS = eventEndDate.valueOf();
			dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: {...state.temporaryEventSettings, tempEvent: tempEvent, eventState: EVENT_STATES.ONDRAG}});
		}
	}
}


/**
 * Event move on drag handling functions
 */
export function onEventDragStart(mouseEvent, span, templateRenderer, state, dispatch, monthViewConfig) {
	const {properties: props} = state;
	mouseEvent.target.classList.add(MONTH_EVENT_CLASSES.EVENT_DRAGGING, MONTH_EVENT_CLASSES.EVENT_MOVE_STATE);
	mouseEvent.dataTransfer.setData('text/plain', span.event.id);

	const mousePos = getMousePointerPos(mouseEvent, monthViewConfig, state);
	const tempSetting = {
		initialRowNumber: mousePos.rowNumber,
		initialColNumber: mousePos.columnNumber,
		eventId: span.event.id,
		tempEvent: {...span.event},
		finalDaysDiff: 0,
		eventState: EVENT_STATES.ONDRAGSTART,
		actionName: ACTIONS.EVENT_MOVED
	};
	addDragImage(mouseEvent, templateRenderer, state, span.event);
	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: tempSetting});
}

export function onEventDragEnd(mouseEvent, span, state, dispatch, monthViewConfig) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;

	mouseEvent.target.classList.remove(MONTH_EVENT_CLASSES.EVENT_DRAGGING);
	mouseEvent.target.classList.remove(MONTH_EVENT_CLASSES.EVENT_MOVE_STATE);
	// Remove cloned element used to show as drag image
	let cloneElements = getViewBodyContainer(monthViewConfig).getElementsByClassName(MONTH_EVENT_CLASSES.CLONE_NODE);
	for (let index = 0; cloneElements && index < cloneElements.length; index++) {
		let element = cloneElements[index];
		element.remove();
	}

	if (temporaryEventSettings.finalDaysDiff !== 0) {
		let event = span.event;
		let difference = temporaryEventSettings.finalDaysDiff * 86400000; //24 * 60 * 60 * 1000
		let newStartDate = anyToMoment(event.startMS, state.properties).add(temporaryEventSettings.finalDaysDiff, 'days');
		let newEndDate = anyToMoment(event.endMS, state.properties).add(temporaryEventSettings.finalDaysDiff, 'days');
		dispatchEventMove(state, dispatch, event, difference, newStartDate, newEndDate);
	} else
		clearTemporaryEvent(state, dispatch);
}

export function onEventDragOver(mouseEvent, state, dispatch, monthViewConfig) {
	const el = mouseEvent.currentTarget.getRootNode();
	if (el && el.activeElement)
		el.activeElement.blur();
	if (state.temporaryEventSettings) {
		scrollViewOnEventDrag(mouseEvent);
		if (state.temporaryEventSettings.actionName === ACTIONS.EVENT_MOVED || state.temporaryEventSettings.actionName === ACTIONS.DRAG_END_NEW_EVENT) {
			dragEventHandler(mouseEvent, state, dispatch, monthViewConfig);
		} else if (state.temporaryEventSettings.eventType === EVENT_TYPES.AGENDA_DRAG) {
			onAgendaDragOver(mouseEvent, state, dispatch, monthViewConfig);
			mouseEvent.preventDefault();
		}
	}
}

export function onAgendaDragOver(mouseEvent, state, dispatch, monthViewConfig) {
	const { startMoment, endMoment, temporaryEventSettings, properties: props } = state;
	let {rowNumber, columnNumber} = getMousePointerPos(mouseEvent, monthViewConfig, state);

	let eventStartDate = moment(startMoment).add(rowNumber * NUMBER_OF_COLUMNS + columnNumber, 'days');
	let eventEndDate = anyToMoment(temporaryEventSettings.originalEvent.endMS, props).add(eventStartDate.diff(anyToMoment(temporaryEventSettings.originalEvent.startMS, props)));

	if (eventEndDate.isAfter(endMoment))
		eventEndDate = moment(endMoment);

	if (!eventStartDate.isSame(anyToMoment(temporaryEventSettings.tempEvent.startMS, props), 'day')) {
		let tempEvent = temporaryEventSettings.tempEvent;
		tempEvent.startMoment = moment(eventStartDate);
		tempEvent.endMoment = moment(eventEndDate);
		tempEvent.startMS = eventStartDate.valueOf();
		tempEvent.endMS = eventEndDate.valueOf();

		dispatch(ACTIONS.INTERNAL_STATE_SET,{temporaryEventSettings: {...state.temporaryEventSettings, tempEvent: tempEvent, eventState: EVENT_STATES.ONDRAG}});
	}
}

export function onEventDrop(mouseEvent, state, dispatch, monthViewConfig) {
	const { startMoment, properties, temporaryEventSettings } = state;
	if (temporaryEventSettings && temporaryEventSettings.eventType === EVENT_TYPES.AGENDA_DRAG) {
		const {originalEvent} = temporaryEventSettings;
		let {rowNumber, columnNumber} = getMousePointerPos(mouseEvent, monthViewConfig, state);

 		let dropEventStartDate = moment(startMoment).add(rowNumber * NUMBER_OF_COLUMNS + columnNumber, 'days');

 		const eventStartMoment = anyToMoment(originalEvent.startMS, properties);
		const eventEndMoment = anyToMoment(originalEvent.endMS, properties);
		dropEventStartDate.set({
			hour:   eventStartMoment.get('hour'),
			minute: eventStartMoment.get('minute'),
			second: eventStartMoment.get('second'),
			milliseconds: eventStartMoment.get('milliseconds')
		});

 		let eventDuration = eventEndMoment.diff(eventStartMoment);
		const dropEventEndDate = dropEventStartDate.clone().add(eventDuration, 'milliseconds');

		let difference = dropEventStartDate.diff(eventStartMoment);
		if (difference !== 0)
			dispatchEventMove(state, dispatch, originalEvent, difference, dropEventStartDate, dropEventEndDate);
		else
			clearTemporaryEvent(state, dispatch);
	}
}

export function onDragLeave(event, state, dispatch) {
	const {temporaryEventSettings} = state;
	if (temporaryEventSettings && temporaryEventSettings.eventType === EVENT_TYPES.AGENDA_DRAG) {
		temporaryEventSettings.counter--;
		if (temporaryEventSettings.counter === 0) {
			temporaryEventSettings.eventState = EVENT_STATES.ONDRAGLEAVE;
			setTimeout(() => {
				dispatch(ACTIONS.INTERNAL_STATE_SET, {...temporaryEventSettings});
			});
		}
	}
}

export function onDragEnter(event, state) {
	const {temporaryEventSettings} = state;
	if (temporaryEventSettings && temporaryEventSettings.eventType === EVENT_TYPES.AGENDA_DRAG)
		temporaryEventSettings.counter++;
}

function createEvent(position, state) {
	const {startMoment} = state;
	const numberOfDays = position.rowNumber * NUMBER_OF_COLUMNS + position.columnNumber;
	let startDate = moment(startMoment).add(numberOfDays, 'days');
	let endDate = moment(startDate).endOf('day');
	return {
		startMS: startDate.valueOf(),
		endMS: endDate.valueOf(),
		id: 'new-event'
	};
}

function getViewBodyContainer(monthViewConfig) {
	return monthViewConfig.monthViewContainerRef.current.querySelector('.view-body');
}


/**
 * Event create on drag handling functions
 */
export function onGridCellDragStart(mouseEvent, state, dispatch, monthViewConfig) {
	const { properties: props } = state;
	mouseEvent.target.classList.add(MONTH_EVENT_CLASSES.EVENT_DRAGGING);

	const mousePos = getMousePointerPos(mouseEvent, monthViewConfig, state);
	const tempEvent = createEvent(mousePos, state);

	const tempSetting = {
		initialRowNumber: mousePos.rowNumber,
		initialColNumber: mousePos.columnNumber,
		tempNewEvent: {...tempEvent},
		finalDaysDiff: 0,
		eventState: EVENT_STATES.ONDRAGSTART,
		actionName: ACTIONS.DRAG_END_NEW_EVENT
	};

	mouseEvent.dataTransfer.setData('text/plain', tempEvent.id);
	hideDragImage(mouseEvent, monthViewConfig);
	dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings: tempSetting});
}

export function onGridCellDragEnd(mouseEvent, state, dispatch) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGEND)
		return;
	temporaryEventSettings.eventState = EVENT_STATES.ONDRAGEND;
	mouseEvent.target.classList.remove(MONTH_EVENT_CLASSES.EVENT_DRAGGING);

	if (temporaryEventSettings.tempNewEvent) {
		const {tempNewEvent: {startMoment, endMoment}} = temporaryEventSettings;
		dispatchDragNewEventEnd(state, dispatch, startMoment, endMoment);
	}
}

export function onGridClickHandler(mouseEvent, cellMoment, state, dispatch) {

	if (!mouseEvent.target.classList.contains('date-number')) {
		const mousePos = getGridCellPos(mouseEvent.currentTarget);
		dispatch(ACTIONS.INTERNAL_STATE_SET, {
			temporaryEventSettings: {
				tempNewEvent: createEvent(mousePos, state)
			}
		});

		// let the new event be rendered before dispatching event
		setTimeout(function () {
			dispatchGridClickNewEvent(state, dispatch, moment(cellMoment).startOf('day'), moment(cellMoment).endOf('day'));
		}, 50);
	}
}

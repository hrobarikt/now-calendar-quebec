import { KEYS, ACTIONS, DIRECTION} from '../../constants';
import {
	processKeyDownEvent,
	getNodeIndex,
	getCurrentViewProvider,
	updateCurrentDate,
	getRtlMap,
	isModifierKeyPressed,
	isCreateAllowed,
	isValidKeyEvent
	 } from '../../util';

function onKeyDown(event, state, dispatch) {
	if (isModifierKeyPressed(event, [KEYS.MODIFIER.SHIFT]) || !isValidKeyEvent(event))
		return;

	if ([KEYS.UP, KEYS.LEFT, KEYS.RIGHT, KEYS.DOWN].indexOf(event.keyCode) > -1) {
		if (event.shiftKey || !isCreateAllowed(state))
			return;

		event.preventDefault();
		let activeCell = event.currentTarget.querySelector('.item.grid:focus');
		if (!activeCell) {
			event.currentTarget.querySelector('.item.grid').focus();
			return;
		}

		const nextElement = getNextActiveGridCell(event, activeCell, state, dispatch);
		if (nextElement)
			nextElement.focus();
	} else {
		//Process view specific event handlers here
		const view = getCurrentViewProvider(state);
		processKeyDownEvent(event, view, state, dispatch);
	}
}

function getNextActiveGridCell(keyEvent, activeCell, state, dispatch) {
	const rtlMap = getRtlMap(state);
	switch(keyEvent.keyCode) {
	case KEYS.RIGHT:	return onRightArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.LEFT:		return onLeftArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.UP:		return onUpArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.DOWN:		return onDownArrowKey(activeCell, state, dispatch, rtlMap);
	default:		return null;
	}
}

function getRow(el) {
	return el.closest('.row');
}

/** Check if current element is part of multiday events grid */
function isMultiDayGridCell(el) {
	return el && el.closest('.multiday-event-grid');
}

/** Get table element from multiday events grid */
function getHeaderTable(cellEl) {
	let headerEl, tableEl;
	if (cellEl)
		headerEl = cellEl.closest('.calendar-column-view');

	if (headerEl)
		tableEl = headerEl.querySelector('.view-header .multiday-event-grid .table');

	return tableEl;
}

/** Get table element from content body grid */
function getBodyTable(cellEl) {
	let headerEl, tableEl;
	if (cellEl)
		headerEl = cellEl.closest('.calendar-column-view');

	if (headerEl)
		tableEl = headerEl.querySelector('.view-body .grid-area .table');

	return tableEl;
}

function onRightArrowKey(activeCell, state, dispatch, rtlMap) {
	if (activeCell[rtlMap.nextSibling])
		return activeCell[rtlMap.nextSibling];

	updateCurrentDate(state, dispatch, rtlMap[DIRECTION.RIGHT]);
	return getRow(activeCell)[rtlMap.firstChild];
}

function onLeftArrowKey(activeCell, state, dispatch, rtlMap) {
	if (activeCell[rtlMap.previousSibling])
		return activeCell[rtlMap.previousSibling];

	updateCurrentDate(state, dispatch, rtlMap[DIRECTION.LEFT]);
	return getRow(activeCell)[rtlMap.lastChild];
}

function onUpArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	let table = getBodyTable(activeCell);
	const cellIndex = getNodeIndex(activeCell);

	if (row && row.previousSibling)
		return row.previousSibling.childNodes[cellIndex];

	if (state.properties.splitMultiDayEvent) {
		if (activeCell.previousSibling && !row.previousSibling)
			return table.lastChild.childNodes[cellIndex - 1];
	} else {
		//Current cell part of multiday events grid
		if (isMultiDayGridCell(activeCell)) {
			if (activeCell.previousSibling)
				return table.lastChild.childNodes[cellIndex - 1];
		} else {
			table = getHeaderTable(activeCell);
			return table.lastChild.childNodes[cellIndex];
		}
	}
	updateCurrentDate(state, dispatch, DIRECTION.LEFT);
	return table.lastChild.lastChild;
}

function onDownArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	let table = getBodyTable(activeCell);
	const cellIndex = getNodeIndex(activeCell);

	if (row && row.nextSibling)
		return row.nextSibling.childNodes[cellIndex];

	if (state.properties.splitMultiDayEvent) {
		if (activeCell.nextSibling && !row.nextSibling)
			return table.firstChild.childNodes[cellIndex + 1];
	} else {
		//Current cell part of multiday events grid
		if (isMultiDayGridCell(activeCell)) {
			return table.firstChild.childNodes[cellIndex];
		} else {
			table = getHeaderTable(activeCell);
			if (activeCell.nextSibling)
				return table.firstChild.childNodes[cellIndex + 1];
		}
	}
	updateCurrentDate(state, dispatch, DIRECTION.RIGHT);
	return table.firstChild.firstChild;
}

function setFocus(calendarElement, state, lastFocusElement) {
	const allowCreate = isCreateAllowed(state);
	const events = calendarElement.querySelectorAll('.event');

	let target;
	if (lastFocusElement && calendarElement.contains(lastFocusElement)) {
		target = lastFocusElement;
	} else if (allowCreate) {
		target = calendarElement.querySelectorAll('.grid')[0];
	} else if (events.length > 0) {
		target = events[0];
	} else {
		target = calendarElement.querySelectorAll('.date-number')[0];
	}
	if (target)
		target.focus();
}

function resetFocus(state, lastFocusElement, calendarViewElement) {
	const allowCreate = isCreateAllowed(state);
	const events = calendarViewElement.querySelectorAll('.event');

	if (lastFocusElement && lastFocusElement.classList.contains('event') && calendarViewElement.querySelectorAll('.event').length > 0) {
		calendarViewElement.querySelectorAll('.event')[0].focus();
	} else if (calendarViewElement.querySelectorAll(':focus').length == 0) {
		if (allowCreate) {
			calendarViewElement.querySelectorAll('.grid')[0].focus();
		} else if (events.length > 0) {
			events[0].focus();
		} else {
			calendarViewElement.querySelectorAll('.date-number')[0].focus();
		}
	}
}

function getViewKeys() {
	let keys = [];
	const eventKey = {
		eventName: 'event',
		selector: '.event',
		keyCode: KEYS.E
	};

	keys.push(eventKey);

	const dateKey = {
		eventName: 'date',
		selector: '.date-number',
		keyCode: KEYS.D
	};
	keys.push(dateKey);
	return keys;
}

const keyHandlers =  {
	onKeyDown: onKeyDown,
	setFocus: setFocus,
	resetFocus: resetFocus,
	getViewKeys: getViewKeys
};
export default keyHandlers;

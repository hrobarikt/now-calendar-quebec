import { KEYS, ACTIONS, DIRECTION, INTERNAL_FORMAT} from '../../constants';
import {
	processKeyDownEvent,
	getNodeIndex,
	str2Moment,
	updateCurrentDate,
	getCurrentViewProvider,
	getRtlMap,
	isModifierKeyPressed,
	isCreateAllowed,
	isValidKeyEvent
} from '../../util';
import { getRow } from './utils';
import moment from 'moment-timezone';

function onKeyDown(event, state, dispatch) {
	if (isModifierKeyPressed(event, [KEYS.MODIFIER.SHIFT]) || !isValidKeyEvent(event))
		return;

	if ([KEYS.UP, KEYS.LEFT, KEYS.RIGHT, KEYS.DOWN].indexOf(event.keyCode) > -1) {
		if (event.shiftKey || !isCreateAllowed(state))
			return;

		event.preventDefault();
		const nextElement = getNextActiveGridCell(event, state, dispatch);
		if (nextElement)
			nextElement.focus();
	} else {
		//Process view specific event handlers here
		const view = getCurrentViewProvider(state);
		processKeyDownEvent(event, view, state, dispatch);
	}
}

function getNextActiveGridCell(keyEvent, state, dispatch) {
	let activeCell = keyEvent.currentTarget.querySelector('.grid-cell:focus');
	if (!activeCell) {
		return keyEvent.currentTarget.querySelector('.grid-cell');
	}

	const rtlMap = getRtlMap(state);
	switch(keyEvent.keyCode) {
	case KEYS.RIGHT:	return onRightArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.LEFT:		return onLeftArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.UP:		return onUpArrowKey(activeCell, state, dispatch, rtlMap);
	case KEYS.DOWN:		return onDownArrowKey(activeCell, state, dispatch, rtlMap);
	default: 		return null;
	}
}

function getCellMoment(state, activeCell, direction) {
	if (!activeCell || !state.contextMoment)
		return null;

	const nextDate = state.contextMoment.clone();
	if (!activeCell.classList.contains('current-month'))
		nextDate.add(direction == DIRECTION.RIGHT ? 1 : -1, 'months');

	const dateStr = moment().date(parseInt(activeCell.innerText)).month(nextDate.month()).year(nextDate.year()).format(INTERNAL_FORMAT.DATE_TIME);
	return str2Moment(dateStr);
}

function updateContextDate(state, dispatch, activeCell, direction, offsetDays) {
	let nextDate = getCellMoment(state, activeCell, direction);
	if (nextDate) {
		if (direction === DIRECTION.LEFT)
			offsetDays = -offsetDays;
		dispatch(ACTIONS.INTERNAL_STATE_SET, {focus: nextDate.add(offsetDays, 'days')});
		updateCurrentDate(state, dispatch, direction);
	}
}

function onRightArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	if (activeCell[rtlMap.nextSibling])
		return activeCell[rtlMap.nextSibling];

	if(row && row[rtlMap.nextSibling])
		return row[rtlMap.nextSibling][rtlMap.firstChild];

	updateContextDate(state, dispatch, activeCell, rtlMap[DIRECTION.RIGHT], 1);
	return null;
}

function onLeftArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	if (activeCell[rtlMap.previousSibling])
		return activeCell[rtlMap.previousSibling];

	if(row && row[rtlMap.previousSibling])
		return row[rtlMap.previousSibling][rtlMap.lastChild];

	updateContextDate(state, dispatch, activeCell, rtlMap[DIRECTION.LEFT], 1);
	return null;
}

function onUpArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	if (row && row.previousSibling)
		return row.previousSibling.childNodes[getNodeIndex(activeCell)];

	updateContextDate(state, dispatch, activeCell, DIRECTION.LEFT, 7);
	return null;
}

function onDownArrowKey(activeCell, state, dispatch, rtlMap) {
	const row = getRow(activeCell);
	if (row && row.nextSibling)
		return row.nextSibling.childNodes[getNodeIndex(activeCell)];

	updateContextDate(state, dispatch, activeCell, DIRECTION.RIGHT, 7);
	return null;
}

export function setCellFocus(state, dispatch, gridBodyEl) {
	if (!state.focus || !state.focus.isSame(state.contextMoment, 'month'))
		return;

	const cellDate = state.focus.date();
	const dayOneCell = gridBodyEl.querySelector('.current-month');
	if (dayOneCell) {
		const cellIndex = getNodeIndex(dayOneCell);
		const rem = (cellDate + cellIndex) % 7;
		const row = parseInt((cellDate + cellIndex) / 7) - (rem ? 0 : 1);
		const col = rem ? rem - 1 : 6;
		if (gridBodyEl.childNodes[row] && gridBodyEl.childNodes[row].childNodes[col]) {
			gridBodyEl.childNodes[row].childNodes[col].focus();
			dispatch(ACTIONS.INTERNAL_STATE_SET, {focus: null});
		}
	}
}

function setFocus(calendarElement, state, lastFocusElement) {
	const allowCreate = isCreateAllowed(state);
	const events = calendarElement.querySelectorAll('.event');

	let target;
	if (lastFocusElement && calendarElement.contains(lastFocusElement)) {
		target = lastFocusElement;
	} else if (allowCreate) {
		target = calendarElement.querySelectorAll('.grid-cell')[0];
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

	setTimeout(() => {
		if (lastFocusElement && lastFocusElement.classList.contains('event') && calendarViewElement.querySelectorAll('.event').length > 0) {
			calendarViewElement.querySelectorAll('.event')[0].focus();
		} else if (calendarViewElement.querySelectorAll(':focus').length == 0) {
			if (allowCreate) {
				calendarViewElement.querySelectorAll('.grid-cell')[0].focus();
			} else if (events.length > 0) {
				events[0].focus();
			} else {
				calendarViewElement.querySelectorAll('.date-number')[0].focus();
			}
		}
	}, 1000);
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

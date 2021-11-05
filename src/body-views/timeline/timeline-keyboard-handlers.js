import { KEYS, DIRECTION, ACTIONS } from '../../constants';
import { TimelineUtils } from './utils';
import {
	processKeyDownEvent,
	getCurrentViewProvider,
	isCreateAllowed,
	isModifierKeyPressed,
	isValidKeyEvent,
	getDirProperty,
	updateCurrentDate
} from '../../util';

const CLS_MAP = {
	TITLE_SECTION_CONTAINER: 'section-title-container',
	CHILD_SECTION_CONTAINER: 'child-section-container',
	EVENT_ROW_SECTION_HEAD: 'event-row-section-head',
	EVENT_ROW_SECTION: 'event-row-section',
	CLICKABLE: 'clickable'
};

function onKeyDown(event, state, dispatch) {
	if (isModifierKeyPressed(event, [KEYS.MODIFIER.SHIFT]) || !isValidKeyEvent(event))
		return;

	if ([KEYS.UP, KEYS.LEFT, KEYS.RIGHT, KEYS.DOWN].indexOf(event.keyCode) > -1) {
		if (event.shiftKey || !isCreateAllowed(state))
			return;

		event.preventDefault();
		let activeCell = getActiveCell(event.currentTarget);
		if (!activeCell && (!state.activeRow || isSectionElementActive(event)) ) {
			setFocusToFirstGridCell(event.currentTarget);
			return;
		}
		moveCellFocus(event, activeCell, state, dispatch);
	}
	else if (event.keyCode === KEYS.S) {
		setSectionHeaderFocus(event, state);
	} else {
		//Process view specific event handlers here
		const view = getCurrentViewProvider(state);
		processKeyDownEvent(event, view, state, dispatch);
	}
}

function isSectionElementActive(event) {
	let activeSectionEl = event.currentTarget.querySelector(':focus');
	return activeSectionEl && activeSectionEl.closest('.title-section');
}

function hasClass(el, cls) {
	return el && el instanceof HTMLElement && el.classList.contains(cls);
}

function traceBack(currentElement) {
	let ptr = currentElement.parentNode;
	while (ptr && (!ptr.nextSibling || hasClass(ptr.nextSibling, CLS_MAP.EVENT_ROW_SECTION_HEAD)))
		ptr = ptr.parentNode;

	if (hasClass(ptr.nextSibling, CLS_MAP.EVENT_ROW_SECTION))
		return ptr.nextSibling;

	return findNextSectionElement(ptr.nextSibling);
}

function findNextSectionElement(currentElement) {
	if (!currentElement)
		return null;

	if (hasClass(currentElement, CLS_MAP.TITLE_SECTION_CONTAINER)) {
		if (currentElement.lastElementChild) {
			if (hasClass(currentElement.lastElementChild, CLS_MAP.EVENT_ROW_SECTION_HEAD))
				return currentElement.lastElementChild;

			return findNextSectionElement(currentElement.lastElementChild);
		}
	}
	if (hasClass(currentElement, CLS_MAP.EVENT_ROW_SECTION_HEAD)) {
		// current element is row section head, find next row section
		const childSectionContainer = currentElement.parentNode.querySelector('.' + CLS_MAP.CHILD_SECTION_CONTAINER);
		if (childSectionContainer) {
			if (childSectionContainer.firstChild && hasClass(childSectionContainer.firstChild, CLS_MAP.EVENT_ROW_SECTION))
				return childSectionContainer.firstChild;
		} else {
			//no child section container, section is collapsed, traverse back
			return traceBack(currentElement);
		}
	}
	if (hasClass(currentElement, CLS_MAP.EVENT_ROW_SECTION)) {
		if (currentElement.nextSibling && hasClass(currentElement.nextSibling, CLS_MAP.EVENT_ROW_SECTION)) {
			//next row available
			return currentElement.nextSibling;
		}
		if (!currentElement.nextSibling) {
			//reached last row of current section, traverse back
			return traceBack(currentElement);
		}
		return findNextSectionElement(currentElement.nextSibling);
	}
	// Flat section present
	if (hasClass(currentElement, CLS_MAP.CHILD_SECTION_CONTAINER)) {
		const nextElement = currentElement.querySelector('.' + CLS_MAP.EVENT_ROW_SECTION);
		if (nextElement)
			return nextElement;
		return findNextSectionElement(nextElement);
	}
}

function traceDown(titleSectionElement) {
	const childSectionEl = titleSectionElement.querySelector('.' + CLS_MAP.CHILD_SECTION_CONTAINER);
	if (!childSectionEl)
		return titleSectionElement.lastElementChild;

	if (hasClass(childSectionEl.lastElementChild, CLS_MAP.EVENT_ROW_SECTION))
		return childSectionEl.lastElementChild;

	if (hasClass(childSectionEl.lastElementChild, CLS_MAP.TITLE_SECTION_CONTAINER))
		return traceDown(childSectionEl.lastElementChild);
}

function findPreviousSectionElement(currentElement) {
	if (!currentElement)
		return null;

	if (hasClass(currentElement, CLS_MAP.EVENT_ROW_SECTION_HEAD)) {
		const titleSectionEl = currentElement.closest('.' + CLS_MAP.TITLE_SECTION_CONTAINER);
		if (titleSectionEl)
			return findPreviousSectionElement(titleSectionEl);
	}
	if (currentElement.previousSibling) {
		if (hasClass(currentElement.previousSibling, CLS_MAP.EVENT_ROW_SECTION))
			return currentElement.previousSibling;

		if (hasClass(currentElement.previousSibling, CLS_MAP.TITLE_SECTION_CONTAINER))
			return traceDown(currentElement.previousSibling);
	}
	if (hasClass(currentElement, CLS_MAP.EVENT_ROW_SECTION)) {
		const prevElement =  currentElement.closest('.' + CLS_MAP.TITLE_SECTION_CONTAINER).lastElementChild;
		if (hasClass(prevElement, CLS_MAP.EVENT_ROW_SECTION_HEAD))
			return prevElement;
			// Flat section present as row section head not found
		const prevSectionSibling = currentElement.closest('.' + CLS_MAP.TITLE_SECTION_CONTAINER).previousSibling;
		if (hasClass(prevSectionSibling, CLS_MAP.EVENT_ROW_SECTION))
			return prevSectionSibling;

		if (hasClass(prevSectionSibling, CLS_MAP.TITLE_SECTION_CONTAINER))
			return traceDown(prevSectionSibling);
	}
}
/**
 * 
 * @param {KeyboardEvent} event 
 * @param {import('../../..').CalendarState} state 
 */
function setSectionHeaderFocus(event, state) {
	state.timelineView.onSectionTitleFocusChange(event);

}

function getCell(el) {
	return el.querySelector('.cell-focus');
}

function getActiveCell(el) {
	return el.querySelector('.cell-focus:focus');
}

function getFirstRow(calendarElement) {
	return calendarElement.querySelector('.event-row');
}

function getCellRow(cell) {
	return cell.closest('.event-row');
}

function getRowById(el, rowId) {
	return el.querySelector('[row_id="' + rowId + '"]');
}

function setCellFocus(cell, cellPos, state, direction, rowEl, dispatch) {
	if (cellPos >= 0 && state) {
		const cellWidth = TimelineUtils.getCellWidth(state.timelineView.viewConfig);
		cell.style[getDirProperty('start', state)] = cellPos * cellWidth + 'px';
		if (direction)
			updateScroll(cellWidth, cellPos, state, direction, rowEl, dispatch);
	}
	if (cellPos >= 0)
		cell.setAttribute('pos', cellPos + '');
	cell.style.visibility = 'visible';
	cell.focus();
}

function setFocusToFirstGridCell(calendarElement) {
	let currentRow = getFirstRow(calendarElement);
	if (currentRow)
		setCellFocus(getCell(currentRow), 0);
}

function scrollToLeftEnd(state, scrollTop) {
	const { timelineView, properties: props } = state;
	if (timelineView && timelineView.scroller)
		timelineView.scroller.scroll(props.dir && props.dir === DIRECTION.RTL ?  timelineView.eventAreaScrollWidth : 0, (scrollTop ? scrollTop : 0));
}

function scrollToRightEnd(state, scrollTop) {
	const { timelineView, properties: props } = state;
	if (timelineView && timelineView.scroller)
	timelineView.scroller.scroll(props.dir && props.dir === DIRECTION.RTL ? 0 : timelineView.eventAreaScrollWidth , (scrollTop ? scrollTop : 0));
}

function scrollToTop(state) {
	const { timelineView, properties: props } = state;
	if (timelineView && timelineView.scroller)
		timelineView.scroller.scroll(0,0);
}

function updateScroll(cellWidth, cellPos, state, direction, rowEl) {
	const { timelineView, properties: props } = state;
	const { viewConfig } = timelineView;
	const viewPort = timelineView.getViewPort();
	const offset = 3;	//Number of cells to scroll by
	const isRTL = props.dir && props.dir === DIRECTION.RTL;
	let cellHeight, cellTop, cellBottom;
	if (rowEl) {
		cellHeight = rowEl.getBoundingClientRect().height;
		cellTop = rowEl.getBoundingClientRect().top;
		cellBottom = rowEl.getBoundingClientRect().bottom;
	}
	switch (direction) {
	case DIRECTION.RIGHT:	if (isRTL) {
						if (cellWidth * cellPos < viewPort.x)
							timelineView.scroller.scroll(timelineView.eventAreaScrollWidth - viewPort.x - offset * cellWidth, viewPort.y);
						} else {
							if (cellWidth * (cellPos + 1) > (viewPort.width + viewPort.x))
								timelineView.scroller.scroll(viewPort.x + offset * cellWidth, viewPort.y);
						}
						break;
	case DIRECTION.LEFT:	if (isRTL) {
						if (cellWidth * (cellPos + 1) > (viewPort.width + viewPort.x))
							timelineView.scroller.scroll(timelineView.eventAreaScrollWidth - viewPort.width - viewPort.x - offset * cellWidth, viewPort.y);
						} else {
							if (cellWidth * (cellPos - 1) < viewPort.x)
								timelineView.scroller.scroll((viewPort.x - offset * cellWidth), viewPort.y);
						}
						break;
	case DIRECTION.DOWN:	if (rowEl) {
						if ((offset * cellHeight + cellBottom) > document.body.getBoundingClientRect().bottom)
							timelineView.scroller.scroll(timelineView.scrollLeft, (offset - 1) * cellHeight + cellTop);
						}
						break;
	case DIRECTION.UP:	if (rowEl) {
						if (timelineView.headerView && timelineView.headerView.scrollEl)
							if ((cellTop -  offset * cellHeight) < timelineView.headerView.scrollEl.getBoundingClientRect().top)
								timelineView.scroller.scroll(timelineView.scrollLeft, viewPort.y - Math.abs((offset - 1) * cellHeight + cellTop));
						}
						break;
	}
}

function moveCellFocus(keyEvent, activeCell, state, dispatch) {
	switch (keyEvent.keyCode) {
	case KEYS.RIGHT: moveHorizontally(activeCell, state, dispatch, DIRECTION.RIGHT);
		break;
	case KEYS.LEFT: moveHorizontally(activeCell, state, dispatch, DIRECTION.LEFT);
		break;
	case KEYS.UP: moveVertically(activeCell, keyEvent, state, dispatch, DIRECTION.UP);
		break;
	case KEYS.DOWN: moveVertically(activeCell, keyEvent, state, dispatch, DIRECTION.DOWN);
		break;
	default: return null;
	}
}

function moveHorizontally(activeCell, state, dispatch, direction) {
	if (!activeCell)
		return;
	activeCell.setAttribute("key", Date.now() + "");
	const { timelineView, properties: props } = state;
	const { viewConfig } = timelineView;
	const rowId = getCellRow(activeCell).getAttribute('row_id');
	const cellPos = TimelineUtils.getNextActiveCellPos(getDirProperty(direction, state), rowId, state, dispatch);
	if (cellPos > -1) {
		setCellFocus(activeCell, cellPos, state, direction);
	} else {
		// Edges reached, update context date
		let nextCellPos = 0;
		if ((props.dir === DIRECTION.RTL && direction === DIRECTION.RIGHT) || (props.dir === DIRECTION.LTR && direction === DIRECTION.LEFT))
			nextCellPos = viewConfig.xSize - 1;

		dispatch(ACTIONS.INTERNAL_STATE_SET, { activeRow: { id: rowId, cellPos: nextCellPos, scrollLeft: timelineView.scrollLeft, scrollTop: timelineView.scrollTop, viewChanged: true} });
		updateCurrentDate(state, dispatch, getDirProperty(direction, state));
	}
}

function moveVertically(activeCell, event, state, dispatch, direction) {
	if (!activeCell)
		return;

	const currentRowId = getCellRow(activeCell).attributes.row_id.value;
	let newRowId, cellPos = parseInt(activeCell.getAttribute('pos'));
	if (direction === DIRECTION.UP)
		newRowId = TimelineUtils.getPreviousRowId(currentRowId, cellPos, state, dispatch);

	if (direction === DIRECTION.DOWN)
		newRowId = TimelineUtils.getNextRowId(currentRowId, cellPos, state, dispatch);


	const newRow = getRowById(event.currentTarget, newRowId);
	if (newRow) {
		setCellFocus(getCell(newRow), cellPos, state, direction, newRow, dispatch);
		return;
	}
	if (!newRow && newRowId) {
		// newRow present but not yet rendered, update state
		updateScroll(null, cellPos, state, direction, getCellRow(activeCell));
	}
}

export function setCellFocusOnLoad(state, dispatch, containerEl) {
	if (!state.activeRow || !state.timelineView)
		return;
	const { activeRow: {id, cellPos, scrollLeft, scrollTop}} = state;
	const row = getRowById(containerEl, id);
	if (row) {
		//Adjust scroll for new viewport based on cell position (i.e. start(0)/end(23))
		if (state.activeRow.viewChanged) {
			if (state.activeRow.cellPos === 0)
				scrollToLeftEnd(state, scrollTop);
			else
				scrollToRightEnd(state, scrollTop);
		}
		let cell = getCell(row);
		setCellFocus(cell, cellPos, state);
		TimelineUtils.updateActiveCell(state, dispatch, id, cellPos);
	}
}

function setFocus(calendarElement, state, lastFocusElement) {
	const allowCreate = isCreateAllowed(state);
	const events = calendarElement.querySelectorAll('.event');
	let target;
	if (lastFocusElement && calendarElement.contains(lastFocusElement)) {
		target = lastFocusElement;
	} else if (allowCreate) {
		setFocusToFirstGridCell(calendarElement);
		scrollToLeftEnd(state);
	} else if (events.length > 0) {
		target = events[0];
	} else  {
		if (!allowCreate) {
			// Set focus on section header(or row in flat sections) if calendar is readonly and no events are there
			let sectionElement = calendarElement.querySelector('.' + CLS_MAP.TITLE_SECTION_CONTAINER);
			if (sectionElement && sectionElement.lastElementChild && hasClass(sectionElement.lastElementChild, CLS_MAP.EVENT_ROW_SECTION_HEAD)) {
				lastFocusElement = target = sectionElement.lastElementChild;
			} else{
				sectionElement = calendarElement.querySelector('.' + CLS_MAP.EVENT_ROW_SECTION);
				if (sectionElement)
					lastFocusElement = target = sectionElement;
			}
		}
		else
			target = calendarElement.querySelectorAll('.date-number')[0];
	}
	if (target)
		target.focus();
}

function resetFocus(state, lastFocusElement, calendarViewElement) {
	const allowCreate = isCreateAllowed(state);
	const events = calendarViewElement.querySelectorAll('.event');
	let target;
	setTimeout(()=> {
		if (lastFocusElement && lastFocusElement.classList.contains('event') && calendarViewElement.querySelectorAll('.event').length > 0) {
			target = calendarViewElement.querySelectorAll('.event')[0];
		} else if (calendarViewElement.querySelectorAll(':focus').length == 0) {
			if (allowCreate) {
				setFocusToFirstGridCell(calendarViewElement);
				scrollToLeftEnd(state);
			} else if (events.length > 0) {
				target = events[0];
			} else {
				if (!allowCreate) {
					// Set focus on section header(or row in flat sections) if calendar is readonly and no events are there
					let sectionElement = calendarViewElement.querySelector('.' + CLS_MAP.TITLE_SECTION_CONTAINER);
					if (sectionElement && sectionElement.lastElementChild && hasClass(sectionElement.lastElementChild, CLS_MAP.EVENT_ROW_SECTION_HEAD)) {
						lastFocusElement = target = sectionElement.lastElementChild;
					} else{
						sectionElement = calendarViewElement.querySelector('.' + CLS_MAP.EVENT_ROW_SECTION);
						if (sectionElement)
							lastFocusElement = target = sectionElement;
					}
				} else {
					target = calendarViewElement.querySelectorAll('.date-number')[0];
				}
			}
		}
		if (target)
			target.focus();
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

const keyHandlers = {
	onKeyDown: onKeyDown,
	setFocus: setFocus,
	resetFocus: resetFocus,
	getViewKeys: getViewKeys
};
export default keyHandlers;

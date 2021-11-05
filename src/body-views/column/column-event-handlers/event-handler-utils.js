import {COL_EVENT_CONSTANTS, getMousePositionDayTime} from '../util';
import {anyToMoment, getChunks, getDirProperty, getEventById, getTimeFromStartOfDay} from '../../../util';
import moment from 'moment-timezone';
import {ACTIONS, EVENT_STATES} from '../../../constants';
import {eventContainer} from '../column-template-renderer';
import toHTML from 'snabbdom-to-html';

function getColumnViewElement(viewSettings) {
	return viewSettings.columnViewRef.current;
}

function getChunkElementsByEventId(viewSettings, eid) {
	const columnViewEl = getColumnViewElement(viewSettings);
	return columnViewEl.querySelectorAll('[eid="' + eid + '"]');
}

export function getCurrentPosition(mouseEvent, viewSettings, state) {
	const columnViewEl = getColumnViewElement(viewSettings);
	const gridBounds = columnViewEl.querySelector('.grid-area').getBoundingClientRect();
	return getMousePositionDayTime(mouseEvent, gridBounds, viewSettings, state);
}

export function hideDragPreview(mouseEvent, viewSettings) {
	const columnViewEl = getColumnViewElement(viewSettings);
	mouseEvent.dataTransfer.setDragImage(columnViewEl.querySelector('.' + COL_EVENT_CONSTANTS.DRAG_IMG_CONTAINER), 0, 0);
}

export function hideActualEvent(viewSettings, eventId) {
	const chuckEls = getChunkElementsByEventId(viewSettings, eventId);
	chuckEls.forEach((chuckEl) => {
		chuckEl.style.opacity = 0;
	});
}

function repositionEventElement(eventEl, eventStartMS, eventEndMS, viewSettings, state) {
	const eventStartMoment = anyToMoment(eventStartMS, state.properties);
	const eventEndMoment = anyToMoment(eventEndMS, state.properties);
	const {startMoment} = state;
	const {numberOfDays, scaleSizeInSecs} = viewSettings;
	const startSecs = getTimeFromStartOfDay(eventStartMoment);
	const endSecs = getTimeFromStartOfDay(eventEndMoment);
	let startPosition = ((moment(eventStartMoment).diff(moment(startMoment).startOf('day'), 'd') * 100) / (numberOfDays));
	eventEl.classList.remove('event-zero-opacity');
	eventEl.style[getDirProperty('start', state)] = startPosition + '%';
	eventEl.style.top = (startSecs / scaleSizeInSecs * 100) + '%';
	eventEl.style.height = ((endSecs - startSecs) / scaleSizeInSecs * 100) + '%';
}

export function repositionEvent(temporaryEventSettings, viewSettings, state, dispatch) {
	const {properties: props} = state;
	const chuckEls = getChunkElementsByEventId(viewSettings, temporaryEventSettings.tempEvent.id);
	const chunks = getChunks(temporaryEventSettings.tempEvent, 1, state);
	const eventStateUpdated = state.temporaryEventSettings.eventState !== EVENT_STATES.ONDRAG;

	if (!eventStateUpdated && chunks.length <= chuckEls.length) {
		let parentEvent = getEventById(state, temporaryEventSettings.eventId);
		if (!parentEvent)
			parentEvent = {};
		chuckEls.forEach((chuckEl, index) => {
			let chunkEvent = chunks[index];
			if (chunkEvent) {
				let vnode = eventContainer({...parentEvent, ...chunkEvent}, props); // default template
				let $eventTemplateContainer = chuckEl.querySelector('.event-template-container');
				if ($eventTemplateContainer)
					$eventTemplateContainer.innerHTML = toHTML(vnode);
				repositionEventElement(chuckEl, chunkEvent.startMS, chunkEvent.endMS, viewSettings, state);
			} else {
				chuckEl.classList.add('event-zero-opacity');
			}
		});
	} else
		dispatch(ACTIONS.INTERNAL_STATE_SET, {temporaryEventSettings});
}

export function updateSettingsOnDrag(viewSettings, state, dispatch, updatedSettings) {
	state.temporaryEventSettings = {
		...state.temporaryEventSettings,
		eventState: EVENT_STATES.ONDRAG,
		...updatedSettings
	};
	repositionEvent(state.temporaryEventSettings, viewSettings, state, dispatch);
}

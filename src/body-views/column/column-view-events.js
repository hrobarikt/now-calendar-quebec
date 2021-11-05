import _ from 'lodash';
import {
	getTimeFromStartOfDay,
	getDirProperty,
	getOverlaps,
	getBestFitPosition,
	getDayEventsMap,
	getEventById,
	Log,
	debug,
	isMoveAllowed,
	isResizeAllowed,
	dispatchEventClick,
	getChunks,
	msToFormat,
	anyToMoment,
	isNDSColor,
	getEventAriaLabel,
	getTextColor,
	getBorderColor,
	getBgColor,
	isCustomColor, updateTooltip, getEventPopoverClassName
} from '../../util';
import {ACTIONS, EVENT_STATES, POPOVERS, GRADIENT, EVENT_TYPES, KEYS} from '../../constants';
import {createRef} from '@servicenow/ui-renderer-snabbdom';
import {
	onChunkEventMoveDragEnd,
	onChunkEventMoveDragStart,
	onChunkEventResizeDragEnd,
	onChunkEventResizeDragStart
} from './column-event-handlers/chunk-event-handlers';
import {POSITION} from '../../constants';
import moment from 'moment-timezone';
import {eventContainer} from './column-template-renderer';

function getPaddings() {
	/** All values are in % */
	return {
		startPadding: 0.2,
		endPadding: 1,
		spacing: 0.2,
	};
}

export function onEventClick(mouseClickEvent, state, dispatch, chunkEvent, parentEvent) {
	const position = {
		left: mouseClickEvent.clientX - document.querySelector('body').getBoundingClientRect().x,
		top: mouseClickEvent.clientY - document.querySelector('body').getBoundingClientRect().y
	};
	eventClickHandler(state, dispatch, chunkEvent, parentEvent, mouseClickEvent, position);
}

export function getPopoverXY(keyEvent) {
	const eventRect = keyEvent.currentTarget.getBoundingClientRect();
	const viewBodyEl = keyEvent.currentTarget.closest('.view-body');
	const bottom = Math.min(eventRect.bottom, document.body.getBoundingClientRect().bottom);
	const top = Math.max( eventRect.top, viewBodyEl ?  viewBodyEl.getBoundingClientRect().top : 0);
	return {
		left: eventRect.x + (eventRect.width / 2),
		top: top + (bottom - top) / 2
	}
}

export function onEventKeyEnter(keyEvent, state, dispatch, chunkEvent, parentEvent) {
	eventClickHandler(state, dispatch, chunkEvent, parentEvent, keyEvent, getPopoverXY(keyEvent));
}

function eventClickHandler(state, dispatch, chunkEvent, parentEvent, evt, position) {
	evt.stopPropagation();
	const {properties: props} = state;
	parentEvent.initializeMoment(props.timezone);
	dispatch(ACTIONS.TOGGLE_POPOVER,
		{
			popOver: POPOVERS.EVENT,
			event: parentEvent,
			eventEl: evt.currentTarget,
			pos: position
		}
	);
	dispatchEventClick(state, dispatch, parentEvent, anyToMoment(chunkEvent.startMS, props), anyToMoment(chunkEvent.endMS, props));
}

function getParentEventStyles(parentEvent) {
	let styles = {
		color: parentEvent.textColor,
		borderColor: parentEvent.borderColor
	};

	const bg = getBgColor(parentEvent.bgColor, parentEvent.gradientColor1, parentEvent.gradientColor2);
	if (parentEvent.gradientColor1 && parentEvent.gradientColor2)
		styles.background = bg;
	else styles.backgroundColor = bg;
	return styles;
}

function getEventStyles(parentEvent, chunkEvent, state) {
	if (parentEvent.bgColor) {
		parentEvent.textColor = getTextColor(parentEvent.textColor, parentEvent.bgColor);
		parentEvent.borderColor = getBorderColor(parentEvent.borderColor, parentEvent.bgColor);
	}
	let style = getParentEventStyles(parentEvent);
	return {
		...style,
		...getPositionStyles(parentEvent, chunkEvent, state)
	};
}

function getPositionStyles(parentEvent, chunkEvent, state) {
	let style = {};
	style[getDirProperty('start', state)] = chunkEvent.style.xPos;
	style.top = chunkEvent.style.top;
	style.width = chunkEvent.style.width;
	style.height = chunkEvent.style.height;
	style.borderHeight = chunkEvent.style.borderHeight;
	return style;
}

function onEventElement(state, chunkEvent, chunkEventEl) {
	if (chunkEvent && chunkEvent.style) {
		chunkEventEl.style[getDirProperty('start', state)] = chunkEvent.style.xPos;
		chunkEventEl.style.top = chunkEvent.style.top;
		chunkEventEl.style.width = chunkEvent.style.width;
		chunkEventEl.style.height = chunkEvent.style.height;
		if (!state.temporaryEventSettings) {
			chunkEventEl.style.opacity = 1; // reset for dragged event
		}
	}
}

function renderResizeHandler(resizeType, allowResize, chunkEvent, state, dispatch, viewSettings) {
	const cls = ['event-resize-handler'];
	if (allowResize)
		cls.push('allow-resize');
	return <div className={cls.join(' ')}
		draggable="true"
		ondragstart={(mouseEvent) => {
			if (allowResize)
				onChunkEventResizeDragStart(resizeType, mouseEvent, chunkEvent, viewSettings, state, dispatch);
		}}
		ondragend={(mouseEvent) => {
			if (allowResize)
				onChunkEventResizeDragEnd(resizeType, mouseEvent, chunkEvent, viewSettings, state, dispatch);
		}}
	/>;
}

function getEventHtml(state, dispatch, chunkEvent, viewSettings, templateRenderer, cls) {
	const {properties: props, startMoment, endMoment} = state;
	let parentEvent = getEventById(state, chunkEvent.eventId);
	let chunkEndMoment = anyToMoment(chunkEvent.endMS, props);
	if (chunkEvent.startMS === chunkEvent.endMS)
		return;
	if (!chunkEndMoment.isSame(chunkEndMoment.clone().add(1,'ms'), 'day') && chunkEvent.endMS < parentEvent.endMS)
		chunkEvent.endMS += 1;
	let eventRef = createRef();
	if (!parentEvent) {
		Log.error('Event not found!!', chunkEvent);
		debug();
	}

	const allowMove = isMoveAllowed(state, parentEvent);
	const allowResize = isResizeAllowed(state, parentEvent);

	if (allowResize)
		cls.push('event-resizable');
	cls.push(getEventPopoverClassName(state, parentEvent.id));

	if (isNDSColor(parentEvent.bgColor))
		cls.push(parentEvent.bgColor);
	else if (isCustomColor(parentEvent.bgColor, parentEvent.gradientColor1, parentEvent.gradientColor2))
		cls.push('default', 'custom-color');
	else
		cls.push('default');

	let eventStyle = getEventStyles(parentEvent, chunkEvent, state);
	const eventBorderHeight = parseFloat(eventStyle.borderHeight.slice(0, -1));

	if (eventBorderHeight < 100)
		cls.push('short-event');

	const eventAriaLabel = getEventAriaLabel(state, chunkEvent);

	const startResizeAllowed = (allowResize
		&& chunkEvent.startMS === parentEvent.startMS // dont allow when chunk start is not actual event start
		&& !(chunkEvent.startMS === startMoment.valueOf() && chunkEvent.endMS <= startMoment.valueOf() + (viewSettings.stepSize * 60000))); // dont allow if event start is same as view range start and its end is on same step
	const endResizeAllowed = (allowResize
		&& chunkEvent.endMS === parentEvent.endMS // dont allow when chunk end is not actual event end
		&& !(chunkEvent.endMS === endMoment.valueOf() && chunkEvent.startMS >= endMoment.valueOf() - (viewSettings.stepSize * 60000))); // dont allow if event end is same as view range start and its start is on same step

	return (<div className={cls.join(' ')}
				 style={eventStyle}
				 attrs={{eid: chunkEvent.eventId, chunkidx: chunkEvent.id}}
				 ref={eventRef}
				 tabindex="-1"
				 role='group'
				 aria-label={eventAriaLabel}
				 hook-update={(vnode) => onEventElement(state, chunkEvent, vnode.elm)} /* To get around defect #414 in seismic 6.1.0 */
				 on-click={(clickEvent) => onEventClick(clickEvent, state, dispatch, chunkEvent, parentEvent)}
				 on-keypress={(keyEvent) => { keyEvent.which === KEYS.ENTER ? onEventKeyEnter(keyEvent, state, dispatch, chunkEvent, parentEvent) : null; }}
				 on-mouseenter={(mouseEvent) => {
					 if (!state.temporaryEventSettings) {
					 	updateTooltip(dispatch, mouseEvent.target, chunkEvent.id, eventAriaLabel);
					 }
				 }}
				 draggable={allowMove + ''}
				 ondragstart={(mouseEvent) => onChunkEventMoveDragStart(mouseEvent, chunkEvent, viewSettings, state, dispatch)}
				 ondragend={(mouseEvent) => onChunkEventMoveDragEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch)}>
		<div className='event-border' style={{height: eventStyle.borderHeight, background: eventStyle.borderColor}}></div>
		<div className="event-tile-wrapper">
			{renderResizeHandler(POSITION.START, startResizeAllowed, chunkEvent, state, dispatch, viewSettings)}
			<div className="event-template-container">
				{templateRenderer.eventContainer({...parentEvent, ...chunkEvent}, props)}
			</div>
			{renderResizeHandler(POSITION.END, endResizeAllowed, chunkEvent, state, dispatch, viewSettings)}
		</div>
	</div>);
}

function renderEvent(state, dispatch, e, viewSettings, templateRenderer) {
	const cls = ['event'];
	if (e.chunksLength)
		cls.push('chunked');
	return getEventHtml(state, dispatch, e, viewSettings, templateRenderer, cls);
}

function getTemporaryEventHtml(state, dispatch, chunkEvent, parentEvent) {
	const {eventState, eventType} = state.temporaryEventSettings;
	if (eventState === EVENT_STATES.ONDRAGLEAVE)
		return '';
	const cls = ['event', 'event-temporary'];
	let projection = (eventType === EVENT_TYPES.MOVE || eventType === EVENT_TYPES.AGENDA_DRAG);
	if (chunkEvent.chunkId)
		cls.push('chunked');
	if (eventState === EVENT_STATES.ONDRAGSTART)
		cls.push('event-zero-opacity');
	const {properties: props} = state;
	if (!parentEvent)
		parentEvent = {};

	if (!projection && parentEvent) {
		if (isNDSColor(parentEvent.bgColor))
			cls.push(parentEvent.bgColor);
		else if (parentEvent.bgColor && parentEvent.bgColor.indexOf('#') !== -1)
			cls.push('default', 'custom-color');
		else
			cls.push('default');
	}

	let chuckStyles;
	if (!projection)
		chuckStyles = getEventStyles(parentEvent, chunkEvent, state);
	else {
		cls.push('event-projection');
		chuckStyles = getPositionStyles(parentEvent, chunkEvent, state);
	}

	return (<div className={cls.join(' ')}
				 style={chuckStyles}
				 attrs={{eid: chunkEvent.eventId, chunkidx: chunkEvent.id}}>
		{
			!projection
				? (<div className="event-template-container">{
					eventContainer({...parentEvent, ...chunkEvent}, props) // use default template while creation
				}</div>)
				: ''
		}
	</div>);
}

export function renderTemporaryEvent(viewSettings, templateRenderer, state, dispatch) {
	const {temporaryEventSettings, startMoment} = state;
	if (!temporaryEventSettings || !temporaryEventSettings.tempEvent)
		return '';

	const {tempEvent, eventId, eventState} = temporaryEventSettings;
	const parentEvent = getEventById(state, eventId);


	const {numberOfDays, scaleSizeInSecs} = viewSettings;
	const chunks = getChunks(tempEvent, 1, state);


	let eventWidth = (100 / numberOfDays);
	for (let chunk of chunks) {
		chunk.initializeMoment();
		const startSecs = getTimeFromStartOfDay(chunk.startMoment);
		const endSecs = getTimeFromStartOfDay(chunk.endMoment);
		const pos = moment(chunk.startMoment).startOf('day').diff(startMoment, 'days');
		chunk.style = {
			width: eventWidth + '%'
		};
		/*
	 	 * ensure new event div does not position under mouse and block dragover initialization.
	 	 */
		if (eventState === EVENT_STATES.ONDRAGSTART) {
			chunk.style.top = 0;
			chunk.style.height = 0;
			chunk.style.xPos = 0;
		} else {
			chunk.style.top = (startSecs / scaleSizeInSecs * 100) + '%';
			chunk.style.height = ((endSecs - startSecs) / scaleSizeInSecs * 100) + '%';
			chunk.style.xPos = (pos / numberOfDays * 100) + '%';
		}
	}

	return _.flatten(chunks.map(chunk => getTemporaryEventHtml(state, dispatch, chunk, parentEvent))).filter(html => !!html);
}

export function renderColumnViewEvents(viewSettings, templateRenderer, chunkEvents, state, dispatch) {
	if (!chunkEvents || chunkEvents.length === 0)
		return '';

	let eventsToRender = resolveEventOverlaps(viewSettings, chunkEvents, state);
	eventsToRender.sort((e1, e2) => e1.startMS - e2.startMS);
	return _.flatten(eventsToRender.map(e => renderEvent(state, dispatch, e, viewSettings, templateRenderer))).filter(html => !!html);
}

export function resolveEventOverlaps(viewSettings, events, state) {
	if (!events || !state)
		return [];

	const MAX_EVENTS_OVERLAP =  Math.trunc(200 / viewSettings.numberOfDays);

	//Get the overlapping events in different buckets for each day
	let dayEventsMap = getDayEventsMap(events, state);
	let finalEvents = [];
	for (const day in dayEventsMap) {
		let dayEvents = dayEventsMap[day];
		let overlaps = getOverlaps(dayEvents, null, state.properties.timezone, viewSettings);
		if (!overlaps)
			continue;

		for (const o in overlaps) {
			let overlapEvents = overlaps[o];
			if (!overlapEvents || overlapEvents.length === 0)
				continue;

			/** to do : sorting criteria to be configurable */
			/** sort overlapEvents array per the user config here before getting event positions */
			let bestFit = getBestFitPosition(overlapEvents, true);

			if (bestFit.divisor > MAX_EVENTS_OVERLAP) {
				bestFit.divisor = MAX_EVENTS_OVERLAP;
				bestFit.events = bestFit.events.filter(function(event){
					return event.startPosition < MAX_EVENTS_OVERLAP && event.endPosition <= MAX_EVENTS_OVERLAP;
				});
			}

			finalEvents.push(...processStyleAttributes(bestFit, viewSettings, day, state));
		}
	}
	return finalEvents;
}

/**
 *
 * Calculate relative positions and styles for one bucket of overlapping events in a day
 *
 */
function processStyleAttributes(bestFit, viewSettings, day, state) {
	let events = bestFit.events;
	const {numberOfDays, scaleSizeInSecs} = viewSettings;
	const layout = getPaddings();
	let totalWidth = (100 / numberOfDays) - layout.startPadding - layout.endPadding;
	let origStart = (100 / numberOfDays) * day + layout.startPadding;
	let eventWidth = (totalWidth / bestFit.divisor);
	for (let i = 0; i < events.length; i++) {
		let startSecs = events[i].startSec;
		let endSecs = events[i].endSec;
		let actualEndSecs = events[i].actualEndSec;

		const eventTop = startSecs / scaleSizeInSecs * 100;
		let eventHeight =(endSecs - startSecs) / scaleSizeInSecs * 100;

		const totalPosition = eventTop + eventHeight;

		if (totalPosition > 100) {
			eventHeight = 100 - eventTop;
		}

		events[i].style = {
			width: (eventWidth > layout.spacing ? (eventWidth * (events[i].endPosition - events[i].startPosition + 1) - layout.spacing) : eventWidth) + '%',
			xPos: (origStart + eventWidth * events[i].startPosition) + '%',
			top: eventTop + '%',
			height: eventHeight + '%',
			borderHeight: (((actualEndSecs - startSecs) / scaleSizeInSecs * 100) / eventHeight) * 100 + '%'
		};
	}
	return events;
}

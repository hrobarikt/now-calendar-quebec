import {getWeekEndDayNumber, getWeekDayIndex, getNextDateMS} from './utils';
import {
	getDirProperty,
	isMoveAllowed,
	dispatchEventClick,
	anyToMoment,
	msCompare,
	getEventAriaLabel,
	isNDSColor,
	getTextColor,
	getBorderColor,
	getBgColor,
	isCustomColor,
	getArrowHTML,
	msUtils,
	getDaysCountBetweenDates, updateTooltip, getEventPopoverClassName
} from '../../util';
import { onEventDragStart, onEventDragEnd, MONTH_EVENT_CLASSES } from './month-event-handlers';
import {ACTIONS, POPOVERS, KEYS, EVENT_STATES} from '../../constants';
import { createRef } from '@servicenow/ui-renderer-snabbdom';
import {t} from 'sn-translate';
import '@servicenow/now-button';
import { setFocus } from '../../agenda-view/agenda-view';

export function getEventBucketIndex(weekStartDayNumber, state, dateMS) {
	const {properties: props, startMoment} = state;
	const dateDiff = getDaysCountBetweenDates(dateMS, startMoment.valueOf(), props.timezone, false);
	const row = Math.trunc(dateDiff / 7);
	const col = getWeekDayIndex(weekStartDayNumber, msUtils.day(dateMS, props.timezone));
	return {
		row,
		col
	};
}

function getRowsHeightSum (rowHeights, rowIndex) {
	let sum = 0;
	for (let index = 0; index < rowIndex; index++) {
		sum += rowHeights[index];
	}
	return sum;
}

export function calculatePosition(state, span, offsetIndex, monthViewConfig) {
	let columnWidth = 100 / 7;
	const {paddingLeft, paddingRight, cellHeaderHeight, barHeight, rowHeights, gapBetweenBars} = monthViewConfig;

	let position = {};
	position.rowPosition = span.coords.col * columnWidth + (paddingLeft/columnWidth);
	position.columnPosition =  cellHeaderHeight + getRowsHeightSum(rowHeights, span.coords.row) + (offsetIndex * barHeight) + (offsetIndex * gapBetweenBars);

	let startPositionOffset = position.rowPosition + '%';
	let leftOrRightStyle = getDirProperty('start', state);

	let styles = {
		top: position.columnPosition + 'px',
		[leftOrRightStyle]: startPositionOffset,
		width : ((columnWidth * span.length) - ((paddingLeft + paddingRight)/columnWidth))  + '%',
		position : 'absolute',
		height : barHeight + 'px'
	};

	styles['color'] = getTextColor(span.event.textColor, span.event.bgColor);
	styles['borderColor'] = getBorderColor(span.event.borderColor, span.event.bgColor);

	const bg = getBgColor(span.event.bgColor, span.event.gradientColor1, span.event.gradientColor2);
	if (span.event.gradientColor1 && span.event.gradientColor2)
		styles.background = bg;
	else styles.backgroundColor = bg;

	return styles;
}

export function calculateDropzoneStyles (state, span, monthViewConfig) {
	let columnWidth = 100 / 7;
	const {paddingLeft, paddingRight, rowHeights} = monthViewConfig;

	let position = {};
	position.rowPosition = span.coords.col * columnWidth + (paddingLeft/columnWidth);
	position.columnPosition = getRowsHeightSum(rowHeights, span.coords.row);

	let	startPositionOffset = position.rowPosition + '%';
	let leftOrRightStyle = getDirProperty('start', state);

	let styles = {
		top: position.columnPosition + 'px',
		[leftOrRightStyle]: startPositionOffset,
		width : ((columnWidth * span.length) - ((paddingLeft + paddingRight)/columnWidth))  + '%',
		position : 'absolute',
		height : rowHeights[span.coords.row] + 'px',
	};

	return styles;
}

function clickHandler (mouseClickEvent, span, state, dispatch) {
	mouseClickEvent.stopPropagation();
	const {properties: props} = state;

	span.event.initializeMoment(props.timezone);
	dispatch(ACTIONS.TOGGLE_POPOVER,
		{
			popOver: POPOVERS.EVENT,
			event: span.event,
			eventEl: mouseClickEvent.currentTarget,
			pos: {
				left: mouseClickEvent.clientX - document.querySelector('body').getBoundingClientRect().x,
				top: mouseClickEvent.clientY - document.querySelector('body').getBoundingClientRect().y
			}
		}
	);
	let chunkStartMoment;
	let chunkEndMoment;
	if (span.eventChunk) {
		chunkStartMoment = anyToMoment(span.eventChunk.startMS, props);
		chunkEndMoment = anyToMoment(span.eventChunk.endMS, props);
	} else {
		chunkStartMoment = anyToMoment(span.event.startMS, props);
		chunkEndMoment = anyToMoment(span.event.endMS, props);
	}
	dispatchEventClick(state, dispatch, span.event, chunkStartMoment, chunkEndMoment);
}

function showMoreClickHandler (state, dispatch, coords, event) {
	const {startMoment, contextualPanelCurrentView} = state;
	let date = startMoment.clone().add(coords.row * 7 + coords.col, 'days');
	dispatch('PROPERTIES_SET', { contextDate:  date});
	if (contextualPanelCurrentView !== 'agenda-view') {
		dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView : 'agenda-view'});
	}
	setTimeout(() => setFocus(event, state), 500);
}

function onEventRender(state, span, index, monthViewConfig, eventEl) {
	const newStyle = calculatePosition(state, span, index, monthViewConfig);
	for (const key in newStyle) {
		eventEl.style[key] = newStyle[key];
	}
	if (eventEl.classList.contains('hide-event-bar'))
		eventEl.classList.remove('hide-event-bar');
}

function getEventTemplateData (event, chunkEvent, templateRenderer, state) {
	const {properties: props} = state;
	if (chunkEvent && chunkEvent.startMS && chunkEvent.endMS) {
		return templateRenderer.eventContainer({...event, ...chunkEvent}, props);
	} else
		return templateRenderer.eventContainer(event, props);
}

function getShowMoreEvents(state, dispatch, monthViewConfig, coords, spans, eventsRendered) {
	let updateStyles = (vNode) => {
		const startPosition = getDirProperty('start', state);
		const columnWidth = 100 /7;
		const {paddingLeft, cellHeaderHeight, barHeight, rowHeights, gapBetweenBars, maxNumberOfEventAllowed, monthViewContainerRef} = monthViewConfig;
		let startOffset = coords.col * columnWidth + (paddingLeft/columnWidth);
		const top = cellHeaderHeight + getRowsHeightSum(rowHeights, coords.row) + (maxNumberOfEventAllowed * barHeight) + (maxNumberOfEventAllowed * gapBetweenBars);
		const showMoreWidth = vNode.elm.getBoundingClientRect().width;

		if (monthViewContainerRef.current) {
			let showMoreWidthInPer = (showMoreWidth / monthViewContainerRef.current.getBoundingClientRect().width) * 100;
			let remainingSpaces = (columnWidth - showMoreWidthInPer) / 2;
			startOffset += remainingSpaces;
		}
		vNode.elm.style[startPosition] = startOffset + '%';
		vNode.elm.style.top = top + 'px';
	};
	const hiddenEvents = spans.length - monthViewConfig.maxNumberOfEventAllowed;
	return <div className='show-more-events-btn'
		key={`show-more${coords.row}_${coords.col}`}
		hook-update={(vNode) => updateStyles(vNode)}
		hook-insert={(vNode) => updateStyles(vNode)}
		><a on-click={(e) => showMoreClickHandler(state, dispatch, coords, e)} tabindex="-1" className="event view-more"
			on-keypress={(event) => { event.which === KEYS.ENTER ? showMoreClickHandler(state, dispatch, coords, event) : null; }}>
			{t('{0} more', hiddenEvents)}
		</a>
	</div>;
}

function getSpanClasses(span, state) {
	let cls = ['month-event-bar', 'event', getEventPopoverClassName(state, span.event.rawEvent.id)];
	if (isNDSColor(span.event.bgColor))
		cls.push(span.event.bgColor);
	else if (isCustomColor(span.event.bgColor, span.event.gradientColor1, span.event.gradientColor2))
		cls.push('default', 'custom-color');
	else
		cls.push('default');
	cls.push(span.event.type);
	if (isStartArrowVisible(span.event, state, span.eventChunk ? span.eventChunk.startMS : span.event.startMS))
		cls.push('show-left-arrow');
	if (isEndArrowVisible(span.event, state, span.eventChunk ? span.eventChunk.endMS : span.event.endMS))
		cls.push('show-right-arrow');
	cls.push('month-event-bar-' + span.event.id);
	cls = cls.concat(span.eventClass);
	return cls;
}

export function renderEvents(state, dispatch, dayBucket, monthViewConfig, templateRenderer) {
	const eventsWrapper = [];
	const renderedEvents = {};
	const startArrowHtml = getArrowHTML(state, 'start');
	const endArrowHtml = getArrowHTML(state, 'end');

	for (let key in dayBucket) {
		const spans = dayBucket[key];
		const coords = {};
		coords.row = parseInt(key.split('_')[0]);
		coords.col = parseInt(key.split('_')[1]);
		for (let index = 0; index < spans.length && index < monthViewConfig.maxNumberOfEventAllowed; index++) {
			const span = spans[index];
			if (!span.isPartOfMultiDay) {
				const eventRef = createRef();
				const cls = getSpanClasses(span, state);
				const styles = calculatePosition(state, span, index, monthViewConfig);
				const moveAllowed = isMoveAllowed(state, span.event);
				eventsWrapper.push(<div
					ref={eventRef}
					key={`month-event-${span.event.id}-${span.coords.row}-${span.coords.col}`}
					className={cls.join(' ')}
					role='button'
					style={styles}
					on-click={(e) => clickHandler(e, span, state, dispatch)}
					on-keypress={(e) => { e.which === KEYS.ENTER ? clickHandler(e, span, state, dispatch) : null; }}
					on-dragstart={moveAllowed ? (mouseEvent) => onEventDragStart(mouseEvent, span, templateRenderer, state, dispatch, monthViewConfig) : null}
					on-dragend={moveAllowed ? (mouseEvent) => onEventDragEnd(mouseEvent, span, state, dispatch, monthViewConfig) : null}
					hook-update={(vnode) => onEventRender(state, span, index, monthViewConfig, vnode.elm)}
					draggable={moveAllowed}
					attrs={{eid: span.event.id, tabindex: '-1', ['aria-label']: span.eventChunk ? getEventAriaLabel(state, span.eventChunk) : getEventAriaLabel(state, span.event)}}
          			on-mouseenter={(mouseEvent) => {
						// Do not dispatch if event is dragging
						if (!state.eventDragInfo) {
							updateTooltip(dispatch, mouseEvent.target, span.event.id, span.eventChunk ? getEventAriaLabel(state, span.eventChunk) : getEventAriaLabel(state, span.event));
						}
					}}
				><div className='event-tile-wrapper'>
						<div className='event-left-arrow'>
							{startArrowHtml}
						</div>
						<div className='event-template-container'>{getEventTemplateData(span.event, span.eventChunk, templateRenderer, state)}</div>
						<div className='event-right-arrow'>
							{endArrowHtml}
						</div>
					</div>
				</div>);
			}
		}

		if (spans.length > monthViewConfig.maxNumberOfEventAllowed) {
			eventsWrapper.push(getShowMoreEvents(state, dispatch, monthViewConfig, coords, spans, renderedEvents[key]));
		}
	}

	return eventsWrapper;
}


function addSpanToEventsBucket(spans, event, coords, length, isMultiDay, isPartOfMultiDay, order, eventChunk, eventClass = []) {
	let span = {};
	span.coords = coords;
	span.event = event;
	span.length = length;
	span.isPartOfMultiDay = isPartOfMultiDay;
	span.isMultiDay = isMultiDay;
	span.eventChunk = eventChunk;
	span.eventClass = eventClass;

	spans[coords.row + '_' + coords.col] = spans[coords.row + '_' + coords.col] || [];
	let cellSpans = spans[coords.row + '_' + coords.col];

	if (order)
		span.order = order;
	else {
		let spanOrderIndex = 0;
		for (spanOrderIndex; spanOrderIndex < cellSpans.length; spanOrderIndex++) {
			if (cellSpans[spanOrderIndex].order > spanOrderIndex) {
				break;
			}
		}
		span.order = spanOrderIndex;
	}

	let spanIndex = span.order;
	for (spanIndex; spanIndex < cellSpans.length; spanIndex++) {
		if (cellSpans[spanIndex].order > span.order)
			break;
	}	
	cellSpans.splice(spanIndex, 0, span);
	return spanIndex;
}

function isStartArrowVisible (event, state, chunkStartMS) {
	return !!(msCompare.isBefore(event.startMS, state.startMoment.valueOf(), 'day', state.properties.timezone) && msCompare.isSame(chunkStartMS, state.startMoment.valueOf(), 'day', state.properties.timezone) && (chunkStartMS - event.startMS > 1));
}

function isEndArrowVisible (event, state, chunkEndMS) {
	return !!(msCompare.isAfter(event.endMS, state.endMoment.valueOf(), 'day', state.properties.timezone) && msCompare.isSame(chunkEndMS, state.endMoment.valueOf(), 'day', state.properties.timezone) && (event.endMS - chunkEndMS > 1));
}

// Adjust event in next day bucket
function adjustHiddenEventInNextDayBucket (spans, event, coords, order, chunkEvent, length, monthViewConfig) {
	let eventEndCol = coords.col + length;
	for (coords.col = coords.col + 1; coords.col < eventEndCol; coords.col++) {
		// check if the bucket is already full then move to the next day bucket
		let nextDayBucket = spans[coords.row + '_' + coords.col] ? spans[coords.row + '_' + coords.col] : [];
		if (nextDayBucket.length < monthViewConfig.maxNumberOfEventAllowed) {
			// find the order
			order = addSpanToEventsBucket(spans, event, {...coords}, eventEndCol - coords.col, true, false, null, chunkEvent, ['show-left-arrow']);

			// Add the event in subsequent buckets
			for (coords.col = coords.col + 1; coords.col < eventEndCol; coords.col++) {
				addSpanToEventsBucket(spans, event, {...coords}, 0, true, true, order, chunkEvent);
			}
			break;
		} else {
			addSpanToEventsBucket(spans, event, {...coords}, 0, true, true, order, chunkEvent);
		}
	}
}

function splitMultiDayEventIntoChunks(limitStartMS, limitEndMS, spans, event, state, monthViewConfig) {
	const {properties: {firstDayOfWeek: weekStartDayNumber, splitMultiDayEvent, timezone}} = state;
	const weekEndDayNumber = getWeekEndDayNumber(weekStartDayNumber);
	const limitEndStartOfDay = msUtils.startOf(limitEndMS, 'day', timezone);
	if (msCompare.isSame(limitEndMS , limitEndStartOfDay, timezone))
		limitEndMS = msUtils.endOf(msUtils.add(limitEndMS, -1, 'day', timezone), 'day', timezone);

	if (msCompare.isSameOrBefore(limitStartMS, limitEndMS, 'day', timezone)) {
		let nextDayMS = splitMultiDayEvent ? limitStartMS : getNextDateMS(limitStartMS, weekEndDayNumber, timezone);

		if (msCompare.isSame(nextDayMS, event.endMS, 'day', timezone))
			nextDayMS = event.endMS;
		else
			nextDayMS = msUtils.endOf(nextDayMS, 'day', timezone);

		const chunkEvent = {
			startMS: limitStartMS,
			endMS: nextDayMS
		};
		const coords = getEventBucketIndex(weekStartDayNumber, state, limitStartMS);

		if (msCompare.isSameOrBefore(limitEndMS, nextDayMS, 'day', timezone)) {
			const length = getDaysCountBetweenDates(limitEndMS - 1, limitStartMS, timezone, true);
			chunkEvent.endMS = limitEndMS;
			let order = addSpanToEventsBucket(spans, event, coords, length, true, false, null, chunkEvent);
			if (spans[coords.row + '_' + coords.col].length > monthViewConfig.maxNumberOfEventAllowed) {
				adjustHiddenEventInNextDayBucket(spans, event, {...coords}, order, chunkEvent, length, monthViewConfig);
			} else {
				addMultiDayChunks(limitStartMS, limitEndMS, spans, event, state, order);
			}
		} else {
			const length = getDaysCountBetweenDates(nextDayMS, limitStartMS, timezone, true);
			const order = addSpanToEventsBucket(spans, event, coords, length, true, false, null, chunkEvent);
			if (spans[coords.row + '_' + coords.col].length > monthViewConfig.maxNumberOfEventAllowed)
				adjustHiddenEventInNextDayBucket(spans, event, coords, order, chunkEvent, length, monthViewConfig);
			else
				addMultiDayChunks(limitStartMS, nextDayMS, spans, event, state, order);
			nextDayMS = msUtils.add(nextDayMS, 1, 'days', timezone);
			nextDayMS = msUtils.startOf(nextDayMS,  'day', timezone);
			splitMultiDayEventIntoChunks(nextDayMS, limitEndMS, spans, event, state, monthViewConfig);
		}
	}
}

function addMultiDayChunks(startMS, endMS, spans, event, state, order) {
	const {properties: {firstDayOfWeek, timezone}} = state;
	let dateMS = startMS;
	dateMS = msUtils.add(dateMS, 1, 'days', timezone);
	while (msCompare.isSameOrBefore(dateMS, endMS, 'day', timezone)) {
		const coords = getEventBucketIndex(firstDayOfWeek, state, dateMS);
		addSpanToEventsBucket(spans, event, coords, 0, true, true, order);
		dateMS = msUtils.add(dateMS, 1, 'days', timezone);
	}
}

function processEvent(event, state, spans, monthViewConfig) {
	const {properties: {firstDayOfWeek: weekStartDayNumber}, startMoment, endMoment} = state;

	if (event.endMS < startMoment.valueOf() || event.startMS > endMoment.valueOf() || event.startMS === event.endMS)
		return;

	if (event.startMS < startMoment.valueOf()) {
		if (event.endMS > endMoment.valueOf())
			splitMultiDayEventIntoChunks(startMoment.valueOf(), endMoment.valueOf(), spans, event, state, monthViewConfig);
		else
			splitMultiDayEventIntoChunks(startMoment.valueOf(), event.endMS, spans, event, state, monthViewConfig);
	} else if (event.startMS >= startMoment.valueOf() && event.startMS <= endMoment.valueOf() && event.endMS > endMoment.valueOf())
		splitMultiDayEventIntoChunks(event.startMS, endMoment.valueOf(), spans, event, state, monthViewConfig);
	else {
		if (msCompare.isSame(event.startMS, event.endMS, 'day', state.properties.timezone)) {
			const coords = getEventBucketIndex(weekStartDayNumber, state, event.startMS);
			const spanLength = 1;
			addSpanToEventsBucket(spans, event, coords, spanLength, false, false, null);
		} else {
			splitMultiDayEventIntoChunks(event.startMS, event.endMS, spans, event, state, monthViewConfig);
		}
	}
}

export function getEventBuckets(events, state, monthViewConfig) {
	let spans = {};

	if (events && events.length === 0)
		return;

	for (const event of events)
		processEvent(event, state, spans, monthViewConfig);
	return spans;
}

function renderTemporaryEvent(state, monthViewConfig) {

	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGSTART || !temporaryEventSettings.tempEvent)
		return '';

	let tempEventHtml = [];

	let eventsBucket = getEventBuckets([state.temporaryEventSettings.tempEvent], state, monthViewConfig);
	for (let key in eventsBucket){
		let bucket = eventsBucket[key];
		bucket.forEach((span, i) => {
			if (!span.isPartOfMultiDay) {
				const tempEventStyle = calculateDropzoneStyles(state, span, monthViewConfig);
				const htmlChunk = <div style={tempEventStyle} className={MONTH_EVENT_CLASSES.DROP_ZONE_ELEMENT}/>;
				tempEventHtml.push(htmlChunk);
			}
		});
	}
	return tempEventHtml;
}

function renderTemporaryNewEvents(state, monthViewConfig) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGSTART || !temporaryEventSettings.tempNewEvent)
		return '';

	let tempEvetsHtml = [];

	let eventsBucket = getEventBuckets([temporaryEventSettings.tempNewEvent], state, monthViewConfig);
	for (let key in eventsBucket){
		let bucket = eventsBucket[key];
		let cls = [MONTH_EVENT_CLASSES.MONTH_VIEW_EVENT_BAR, MONTH_EVENT_CLASSES.CLONE_NODE];
		bucket.forEach((span, i) => {
			if (!span.isPartOfMultiDay) {
				const eventStyles = calculatePosition(state, span, i, monthViewConfig);
				const htmlChunk = <div
					style={eventStyles}
					className={cls.join(' ')}></div>;
				tempEvetsHtml.push(htmlChunk);
			}
		});
	}

	return tempEvetsHtml;
}

function renderMonthViewEvents(eventsBucket, state, dispatch, monthViewConfig, templateRenderer) {
	return (
		<div className='grid-events'>
			{renderEvents(state, dispatch, eventsBucket, monthViewConfig, templateRenderer)}
			{renderTemporaryEvent(state, monthViewConfig)}
			{renderTemporaryNewEvents(state, monthViewConfig)}
		</div>
	);
}

export default renderMonthViewEvents;

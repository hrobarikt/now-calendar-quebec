import moment from 'moment-timezone';
import {createRef} from '@servicenow/ui-renderer-snabbdom';
import {ACTIONS, POSITION, KEYS, INTERNAL_FORMAT, EVENT_STATES, DIRECTION} from '../../constants';
import {onEventClick, onEventKeyEnter} from './column-view-events';
import {onViewRender} from './column-helper';
import {
	onMultiDayEventDragStart,
	onMultiDayEventDragEnd,
	onMultiDayEventDrag,
	onMultidayGridDragStart,
	onMultidayGridDragEnd,
	onResizeMultidayEventStart,
	onResizeMultidayEventEnd,
	getMultidayEventConfig,
	createMultidayEventOnClick
} from './column-event-handlers/multiday-event-handlers';
import {
	getEventById,
	Log,
	debug,
	isMoveAllowed,
	isCreateAllowed,
	isResizeAllowed,
	getOverlaps,
	getDirProperty,
	getBlockSpanOnDate,
	anyToMoment,
	getEventAriaLabel,
	isNDSColor,
	getTextColor,
	getBorderColor,
	getBgColor,
	isCustomColor,
	getBestFitPosition,
	getArrowHTML,
	msCompare, updateTooltip,
	getEventPopoverClassName
} from '../../util';
import { getMousePositionDayTime, getGridCellPositionDay } from './util';

function getEventStyles(parentEvent, chunkEvent, state, viewSettings) {
	const { numberOfDays } = viewSettings;
	const leftOrRightStyle = getDirProperty('start', state);
	const multidayEventsConfig = getMultidayEventConfig();
	const left = anyToMoment(chunkEvent.startMS, state.properties).diff(state.startMoment, 'day');
	const right = anyToMoment(chunkEvent.endMS - 1, state.properties).diff(state.startMoment, 'day');
	const length = right - left + 1;
	const width = 100 / numberOfDays;
	const eventHeight = multidayEventsConfig.height;
	const top = (eventHeight + multidayEventsConfig.gapBetweenEvents) * chunkEvent.startPosition + multidayEventsConfig.gapBetweenEvents;
	let styles = {
		[leftOrRightStyle]: (width * left + multidayEventsConfig.leftPadding) + '%',
		width: (width * length - multidayEventsConfig.leftPadding - multidayEventsConfig.rightPadding) + '%',
		height: eventHeight + 'px',
		top: top + 'px'
	};

	styles['color'] = getTextColor(parentEvent.textColor, parentEvent.bgColor);
	styles['borderColor'] = getBorderColor(parentEvent.borderColor, parentEvent.bgColor);

	const bg = getBgColor(parentEvent.bgColor, parentEvent.gradientColor1, parentEvent.gradientColor2);
	if (parentEvent.gradientColor1 && parentEvent.gradientColor2)
		styles.background = bg;
	else styles.backgroundColor = bg;

	return styles;
}

function getTempEventStyles(chunkEvent, state, viewSettings) {
	const { numberOfDays } = viewSettings;
	const leftOrRightStyle = getDirProperty('start', state);
	const multidayEventsConfig = getMultidayEventConfig();
	const left = anyToMoment(chunkEvent.startMS, state.properties).diff(state.startMoment, 'day');
	const right = anyToMoment(chunkEvent.endMS - 1, state.properties).diff(state.startMoment, 'day');
	const length = right - left + 1;
	const width = 100 / numberOfDays;
	let style = {};
	style[leftOrRightStyle] = (width * left + multidayEventsConfig.leftPadding) + '%';
	style.width = (width * length - multidayEventsConfig.leftPadding - multidayEventsConfig.rightPadding) + '%';
	return style;
}

function getTempNewEventStyles(chunkEvent, state, viewSettings) {
	const multidayEventsConfig = getMultidayEventConfig();
	let styles = getTempEventStyles(chunkEvent, state, viewSettings);
	styles.top = multidayEventsConfig.gapBetweenEvents + 'px';
	styles.height = multidayEventsConfig.height + 'px';
	return styles;
}

function onEventElement(parentEvent, chunkEvent, state, viewSettings, el) {
	let newStyle = getEventStyles(parentEvent, chunkEvent, state, viewSettings);
	for (const key in newStyle) {
		el.style[key] = newStyle[key];
	}
}

function showStartEventArrow(limitStartMS, chunkEvent, parentEvent) {
	if (chunkEvent.startMS != parentEvent.startMS && parentEvent.startMS < limitStartMS)
		return '';
	return 'hide-event-arrow-icon';
}

function showEndEventArrow(limitEndMS, chunkEvent, parentEvent) {
	if (chunkEvent.endMS !== parentEvent.endMS && parentEvent.endMS > limitEndMS && (parentEvent.endMS - chunkEvent.endMS > 1))
		return '';
	return 'hide-event-arrow-icon';
}

function getEventHtml(state, dispatch, chunkEvent, viewSettings, templateRenderer, cls) {
	const {properties: props, startMoment, endMoment} = state;
	let parentEvent = getEventById(state, chunkEvent.eventId);

	let eventRef = createRef();
	if (!parentEvent) {
		Log.error('Event not found!!', chunkEvent);
		debug();
	}

	if (isNDSColor(parentEvent.bgColor))
		cls.push(parentEvent.bgColor);
	else if (isCustomColor(parentEvent.bgColor, parentEvent.gradientColor1, parentEvent.gradientColor2))
		cls.push('default', 'custom-color');
	else
		cls.push('default');
	cls.push(getEventPopoverClassName(state, parentEvent.id));
	const allowMove = isMoveAllowed(state, parentEvent);
	const allowResize = isResizeAllowed(state, parentEvent);
	const showStartResizeClass = (chunkEvent.startMS === parentEvent.startMS
	&& allowResize
	&& !(msCompare.isSame(chunkEvent.startMS, startMoment.valueOf(), 'day', props.timezone) && msCompare.isSame(chunkEvent.endMS, startMoment.valueOf(), 'day', props.timezone))) ?  '' : 'hide-resize-event-bar' ;
	const showEndResizeClass = (chunkEvent.endMS === parentEvent.endMS
	&& allowResize
	&& !(msCompare.isSame(chunkEvent.startMS, endMoment.valueOf(), 'day', props.timezone) && msCompare.isSame(chunkEvent.endMS, endMoment.valueOf(), 'day', props.timezone))) ? '' : 'hide-resize-event-bar' ;

	return (<div className={cls.join(' ')}
				 style={getEventStyles(parentEvent, chunkEvent, state, viewSettings)}
				 attrs={{eid: chunkEvent.eventId, chunkidx: chunkEvent.id, tabIndex: '-1'}}
				 ref={eventRef}
		role='group'
		aria-label={getEventAriaLabel(state, chunkEvent)}
		hook-update={(vnode) => onEventElement(parentEvent, chunkEvent, state, viewSettings, vnode.elm)}
		on-click={(clickEvent) => onEventClick(clickEvent, state, dispatch, chunkEvent, parentEvent)}
		on-keypress={(keyEvent) => { keyEvent.which === KEYS.ENTER ? onEventKeyEnter(keyEvent, state, dispatch, chunkEvent, parentEvent) : null; }}
		on-mouseenter={(mouseEvent) => {
			if (!viewSettings.multidayEventDragSettings) {
				updateTooltip(dispatch, mouseEvent.target, chunkEvent.id, getEventAriaLabel(state, chunkEvent));
			}
		}}
		draggable={allowMove + ''}
		on-dragstart={allowMove ? (mouseEvent) => onMultiDayEventDragStart(mouseEvent, chunkEvent, viewSettings, state, dispatch) : null}
		on-dragend={allowMove ? (mouseEvent) => onMultiDayEventDragEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch) : null}>
		<div
			className={`resize-multiday-event multiday-event-start ${showStartResizeClass}`}
			draggable={allowResize ? 'true' : 'false'}
			on-dragstart={allowResize ? (mouseEvent) => onResizeMultidayEventStart(mouseEvent, chunkEvent, viewSettings, state, dispatch, POSITION.START, eventRef) : null}
			on-dragend={allowResize ? (mouseEvent) => onResizeMultidayEventEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch) : null}>
		</div>
		<div className={`${showStartEventArrow(startMoment.valueOf(), chunkEvent, parentEvent)} multiday-event-arrow start-event-arrow`}>
			{getArrowHTML(state, 'start')}
		</div>
		<div className='event-template-container'>
			{templateRenderer.multidayEventContainer({ ...parentEvent, ...chunkEvent }, props)}
		</div>
		<div className={`${showEndEventArrow(endMoment.valueOf(), chunkEvent, parentEvent)} multiday-event-arrow end-event-arrow`}>
			{getArrowHTML(state, 'end')}
		</div>
		<div className={`resize-multiday-event multiday-event-end ${showEndResizeClass}`}
			draggable={allowResize  ? 'true' : 'false'}
			on-dragstart={allowResize ? (mouseEvent) => onResizeMultidayEventStart(mouseEvent, chunkEvent, viewSettings, state, dispatch, POSITION.END, eventRef) : null}
			on-dragend={allowResize ? (mouseEvent) => onResizeMultidayEventEnd(mouseEvent, chunkEvent, viewSettings, state, dispatch) : null}>
		</div>
	</div>);
}

function getTemporaryMultidayEvent(state, chunkEvent, viewSettings, templateRenderer, temporaryEventSettings) {
	const {properties: props} = state;
	let cls = temporaryEventSettings.type === ACTIONS.DRAG_END_NEW_EVENT || temporaryEventSettings.type === ACTIONS.GRID_CLICKED_NEW_EVENT ? ['event', 'temp-drag-new-event'] : ['temp-drag-event'];
	let styles = {};

	if (temporaryEventSettings.type === ACTIONS.DRAG_END_NEW_EVENT || temporaryEventSettings.type === ACTIONS.GRID_CLICKED_NEW_EVENT)
		styles = getTempNewEventStyles(chunkEvent, state, viewSettings);
	else
		styles = getTempEventStyles(chunkEvent, state, viewSettings);
	return (<div className={cls.join(' ')}
		style={styles}
		attrs={{eid: chunkEvent.id, chunkidx: chunkEvent.id}}
		><div className='event-template-container'>
			{
				temporaryEventSettings.type === ACTIONS.DRAG_END_NEW_EVENT || temporaryEventSettings.type === ACTIONS.GRID_CLICKED_NEW_EVENT ? templateRenderer.multidayEventContainer({ ...chunkEvent }, props) : ''
			}
		</div>
	</div>);
}

function getTemporaryEventHtml(viewSettings, templateRenderer, state) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings || temporaryEventSettings.eventState === EVENT_STATES.ONDRAGSTART || !temporaryEventSettings.multidayTempEvent )
		return '';

	let tempEventHtml = getTemporaryMultidayEvent(state, temporaryEventSettings.multidayTempEvent, viewSettings, templateRenderer, temporaryEventSettings);
	return tempEventHtml;
}

export function getMultidayEvents(viewSettings, templateRenderer, multiDayChunkEvents, state, dispatch) {
	const {properties: props} = state;
	let eventsHtml = [];
	let maxOverlappingEvents = 0;
	if (!props.splitMultiDayEvent) {
		if (multiDayChunkEvents && multiDayChunkEvents.length !== 0) {
			const overlaps = getOverlaps(multiDayChunkEvents, moment(state.startMoment), state.properties.timezone, viewSettings);

			const finalEvents = [];
			for (const o in overlaps) {
				let overlapEvents = overlaps[o];
				if (!overlapEvents || overlapEvents.length === 0)
					continue;

				let bestFit = getBestFitPosition(overlapEvents, true);
				if (bestFit.divisor > maxOverlappingEvents)
					maxOverlappingEvents = bestFit.divisor;

				finalEvents.push(...bestFit.events);
			}

			finalEvents.forEach(function (chunkEvent) {
				let cls = ['event', 'multiday-event-bar'];
				eventsHtml.push(getEventHtml(state, dispatch, chunkEvent, viewSettings, templateRenderer, cls));
			});
		}
	}
	return {
		eventsHtml,
		maxOverlappingEvents
	};
}


export function getMultidayEventsHtml(viewSettings, templateRenderer, multiDayChunkEvents, state, dispatch) {
	const {properties: {splitMultiDayEvent}, startMoment} = state;
	const {numberOfDays, todayCol} = viewSettings;
	const multiDayEventsConfig = getMultidayEventConfig();
	if (splitMultiDayEvent)
		return '';

	let multiDayEvents = getMultidayEvents(viewSettings, templateRenderer, multiDayChunkEvents, state, dispatch);
	multiDayEvents.maxOverlappingEvents = multiDayEvents.maxOverlappingEvents === 0 ? 1 : multiDayEvents.maxOverlappingEvents;
	let eventsWrapperHeight = multiDayEvents.maxOverlappingEvents * (multiDayEventsConfig.height + multiDayEventsConfig.gapBetweenEvents) + multiDayEventsConfig.gapBetweenEvents + multiDayEventsConfig.bottomPadding + 'px';
	viewSettings.multidayEventWrapperRef = createRef();

	const headerGridCols = [];

	for (let c = 0; c < numberOfDays; c++) {
		const colDate = moment(startMoment).add(c, 'days');
		const cls = ['item', 'grid'];
		let allowCreate = isCreateAllowed(state);

		if (todayCol !== undefined && todayCol === c)
			cls.push('today');

		if (getBlockSpanOnDate(state, colDate, true)) {
			cls.push('block');
			allowCreate = false;
		}

		let attributes = {};
		attributes['aria-label'] = moment(colDate).format(INTERNAL_FORMAT.ARIA_DATE_FORMAT);
		if (isCreateAllowed(state))
			attributes['tabindex'] = -1;

		headerGridCols.push(<div
				className={cls.join(' ')}
				attrs={attributes}
				on-click={allowCreate ? (mouseEvent) => createMultidayEventOnClick(mouseEvent, state, viewSettings, dispatch, getMousePositionDayTime) : null}
				draggable={allowCreate + ''}
				ondragstart={allowCreate ? (mouseEvent) => onMultidayGridDragStart(mouseEvent, state, viewSettings, dispatch) : null}
				ondragend={allowCreate ? (mouseEvent) => onMultidayGridDragEnd(mouseEvent, state, viewSettings, dispatch) : null}
				on-keypress={(e) => { (e.which === KEYS.ENTER &&  isCreateAllowed(state)) ? createMultidayEventOnClick(e, state, viewSettings, dispatch, getGridCellPositionDay) : null}}
				></div>);
	}

	return <div className="row event-container-row" ref={viewSettings.multidayEventWrapperRef}
		hook-update={() => onViewRender(viewSettings.multidayEventWrapperRef.current)}>
		<div className="item"/>
		<div className='item'>
			<div className="multi-day-events-wrapper" on-dragover={(mouseEvent) => {onMultiDayEventDrag(mouseEvent, viewSettings, state, dispatch)}}>
				<div className='multiday-event-grid'
					><div className="table">
						<div className="row" style={{height:eventsWrapperHeight}}>
							{headerGridCols}
						</div>
					</div>
				</div>
				<div className='content-area grid-area'>
					{multiDayEvents.eventsHtml}
					{getTemporaryEventHtml(viewSettings, templateRenderer, state)}
				</div>
				<div className='drag-image-container'/>
			</div>
		</div>
	</div>;
}

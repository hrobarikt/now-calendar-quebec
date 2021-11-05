import moment from 'moment-timezone';
import renderColumnViewHeader from './column-view-header';
import {renderColumnViewGrid, renderColumnViewScale} from './column-view-grid';
import {
	getCurrentDateFormats,
	getCurrentViewTemplateRenderer,
	getTimeFromStartOfDay,
	Log,
	setLocale,
	getProcessedMarkSpans,
	isMultiDayEvent,
	getEventsInDisplayRange,
	getChunks
} from '../../util';
import {renderColumnViewEvents, renderTemporaryEvent} from './column-view-events';
import {DIRECTION, ACTIONS, ROW_SPAN_HEIGHT_IN_PX} from '../../constants';
import {createRef} from '@servicenow/ui-renderer-snabbdom';
import {onDrawingAreaDragOver, onDrawingAreaDrop, onDrawingAreaDragLeave, onDrawingAreaDragEnter} from './column-event-handlers';
import {onViewRender} from './column-helper';
import {renderColumnViewMarkSpans} from './column-view-mark-spans';
import {updateContainerHeight} from '../../util/layoutUtil';
import {ChunkEvent} from "../../util/chunkEvent";
import {closePopover} from '../../event-handlers';
import { ColumnTemplateRenderer } from './column-template-renderer';
import { isValidStepGranularity } from './util'
function renderTodayHighlighter(viewSettings, state) {
	const {numberOfDays, todayCol} = viewSettings;
	const {properties: props} = state;
	let todayHighlighterStyles = {};
	todayHighlighterStyles.display = 'block';
	todayHighlighterStyles.width = ((1 / numberOfDays) * 100) + '%';
	todayHighlighterStyles[props.dir === DIRECTION.RTL ? 'marginRight' : 'marginLeft'] = ((todayCol / numberOfDays) * 100) + '%';
	return <div className="today-highlighter" style={todayHighlighterStyles}/>;
}

export function renderCurrentTime(viewSettings, state) {
	const {todayMoment} = state;
	const {todayCol, currentDateFormats} = viewSettings;
	if (todayCol !== undefined) {
		const secsPerDay = 86400;
		const currentTimeTop = (getTimeFromStartOfDay(todayMoment) / secsPerDay * 100) + '%';
		return (<div className="current-time" style={{top: currentTimeTop}}>
			<div className="time">{setLocale(todayMoment, state).format(currentDateFormats.timeFormat)}</div>
			<div className="line">
				{renderTodayHighlighter(viewSettings, state)}
			</div>
		</div>);
	}
	return '';
}

function populateCalculatedViewSettings(viewSettings, state) {
	const {startMoment, endMoment, todayMoment} = state;
	const {dateFormats} = viewSettings;
	viewSettings.currentDateFormats = getCurrentDateFormats(dateFormats, state);
	viewSettings.columnViewRef = createRef();
	viewSettings.stepSize = viewSettings.timeRowSpan;
	if(typeof viewSettings.splitRow === 'boolean' && viewSettings.splitRow)
		viewSettings.splitRow = 2;
	if(!Number.isInteger(viewSettings.splitRow))
		viewSettings.splitRow = 1;
	if(viewSettings.timeRowSpan % viewSettings.splitRow !== 0)
		viewSettings.splitRow = 1;
	if(viewSettings.splitRow > Math.floor(viewSettings.timeRowSpan / 4))
		viewSettings.splitRow = 1;
	if(viewSettings.splitRow > 1)
		viewSettings.stepSize = viewSettings.timeRowSpan / viewSettings.splitRow;
	if (isValidStepGranularity(viewSettings))
		viewSettings.stepSize = viewSettings.snapGranularity;
	viewSettings.scaleSizeInSecs = getTimeFromStartOfDay(endMoment) - getTimeFromStartOfDay(startMoment) + 1;
	if (todayMoment && !startMoment.isAfter(todayMoment) && !endMoment.isBefore(todayMoment))
		viewSettings.todayCol = moment(todayMoment).startOf('day').diff(startMoment, 'days');
}

function isValidViewSettings(viewSettings) {
	const {timeRowSpan, scaleSizeInSecs, stepSize} = viewSettings;
	return scaleSizeInSecs % (timeRowSpan * 60) === 0 // timeRowSpan should be proper divisor of scale size
		&& scaleSizeInSecs % (stepSize * 60) === 0; // stepSize should be proper divisor of scale size
}

function navigateToCurrentTime(elm, state, viewSettings) {
	const {todayMoment} = state;
	const {timeRowSpan} = viewSettings;
	/* 80 -> height of each cell, timeRowSpan -> units are minutes */
	const currentViewTop = (((getTimeFromStartOfDay(todayMoment, 'hours') * 60) / timeRowSpan) - 3) * 80;
	elm.scrollTop = currentViewTop;
}

export function processColumnViewEvents(state, viewSettings) {
	let columnViewChunks = [];
	let multiDayChunks = [];
	const viewEvents = getEventsInDisplayRange(state);
	if (viewEvents) {
		ChunkEvent.chunkIndex = 0;
		if (!state.properties.splitMultiDayEvent) {
			viewEvents.forEach((event) => {
				if (isMultiDayEvent(event))
					multiDayChunks.push(...getChunks(event, viewSettings.numberOfDays, state));
				else
					columnViewChunks.push(...getChunks(event, 1, state));
			});
		} else {
			viewEvents.forEach((event) => {
				columnViewChunks.push(...getChunks(event, 1, state));
			});
		}
	}
	return {
		columnViewChunks,
		multiDayChunks
	};
}

export default function renderColumnView(viewSettings, state, dispatch) {
	const {startMoment, endMoment, contextMoment} = state;

	if (!startMoment || !endMoment)
		return '';

	populateCalculatedViewSettings(viewSettings, state);

	let templateRenderer = getCurrentViewTemplateRenderer(state);
	if(!templateRenderer instanceof ColumnTemplateRenderer)
		templateRenderer = new ColumnTemplateRenderer();

	if (!isValidViewSettings(viewSettings)) {
		Log.error('Invalid column view settings provided: ', viewSettings);
		return '';
	}

	state.markSpanChunks = [];

	let processedEvents = {};

	/*
	 * Avoid rendering of events until date range is updated
	 */
	if (endMoment.diff(startMoment, 'days') === (viewSettings.numberOfDays - 1) && contextMoment.isBetween(startMoment, endMoment, null, "[]")) {
		processedEvents = processColumnViewEvents(state, viewSettings);
		state.markSpanChunks = getProcessedMarkSpans(state);
	}

	return (
		<div className="calendar-column-view">
			<div className="view-header">
				{renderColumnViewHeader(viewSettings, templateRenderer, processedEvents.multiDayChunks, state, dispatch)}
			</div>
			<div className="view-body"
				ref={viewSettings.columnViewRef}
				hook-insert={({elm}) => {
					updateContainerHeight(state, dispatch, elm);
					if (viewSettings.todayCol !== undefined)
						navigateToCurrentTime(elm, state, viewSettings)
				}}
				hook-update={(newVnode) => {
					onViewRender(viewSettings.columnViewRef.current);
					updateContainerHeight(state, dispatch, newVnode.elm);
				}}>
				<div className="wrapper-relative" on-wheel={(e) => closePopover(state, dispatch)}> {/* when view-body is made fixed height and scrollable, this wrapper helps to keep things in place */}
					<div className="time-scale-area">
						{renderColumnViewScale(viewSettings, state, dispatch)}
					</div>
					<div className="drawing-area" ondragover={(event) => {onDrawingAreaDragOver(event, viewSettings, state, dispatch);}}
						on-drop={(event) => {onDrawingAreaDrop(event, viewSettings, state, dispatch);}}
						on-dragleave={(event) => {onDrawingAreaDragLeave(event, viewSettings, state, dispatch);}}
						on-dragenter={(event) => {onDrawingAreaDragEnter(event, viewSettings, state, dispatch);}}>
						<div className="drawing-area-relative">
							<div className="grid-area">
								{renderColumnViewGrid(viewSettings, state, dispatch)}
							</div>
							<div
								hook-insert={({elm}) => {dispatch(ACTIONS.INTERNAL_STATE_SET, {popoverContainerEl: elm});}}
								className="content-area">
								<div className="mark-events-container">
									{renderColumnViewMarkSpans(viewSettings, state, dispatch)}
								</div>
								<div className="event-container">
									{renderColumnViewEvents(viewSettings, templateRenderer, processedEvents.columnViewChunks, state, dispatch)}
								</div>
								<div className="temporary-event-container">
									{renderTemporaryEvent(viewSettings, templateRenderer, state, dispatch)}
								</div>
							</div>
							{renderCurrentTime(viewSettings, state)}
							<div className='drag-image-container'/>
						</div>
					</div>
				</div>
			</div>
		</div>);
}

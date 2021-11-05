import {renderMonthViewGrid,getHeaderColumns} from './month-view-grid';
import renderMonthViewEvents, {getEventBuckets} from './month-view-events';
import { onEventDragOver, onEventDrop, onDragLeave, onDragEnter, MONTH_EVENT_CLASSES } from './month-event-handlers';
import {createRef} from '@seismic/snabbdom-renderer';
import {getCurrentViewTemplateRenderer, getProcessedMarkSpans, getCurrentViewSettings} from '../../util';
import {ACTIONS} from '../../constants';
import {updateContainerHeight} from '../../util/layoutUtil';
import moment from 'moment-timezone';
import { MonthTemplateRenderer } from './month-template-renderer';

const defaultHeight = 135;

function updateLayout(newNode, state, dispatch) {
	const {startMoment, endMoment, mvVwHt} = state;
	const numberOfDays = moment(endMoment).diff(moment(startMoment), 'days') + 1;
	const rows = numberOfDays / 7;
	
	const newHeight = Math.max(defaultHeight * rows, newNode.elm.getBoundingClientRect().height);
	if (mvVwHt !== newHeight) {
		dispatch(ACTIONS.INTERNAL_STATE_SET, {mvVwHt: newHeight});
	}
}

function updateRowHeights (monthViewConfig, state, eventBuckets) {
	const {startMoment, endMoment, mvVwHt, properties: props} = state;
	const viewSetting = getCurrentViewSettings(state);
	const numberOfDays = moment(endMoment).diff(moment(startMoment), 'days') + 1;
	const rows = numberOfDays / 7;
	let maxNumberOfEventAllowed = monthViewConfig.maxNumberOfEventAllowed;

	if (viewSetting.hideAgendaView && Object.keys(eventBuckets).length > 0) {
		for (let bucketKey in eventBuckets) {
			if (eventBuckets.hasOwnProperty(bucketKey)) {
				let row = bucketKey.split("_")[0];
				let cellHeight = monthViewConfig.cellHeaderHeight + (monthViewConfig.gapBetweenBars + monthViewConfig.barHeight) * eventBuckets[bucketKey].length + monthViewConfig.bottomSpace;
				if (monthViewConfig.rowHeights[row] < cellHeight) {
					maxNumberOfEventAllowed = eventBuckets[bucketKey].length;
					monthViewConfig.rowHeights[row] = cellHeight;
				}
			}
		}
	}
	if (mvVwHt) {
		for (let index = 0; index < rows; index++) {
			let minHeight = defaultHeight;
			if (mvVwHt) {
				if (index === rows - 1)
					minHeight = Math.floor(mvVwHt / rows) + Math.floor(mvVwHt) % rows;
				else
					minHeight = Math.floor(mvVwHt / rows);
			}
			monthViewConfig.rowHeights[index] = viewSetting.hideAgendaView ? Math.max(minHeight, monthViewConfig.rowHeights[index]) : minHeight;
		}
	}

	// Update max  number of events to rendered in a cell
	if (viewSetting.hideAgendaView)
		monthViewConfig.maxNumberOfEventAllowed = maxNumberOfEventAllowed;
	else {
		let maxNumberOfEventAllowed = 0;
		let rowHeight = monthViewConfig.rowHeights[0];
		let eventAreaHeight = monthViewConfig.barHeight + monthViewConfig.gapBetweenBars;
		rowHeight -= monthViewConfig.cellHeaderHeight + monthViewConfig.bottomSpace + eventAreaHeight;
		while(rowHeight > eventAreaHeight) {
			maxNumberOfEventAllowed++;
			rowHeight -= eventAreaHeight;
		}
		monthViewConfig.maxNumberOfEventAllowed = maxNumberOfEventAllowed;
	}
}

export default function renderMonthView({}, state, dispatch) { // eslint-disable-line no-empty-pattern
	const {properties: props, startMoment, endMoment, contextMoment} = state;

	if (!startMoment || !endMoment)
		return '';

	const monthViewContainerRef = createRef();
	let templateRenderer = getCurrentViewTemplateRenderer(state);
	if(!templateRenderer instanceof MonthTemplateRenderer)
		templateRenderer = new MonthTemplateRenderer();

	const monthViewConfig = {
		cellHeaderHeight: 34,
		gridHeaderRowHeight: 0,
		barHeight: 20,
		gapBetweenBars: 2,
		paddingLeft: 1,
		paddingRight: 0,
		bottomSpace: 12,
		rowHeights: [defaultHeight, defaultHeight, defaultHeight, defaultHeight, defaultHeight, defaultHeight],
		maxNumberOfEventAllowed: 4,
		monthViewContainerRef
	};

	let eventBuckets = {};
	state.markSpanChunks = [];

	const headerColumns = getHeaderColumns(state);

	/*
	 * Avoid rendering of events until date range is updated
	 */
	const numberOfWeeks = (endMoment.diff(startMoment, 'days') + 1) / 7;
	const dateRangeUpdated = [4, 5, 6].includes(numberOfWeeks) && contextMoment.isBetween(startMoment, endMoment, null, "[]");
	if (dateRangeUpdated) {
		eventBuckets = getEventBuckets(state.dataProvider.getAllEvents(), state, monthViewConfig);
		state.markSpanChunks = getProcessedMarkSpans(state, 1);
	}

	if (state.mvVwHt)
		updateRowHeights(monthViewConfig, state, eventBuckets);

	return <div className="calendar-month-view"
		ref={monthViewContainerRef}
		on-dragover={(mouseEvent) => onEventDragOver(mouseEvent, state, dispatch, monthViewConfig)}
		on-drop={(mouseEvent) => onEventDrop(mouseEvent, state, dispatch, monthViewConfig)}
		on-dragleave={(mouseEvent) => {onDragLeave(mouseEvent, state, dispatch);}}
		on-dragenter={(mouseEvent) => {onDragEnter(mouseEvent, state, dispatch);}}
	>
		<div className="view-header">
			<div className="grid-header-wrapper">
				<div className="grid-header">
					<div className="grid-header-row">
						{headerColumns}
					</div>
				</div>
			</div>
		</div>
		<div className="view-body" hook-update={(newVnode) => {
			if (dateRangeUpdated) {
				updateContainerHeight(state, dispatch, newVnode.elm);
				updateLayout(newVnode, state, dispatch);
			}
		}}>
			<div className="wrapper-relative">
				{renderMonthViewGrid(state, dispatch, monthViewConfig)}
				<div
					hook-insert={({elm}) => {dispatch(ACTIONS.INTERNAL_STATE_SET, {popoverContainerEl: elm});}}
					className="content-area">
					{renderMonthViewEvents(eventBuckets, state, dispatch, monthViewConfig, templateRenderer)}
				</div>
				<div className={MONTH_EVENT_CLASSES.DRAG_IMG_CONTAINER}></div>
			</div>
		</div>
	</div>;
}

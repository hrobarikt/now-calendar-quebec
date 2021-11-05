/// @ts-check
import moment from 'moment-timezone';
import { DIRECTION, VIEWS } from '../../constants';

/**
 *
 * @param {string | number} val  - value to be parsed
 * @param {number=} defaultValue  - default value if it is  not a number | string
 * @param {number=} minVaule - minimum value for this number
 * @param {number=} maxValue - maximum value for this number
 */
export function tryParse(val, defaultValue = 0, minVaule = Number.MIN_VALUE, maxValue = Number.MAX_VALUE) {
	if (val === void 0)
		return defaultValue;

	if (typeof val === 'string') {
		var tempVal = parseInt(val);
		if (isNaN(tempVal))
			return defaultValue;
		val = tempVal;
	}

	if (typeof val !== 'number')
		return defaultValue;
	if (arguments.length < 2)
		return val;

	val = Math.max(minVaule, val);
	val = Math.min(maxValue, val);
	return val;
}

export const TOTAL_MINUTES_PER_DAY = 24 * 60;
export const MINIMUM_INTERVAL = 15;
export const MINIMUM_SLOTS = 1;
export const MAXIMUM_SLOTS = TOTAL_MINUTES_PER_DAY / MINIMUM_INTERVAL;
export const MINIMUM_EVENT_HEIGHT = 20;
export const MINIMUM_EVENT_WIDTH = 22;
export const MAXIMIM_EVENT_HEIGHT = 100;
export const NO_EVENT_ROW_HEIGHT = 50;

export const MINIMUM_TITLE_WIDTH = 240;
export const MAXIMUM_TITLE_WIDTH = 240;
export const MINIMUM_TIMELINE_WIDTH = 800;
export const MINIMUM_SIZE = 9 * 4; // 9 hours with a span of 15 minutes each
export const MAXIMUM_SIZE = 24 * 4; // 24 hours with a span of 15 minutes each
export const MAXIMUM_INTERVAL = MINIMUM_INTERVAL * 4; // 1 hour each
export const DEFAULT_HEADER_HEIGHT = 40;
export const DAY_VIEW_CELL_WIDTH = 70;
export const WEEK_VIEW_CELL_WIDTH = 240;
export const DEFAULT_SECTION_KEY = 'other';
export const LEVEL_INTENDATION = 16;
export const TEMP_EVENT_Z_INDEX = 2;
export const TEMPLATE_NAMES = ["mainGrid", "timeScaleGrid", "sectionHeadTitle", "sectionHeadBody", "rowTitle", "rowBody", "eventBody"];
export const CURRENT_TRANSCATION_EVENT_OPACITY = '0.6';
export const TimelineUnits = {
	milliseconds: 'milliseconds',
	minutes: 'minutes',
	hours: 'hours',
	days: 'days',
	weeks: 'weeks',
	months: 'months',
	years: 'years'
};
export const TimelineStartOfUnits = {
	minutes: 'day',
	hours: 'day',
	days: 'day',
	weeks: 'week',
	months: 'month',
	years: 'year'
};


export class TimelineUtils {
	/**
	 *
	 * @param {moment.Moment} momentDate
	 * @param {import('../../..').TimelineConfig} viewConfig
	*/
	static getContextStartTime(momentDate, viewConfig) {
		const unitName = TimelineStartOfUnits[viewConfig.xUnitName];
		return momentDate.clone().startOf(/** @type {moment.unitOfTime.StartOf} */(unitName));
	}
	/**
	 *
	 * @param {moment.Moment} momentDate
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getContextEndTime(momentDate, viewConfig) {
		const unitName = TimelineStartOfUnits[viewConfig.xUnitName];
		let startTime = TimelineUtils.getContextStartTime(momentDate, viewConfig);
		return startTime.endOf(/**@type {moment.unitOfTime.StartOf} */(unitName));
	}
	/**
	 *
	 * @param {moment.Moment} momentDate
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getViewStartTime(momentDate, viewConfig) {
		let viewStartTime = TimelineUtils.getContextStartTime(momentDate, viewConfig).add(viewConfig.xStart * viewConfig.xStep, viewConfig.xUnitName);
		return viewStartTime;
	}
	/**
	 *
	 * @param {moment.Moment} momentDate
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getViewEndTime(momentDate, viewConfig) {
		let viewEndTime = TimelineUtils.getViewStartTime(momentDate, viewConfig);
		viewEndTime.add(viewConfig.xSize * viewConfig.xStep, viewConfig.xUnitName);
		///@ts-ignore
		viewEndTime.add(-1, TimelineUnits.milliseconds);
		return viewEndTime;
	}

	/**
	 *
	 * @param {moment.Moment} momentDate
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getRenderViewDates(momentDate, viewConfig) {
		let startTime = TimelineUtils.getViewStartTime(momentDate, viewConfig);
		/**
		 * @type Array<{start: moment.Moment, end: moment.Moment}>
		 */

		let renderingTimes = [];
		for (let i = 0; i < viewConfig.xSize; i++) {
			const stepEnd = startTime.clone().add(viewConfig.xStep, viewConfig.xUnitName).subtract(1, 'ms');
			renderingTimes.push({
				start: startTime,
				end: stepEnd
			});
			startTime = startTime.clone().add(viewConfig.xStep, viewConfig.xUnitName);
		}
		return renderingTimes;
	}
	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	*/
	static getCellWidth(viewConfig) {
		if (viewConfig.noScrolling)
			return Math.floor(viewConfig.eventAreaClientWidth / viewConfig.xSize);
		let cellWidth = DAY_VIEW_CELL_WIDTH;
		if (viewConfig.viewName === VIEWS.TIMELINE_WEEK)
			cellWidth = WEEK_VIEW_CELL_WIDTH;
		if ((viewConfig.xSize * cellWidth) < viewConfig.eventAreaClientWidth)
			cellWidth = Math.floor(viewConfig.eventAreaClientWidth / viewConfig.xSize);
		return cellWidth;
	}

	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	*/
	static getEventLineWidth(viewConfig) {
		return viewConfig.xSize * TimelineUtils.getCellWidth(viewConfig);
	}
	/**
	 * @param {number} posX
	 * @param {number} totalWidth
	 * @param {Readonly<moment.Moment>} startTime
	 * @param {Readonly<moment.Moment>} endTime
	 */
	static posXToMomentTime(posX, totalWidth, startTime, endTime) {
		const diffFactor = posX * (endTime.tzValueOf() - startTime.tzValueOf()) / Math.max(1, totalWidth);
		/// @ts-ignore
		return startTime.clone().add(Math.ceil(diffFactor), TimelineUnits.milliseconds);
	}

	/**
	 *
	 * @param {Function} func
	 * @param {number} wait
	 * @param {boolean} immediate
	 */
	static debounceWithCancel(func, wait, immediate) {

		let timeout = -1;
		return {
			run: function () {
				var context = this, args = arguments;
				var later = function () {
					timeout = null;
					if (!immediate) func.apply(context, args);
				};
				var callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = window.setTimeout(later, wait);
				if (callNow) func.apply(context, args);
			},
			cancel: function () {
				if (timeout != -1)
					window.clearTimeout(timeout);
				timeout = -1;
			}
		};
	}

	/**
	 *
	 * @param {Function} func
	 * @param {number} wait
	 * @param {boolean} immediate
	 */
	static debounce(func, wait, immediate) {
		var timeout;
		return function () {
			var context = this, args = arguments;
			var later = function () {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	}
	static getNextLayoutTime() {
		return Date.now() + 30; // 100 milliseconds to run the timer
	}
	/**
	 *
	 * @param {string} rowId
	 * @param {import('../../..').CalendarState} state
	 */
	static getEventRowById(rowId, state) {
		const { timelineView } = state;
		if (timelineView && timelineView.rowMap)
			return timelineView.rowMap.get(rowId);

		return null;
	}
	/**
	 *
	 * @param {string} direction
	 * @param {string} rowId
	 * @param {import('../../..').CalendarState} state
	 * @param {import('../../..').appDispatch} dispatch
	 */
	static getNextActiveCellPos(direction, rowId, state, dispatch) {
		const { timelineView } = state;
		const { viewConfig } = timelineView;
		let row = TimelineUtils.getEventRowById(rowId, state);
		if (row)
			return row.getNextActiveCell(direction, viewConfig);

		return -1;
	}
	/**
	 *
	 * @param {string} rowId
	 * @param {import('../../..').CalendarState} state
	 * @param {import('../../..').appDispatch} dispatch
	 */
	static getPreviousRowId(rowId, cellPos, state, dispatch) {
		let row = TimelineUtils.getEventRowById(rowId, state);
		if (row) {
			let previousRow = row.getPreviousRow();
			if (previousRow) {
				previousRow.setActiveCell(cellPos);
				return previousRow.id;
			}
		}
		return null;
	}
	/**
	*
	* @param {string} rowId
	* @param {import('../../..').CalendarState} state
	* @param {import('../../..').appDispatch} dispatch
	*/
	static getNextRowId(rowId, cellPos, state, dispatch) {
		let row = TimelineUtils.getEventRowById(rowId, state);
		if (row) {
			let nextRow = row.getNextRow();
			if (nextRow) {
				nextRow.setActiveCell(cellPos);
				return nextRow.id;
			}
		}
		return null;
	}
	/**
	 *
	 * @param {import('../../..').CalendarState} state
	 * @param {import('../../..').appDispatch} dispatch
	 * @param {string} rowId
	 * @param {number} cellPos
	 */
	static updateActiveCell(state, dispatch, rowId, cellPos) {
		let row = TimelineUtils.getEventRowById(rowId, state);
		if (row)
			row.setActiveCell(cellPos);
	}
	/**
	 *
	 * @param {import('../../..').CalendarState} state
	 * @param {HTMLElement} rowEl
	 * @param {number} clientX
	 */
	static getActiveCellPosFromX(state, rowEl, clientX) {
		if (!rowEl)
			return -1;

		const { timelineView, properties: props } = state;
		const { viewConfig } = timelineView;
		const rowRect = rowEl.getBoundingClientRect();
		let mousePosX = clientX - rowRect.left;
		if (props.dir === DIRECTION.RTL)
			mousePosX = rowRect.width - mousePosX;

		mousePosX = Math.min(mousePosX, rowRect.width);
		mousePosX = Math.max(mousePosX, 0);
		let cellPos = Math.floor(mousePosX / TimelineUtils.getCellWidth(viewConfig));
		if (cellPos === viewConfig.xSize)
			cellPos--;

		return cellPos;
	}

	/**
	 *
	 * @param {number} tzViewStartMS
	 * @param {number} tzViewEndMS
	 * @param {import('../..').CalendarEvent} rawEvent
	 */
	static getPercentageValues(tzViewStartMS, tzViewEndMS, rawEvent) {
		let posX = ((rawEvent.startMS + rawEvent.startUTCOffsetMS) - tzViewStartMS) * 100 / Math.max(1, (tzViewEndMS - tzViewStartMS));
		let width = ((rawEvent.endMS + rawEvent.endUTCOffsetMS) - (rawEvent.startMS + rawEvent.startUTCOffsetMS)) * 100 / Math.max(1, (tzViewEndMS - tzViewStartMS));
		return { posX, width };
	}

	/**
	 *
	 * @param {number} tzViewStartMS
	 * @param {number} tzViewEndMS
	 * @param {import('./event-row-view').TimelineEvent} timelineEvent 
	 */
	static getPercentageValuesInViewRange(tzViewStartMS, tzViewEndMS, timelineEvent) {
		const obj = this.getPercentageValues(tzViewStartMS, tzViewEndMS, timelineEvent.rawEvent);
		if (obj.posX < 0) {
			obj.width = obj.width + obj.posX;
			obj.posX = 0;
		}
		obj.width = Math.min(obj.width, 100 - obj.posX);
		return obj;
	}
	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	*/
	static getXStepInMinutes(viewConfig) {
		if(viewConfig.viewName === VIEWS.TIMELINE_WEEK)
			return viewConfig.xStep * 24 * 60; // day => minutes
		return viewConfig.xStep;
	}
	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getSnapCellWidth(viewConfig) {
		const cellWidth = TimelineUtils.getCellWidth(viewConfig);
		if(!TimelineUtils.isValidSnapGranularity(viewConfig))
			return cellWidth;
		let snapCellWidth = cellWidth;
		const xStepInMs = TimelineUtils.getXStepInMinutes(viewConfig);
		let snapGranularity = Math.floor(Math.min(xStepInMs, viewConfig.snapGranularity));
		snapCellWidth = snapGranularity * cellWidth / xStepInMs;
		return snapCellWidth;
	}
	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static isValidSnapGranularity(viewConfig) {
		return Number.isInteger(viewConfig.snapGranularity) && viewConfig.snapGranularity > 0
	}

	/**
	 * 
	 * @param {import('../../..').CalendarState} state 
	 * @param {number} posX 
	 * @param { import('../../..').TimelineConfig } viewConfig
	 * @param {number} duration
	 */
	static getPosXFromMouseX(state, viewConfig, posX, duration) {
		const diff = state.tzViewEndMS - state.tzViewStartMS;
		const lineWidth = TimelineUtils.getEventLineWidth(viewConfig);
		const x = posX * 100 / lineWidth;
		const width = duration * 100/ diff;
		return {x, width};
	}
	/**
	 * 
	 * @param {import('../../..').CalendarState} state 
	 * @param {import('../../..').TimelineConfig} viewConfig 
	 * @param {import('../../..').Moment} momentObj 
	 */
	static getPosXFromMoment(state, viewConfig, momentObj) {
		const diff = state.tzViewEndMS - state.tzViewStartMS;
		const lineWidth = TimelineUtils.getEventLineWidth(viewConfig);
		const tzValue = momentObj.tzValueOf();
		return (tzValue - state.tzViewStartMS) * lineWidth/diff;
	}
	/**
	 * 
	 * @param {import('../../..').RawSectionItem} sec 
	 * @param {string} id
	 * @returns {import('../../..').RawSectionItem}
	 */
	static findSection(sec, id) {
		if (sec.id === id)
			return sec;
		if (Array.isArray(sec.children)) {
			for (let i = 0; i < sec.children.length; i++) {
				let sec1 = this.findSection(sec.children[i], id);
				if (sec1)
					return sec1;
			}
		}
	}
	/**
	 * 
	 * @param {string} id 
	 */
	static getId(id) {
		return id.replace(/ /g, '_');
	}
	/**
	 * @param {string} id
	 */
	static getSectionTitleId(id) {
		return `section_title_` + TimelineUtils.getId(id);
	}
	/**
	 * 
	 * @param {string} id 
	 */
	static getRowId(id) {
		return `event_row_${id}`;
	}
	/**
	 * @param {string} id
	 */
	static getRowTitleId(id) {
		return `event_row_title_${TimelineUtils.getId(id)}`;
	}
	/**
	 *
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	static getCellWidthInPercentage(viewConfig) {
		return 100 * TimelineUtils.getCellWidth(viewConfig) / TimelineUtils.getEventLineWidth(viewConfig)
	}
}

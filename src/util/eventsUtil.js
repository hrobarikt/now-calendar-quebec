import moment from 'moment-timezone';
import {getTimeFromStartOfDay, getTimeDiff, str2Moment, getDaysCountBetweenDates, anyToMoment, msToFormat} from './dateTimeUtil';
import {ACTIONS, EVENT_TYPES, INTERNAL_FORMAT, POPOVERS, POPOVER_STATE} from "../constants";
import cloneDeep from 'lodash/cloneDeep';
import {DEFAULT_SECTION_KEY} from '../body-views/timeline/utils';
import {ChunkEvent} from "./chunkEvent";
import {t} from 'sn-translate';
import { closePopover } from "../event-handlers";

export function getBestFitPosition(events, expandEvents) {
	if (!events || events.length == 0)
		return {};

	let root = new Tree();
	return root._getBestFitPosition(events, expandEvents);
}

export function getOverlaps(payload, startMoment, timezone, viewSettings) {
	if (!payload)
		return {};

	let nodes = getNodes(payload, startMoment, timezone, viewSettings);
	let root = new Tree();
	return root._getOverlaps(nodes);
}

function getNodes(payload, startMoment, timezone, viewSettings) {
	return payload.map(el => {
		let node = {};

		if (startMoment) {
			node.start = getTimeDiff(startMoment, anyToMoment(el.startMS, {timezone}).startOf('day'));
			node.end = getTimeDiff(startMoment, anyToMoment(el.endMS, {timezone}).endOf('day'));
		} else {
			node.start = getTimeFromStartOfDay(anyToMoment(el.startMS, {timezone}));
			node.actualEnd = getTimeFromStartOfDay(anyToMoment(el.endMS, {timezone}));
			node.end =  getEndOfShortEvent(node.start, node.actualEnd, viewSettings);
		}

		node.data = el;
		// Adding start and end time in seconds to event to avoid re-calculation
		el.startSec = node.start;
		el.endSec = node.end;
		el.actualEndSec = node.actualEnd;
		return node;
	});
}

export function getEndOfShortEvent(startSec, endSec, viewSettings) {
	const durationInSeconds= endSec - startSec;
	const durationInMinutes = durationInSeconds / 60;

	if (viewSettings && viewSettings.stepSize && durationInMinutes < viewSettings.stepSize) {
		endSec += (viewSettings.stepSize * 60) - durationInSeconds;
	}

	return endSec;
}

class Interval {
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}
}

class TreeNode {
	constructor(node) {
		this.interval = new Interval(node.start, node.end);
		this.data = node.data;
		this.max = node.max ? node.max : 0;
		this.left = null;
		this.right = null;
		this.position = node.position ? node.position : 0;
	}
}

/**
 * Interval tree
 */
class Tree {
	constructor() {
		this.root = null;
	}

	insert(newnode) {
		return this._insert(this.root, newnode);
	}

	_insert(root, newnode) {
		if (!root)
			return new TreeNode(newnode);

		if (newnode.start < root.interval.start)
			root.left = this._insert(root.left, newnode);
		else
			root.right = this._insert(root.right, newnode);

		if (root.max < newnode.end)
			root.max = newnode.end;

		return root;
	}

	_isOverlapping(a, b) {
		if (a.start < b.end && b.start < a.end)
			return true;

		if (a.start == b.start || a.end == b.end)
			return true;

		return false;
	}

	overlapSearch(interval) {
		return this._overlapSearch(this.root, interval);
	}

	_overlapSearch(node, interval) {
		if (!node)
			return null;

		if (this._isOverlapping(node.interval, interval))
			return node;

		if (node.left && node.left.max >= interval.start)
			return this._overlapSearch(node.left, interval);

		return this._overlapSearch(node.right, interval);
	}

	/**
	 * Input: Array of tree nodes
	 * Ouput: Object {
	 *                  overlaps: [[],[],[]..] // each array contains events having transitive property for overlapping
	 *              }
	 */
	_getOverlaps(nodes) {
		if (!nodes || nodes.length === 0)
			return {};

		nodes.sort((e1, e2) => (e1.start - e2.start));
		this.root = this.insert(nodes[0]);
		let overlappingIntervals = [];
		let set = new Set();
		set.add(nodes[0].data);
		for (let i = 1; i < nodes.length; i++) {
			let resNode = this.overlapSearch(new Interval(nodes[i].start, nodes[i].end));
			if (resNode) {
				set.add(nodes[i].data);
				set.add(resNode.data);
			} else {
				//push all overlapping intervals so far
				overlappingIntervals.push([...set]);
				//non-overlapping interval found, discard previous tree at this point
				this.root = null;
				set.clear();
				set.add(nodes[i].data);
			}
			this.root = this.insert(nodes[i]);
		}
		//push remaining intervals
		if (set.size > 0)
			overlappingIntervals.push([...set]);

		return overlappingIntervals;
	}

	/**
	 * Input: Array of overlapping events
	 * Output: Object {
	 * 			divisor: <>
	 * 			events: [{...event, startPosition: 0, endPosition: 2}, ....]
	 * 		}
	 * where:
	 *        divisor:    <integer> (divide column width by this number to get event width)
	 *        position:    <integer> (0 based index to position event in a column and incrementing along x-axis)
	 */
	_getBestFitPosition(events, expand) {
		let maxPositionSoFar = 0;
		let result = {};
		result.events = [];
		let nodeMap = [];	//index i stores root node of ith position
		//initialize first event as root
		events[0].startPosition = 0;
		this.root = this._insertFit(nodeMap, this.root, new TreeNode({
			data: events[0],
			start: events[0].startSec,
			end: events[0].endSec - 1,
			max: events[0].endSec - 1
		}));
		result.events.push(events[0]);
		for (let i = 1; i < events.length; i++) {
			this._insertFit(nodeMap, this.root, new TreeNode({
				data: events[i],
				start: events[i].startSec,
				end: events[i].endSec - 1,
				max: events[i].endSec - 1
			}));
			result.events.push(events[i]);
			if (maxPositionSoFar < events[i].startPosition)
				maxPositionSoFar = events[i].startPosition;
		}
		result.divisor = maxPositionSoFar + 1;
		if (expand) {
			this.expandPositions(this.root, nodeMap);
		}
		return result;
	}

	_insertFit(nodeMap, root, newnode) {
		if (!root) {
			newnode.data.startPosition = newnode.data.endPosition = newnode.position;
			if (!nodeMap[newnode.position])
				nodeMap[newnode.position] = newnode;

			return newnode;
		}
		if (root.max < newnode.interval.start) {
			root.max = newnode.interval.end;
			newnode.position = root.position;
			root.left = this._insertFit(nodeMap, root.left, newnode);
		} else {
			newnode.position = root.position + 1;
			root.right = this._insertFit(nodeMap, root.right, newnode);
		}
		return root;
	}

	expandPositions(root, nodeMap) {
		if (!root)
			return;

		this._expandPositions(root, nodeMap);
		this.expandPositions(root.left, nodeMap);
		this.expandPositions(root.right, nodeMap);
	}

	/**
	 * Find maximum endPosition to the right until which an event can be expanded
	 */
	_expandPositions(root, nodeMap) {
		let nextRoot = nodeMap[root.data.startPosition + 1];
		while (nextRoot) {
			if (this._isOverlapping(root.interval, nextRoot.interval))
				break;

			if (!nextRoot.left) {
				root.data.endPosition += 1;
				nextRoot = nodeMap[root.data.endPosition + 1];
			} else {
				nextRoot = nextRoot.left;
			}
		}
	}
}

/**
 *
 * @param {CalendarEvent} event
 */
export function isMultiDayEvent(event) {
	const {startMS, endMS} = event;
	return (endMS - startMS) >= 86399999; //(24 * 60 * 60 * 1000 - 1);
}

/**
 * @return {Array<CalendarEvent>}
 */
export function getEventsInDisplayRange(state) {
	if (!state.dataProvider.eventStore || !state.startMoment || !state.endMoment)
		return [];

	return state.dataProvider.getEventsBetween(state.startMoment.valueOf(), state.endMoment.valueOf());
}

export function getChunks(e, chunkSpan = 1, state) {
	let chunkedEvents = [];
	let limitStartMS = e.startMS;
	let limitEndMS = e.endMS;
	let startMS = state.startMoment.valueOf();
	let endMS = state.endMoment.valueOf();
	// limit event start date to the start of display range
	if (limitStartMS < startMS)
		limitStartMS = startMS;

	// limit event end date to the end of display range
	if (limitEndMS > endMS)
		limitEndMS = endMS;

	if (limitStartMS > limitEndMS)
		return [];

	const daysSpan = getDaysCountBetweenDates(limitEndMS, limitStartMS, state.properties.timezone);
	chunkedEvents.push(...getChunksByLimits(e, limitStartMS, limitEndMS, daysSpan, chunkSpan, state));
	e.chunksLength = chunkedEvents.length;
	return chunkedEvents;
}

function getBoundaryDate(date, numberOfDays, state) {
	const {startMoment} = state;
	const resultDate = moment(startMoment);
	do {
		resultDate.add(numberOfDays, 'days');
	} while(resultDate.valueOf() - 1 <= date.valueOf());
	return resultDate.add(-1, 'ms'); // adjust to end of day;
}

function getChunksByLimits(event, limitStartMS, limitEndMS, daysSpan, numberOfDays, state) {
	const {properties: {timezone}} = state;
	let chunks = [];
	let limitStart = anyToMoment(limitStartMS, state.properties);
	let limitEnd = anyToMoment(limitEndMS, state.properties);
	while (daysSpan >= 0) {
		let boundaryEndMoment = getBoundaryDate(limitStart, numberOfDays, state);
		let nextDate;
		if (limitEnd.isSameOrBefore(boundaryEndMoment))
			nextDate = limitEnd;
		else
			nextDate = boundaryEndMoment;
		let chunkLength = moment(nextDate).startOf('day').diff(moment(limitStart).startOf('day'), 'days') + 1;
		daysSpan = daysSpan -  chunkLength;
		chunks.push(new ChunkEvent({
			eventId: event.id,
			startMS: limitStart.valueOf(),
			endMS: nextDate.valueOf()
		}, timezone));
		limitStart.add(chunkLength, 'days').startOf('day');
	}
	return chunks;
}


/**
 *
 * @param state
 * @param id
 * @return {CalendarEvent}
 */
export function getEventById(state, id) {
	return state.dataProvider.getEventById(id);
}

export function getDayEventsMap(events, state) {
	if (!events || !state)
		return {};

	let dayEventsMap = {};
	events.forEach((e) => {
		let key = getDaysCountBetweenDates(e.startMS, state.startMoment.valueOf(), state.properties.timezone);
		if (dayEventsMap[key])
			dayEventsMap[key].push(e);
		else
			dayEventsMap[key] = [e];
	});
	return dayEventsMap;
}

export function isPopoverOpen(state) {
	return !!(state.popOvers && Object.keys(state.popOvers).filter(key => !!state.popOvers[key]).length);
}
/**
 * 
 * @param {import('../..').CalendarState} state 
 */
export function isCreateAllowed(state) {
	if (!state || !state.properties || !state.properties.security)
		return false;
	const {readOnly, allowCreate} = state.properties.security;
	return !!(!readOnly && allowCreate && !isPopoverOpen(state) && state.properties.enableNewCalendarClick);
}
/**
 * 
 * @param {import('../..').CalendarState} state 
 */
export function isCreateAllowed2(state) {
	if (!state || !state.properties || !state.properties.security)
		return false;
	const {readOnly, allowCreate } = state.properties.security;
	return !readOnly && allowCreate && state.properties.enableNewButton;
}

export function isMoveAllowed(state, event) {
	if (!state || !state.properties || !state.properties.security || !event)
		return false;
	const {readOnly, allowMove} = state.properties.security;
	const {readOnly: readOnlyEvent = false, allowMove: allowMoveEvent = true} = event;
	return !!(!readOnly && !readOnlyEvent && allowMove && allowMoveEvent && !isPopoverOpen(state));
}

export function isResizeAllowed(state, event) {
	if (!state || !state.properties || !state.properties.security || !event)
		return false;
	const {readOnly, allowResize} = state.properties.security;
	const {readOnly: readOnlyEvent = false, allowResize: allowResizeEvent = true} = event;
	return !!(!readOnly && !readOnlyEvent && allowResize && allowResizeEvent && !isPopoverOpen(state));
}

/**
 * MARK SPAN HELPER FUNCTIONS - START
 */
const DAY_START_TIME = '00:00:00';
const DAY_END_TIME = '23:59:59';

function strDate2Moment(date, timezone) {
	return str2Moment(date + ' ' + DAY_START_TIME, timezone).startOf('day');
}

function str2ObjectTime(time) {
	const timeMoment = moment(time, INTERNAL_FORMAT.TIME);
	return {
		hour: timeMoment.get('hour'),
		minute: timeMoment.get('minute'),
		second: timeMoment.get('second')
	};
}


function getZones(zones, inverted) {
	let momentZones = [];
	if (!inverted)
		zones.forEach((zone) => {
			momentZones.push({
				startTime: str2ObjectTime(zone.startTime),
				endTime: str2ObjectTime(zone.endTime)
			});
		});
	else {
		let previousEndTime = DAY_START_TIME;
		zones.forEach((zone, index) => {
			if (zone.startTime !== DAY_START_TIME) {
				momentZones.push({
					startTime: str2ObjectTime(previousEndTime),
					endTime: str2ObjectTime(zone.startTime)
				});
			}
			previousEndTime = zone.endTime;
		});
		if (previousEndTime !== DAY_END_TIME)
			momentZones.push({
				startTime: str2ObjectTime(previousEndTime),
				endTime: str2ObjectTime(DAY_END_TIME)
			});
	}
	return momentZones;
}

function processMarkSpans(markSpan, state, chunkSize) {
	const {startMoment, endMoment, properties: props} = state;
	const markSpanTimezone = markSpan.timezone ? markSpan.timezone : props.timezone;

	let limitStartMoment = moment(startMoment).tz(markSpanTimezone);
	let limitEndMoment = moment(endMoment).tz(markSpanTimezone);
	if (markSpan.startDate) {
		let markSpanStartMoment = strDate2Moment(markSpan.startDate,  markSpanTimezone);
		if (markSpanStartMoment.isAfter(limitStartMoment))
			limitStartMoment = markSpanStartMoment;
	}
	if (markSpan.endDate) {
		let markSpanEndMoment = strDate2Moment(markSpan.endDate, markSpanTimezone);
		if (markSpanEndMoment.isBefore(limitEndMoment))
			limitEndMoment = markSpanEndMoment;
	}

	let chunks = [];

	while (limitStartMoment.isSameOrBefore(limitEndMoment, 'date')) {
		if (markSpan.occurrenceDays.includes(limitStartMoment.day())) {
			getZones(markSpan.zones, markSpan.inverted).forEach((zone) => {
				let zoneSpan = {
					startMS: moment(limitStartMoment).startOf('day').set(zone.startTime).valueOf(),
					endMS: moment(limitStartMoment).startOf('day').set(zone.endTime).valueOf()
				};
				chunks.push(...getChunks(zoneSpan, chunkSize, state));
			});
		} else if (markSpan.inverted) {
			let zoneSpan = {
				startMS: moment(limitStartMoment).startOf('day').valueOf(),
				endMS: moment(limitStartMoment).endOf('day').valueOf()
			};
			chunks.push(...getChunks(zoneSpan, chunkSize, state));
		}

		limitStartMoment = limitStartMoment.add(1, 'day');
	}

	return chunks.map((chunk)=> {
		chunk.$$mid = markSpan.$$mid;
		chunk.initializeMoment();
		return chunk;
	});

}

export function getMarkSpanById(state, index) {
	const {properties: props} = state;
	return props.markSpans[index];
}

/**
 *
 * Process raw mark span events from state properties
 * returns chunked events in the display range
 *
 */
export function getProcessedMarkSpans(state, chunkSize) {

	const {properties: props} = state;

	if (!props.markSpans)
		return [];

	let markSpanChunks = [];

	props.markSpans.forEach((e, index) => {
		e.$$mid = index;
		markSpanChunks.push(...processMarkSpans(e, state, chunkSize));
	});


	return markSpanChunks;
}

function areTimeSpansOverlapping(aSpan, bSpan, options) {
	return (aSpan.startMoment.isBetween(bSpan.startMoment, bSpan.endMoment, null, options)
		|| aSpan.endMoment.isBetween(bSpan.startMoment, bSpan.endMoment, null, options)
		|| bSpan.startMoment.isBetween(aSpan.startMoment, aSpan.endMoment, null, options)
			|| bSpan.endMoment.isBetween(aSpan.startMoment, aSpan.endMoment, null, options));
}

function getMarkSpanChunkOverlapping(markSpan, state, eventStartMoment, eventEndMoment) {
	const {properties: props} = state;
	const markSpanTimezone = markSpan.timezone ? markSpan.timezone : props.timezone;

	let options = "()";
	if (markSpan.inclusiveCheck) // event end time cannot overlap with markspan start time and vice versa.
		options = "[]";

	let limitStartMoment = moment(eventStartMoment).tz(markSpanTimezone);
	let limitEndMoment = moment(eventEndMoment).tz(markSpanTimezone);
	if (markSpan.startDate) {
		let markSpanStartMoment = strDate2Moment(markSpan.startDate, markSpanTimezone);
		if (markSpanStartMoment.isAfter(limitStartMoment))
			limitStartMoment = markSpanStartMoment;
	}
	if (markSpan.endDate) {
		let markSpanEndMoment = strDate2Moment(markSpan.endDate, markSpanTimezone);
		if (markSpanEndMoment.isBefore(limitEndMoment))
			limitEndMoment = markSpanEndMoment;
	}


	while (limitStartMoment.isSameOrBefore(limitEndMoment, 'date')) {
		if (markSpan.occurrenceDays.includes(limitStartMoment.day())) {
			const zones = getZones(markSpan.zones, markSpan.inverted);
			for(const zone of zones) {
				const markSpanChunk = {};
				markSpanChunk.startMoment = moment(limitStartMoment).startOf('day').set(zone.startTime);
				markSpanChunk.endMoment = moment(limitStartMoment).startOf('day').set(zone.endTime);
				if (areTimeSpansOverlapping({startMoment: eventStartMoment, endMoment: eventEndMoment}, markSpanChunk, options))
					return markSpanChunk;
			}
		} else if (markSpan.inverted) {
			const markSpanChunk = {};
			markSpanChunk.startMoment = moment(limitStartMoment).startOf('day');
			markSpanChunk.endMoment = moment(limitStartMoment).endOf('day');
			if (areTimeSpansOverlapping({startMoment: eventStartMoment, endMoment: eventEndMoment}, markSpanChunk, options))
				return markSpanChunk;
		}
		limitStartMoment = limitStartMoment.add(1, 'day');
	}

}

function getOverlappingBlockSpanChunk(state, eventStartMoment, eventEndMoment) {
	if (state.properties.markSpans) {
		for (const markSpan of state.properties.markSpans) {
			if (markSpan.block) {
				const markSpanChunk = getMarkSpanChunkOverlapping(markSpan, state, eventStartMoment, eventEndMoment);
				if (markSpanChunk) {
					markSpanChunk.$$mid = markSpan.$$mid;
					return markSpanChunk;
				}
			}
		}
	}
}

export function getBlockSpanOnDate(state, date, forFullDay) {
	const startOfDate = moment(date).startOf('day');
	const endOfDate = moment(date).endOf('day');
	if (state.markSpanChunks) {
		for(let markSpanChunk of state.markSpanChunks) {
			let markSpan = getMarkSpanById(state, markSpanChunk.$$mid);
			if (markSpan.block) {
				if (
					(!forFullDay &&
						(startOfDate.isSame(moment(markSpanChunk.startMoment).startOf('day')) && startOfDate.isSame(moment(markSpanChunk.endMoment).startOf('day'))))
					|| (forFullDay &&
						(startOfDate.isSame(markSpanChunk.startMoment, 's') && endOfDate.isSame(markSpanChunk.endMoment, 's'))
					)
				)
					return markSpan;
			}
		}
	}
}

/**
 * MARK SPAN HELPER FUNCTIONS - END
 */

export function dispatchEventClick(state, dispatch, event, chunkStartDate, chunkEndDate) {
	dispatch(ACTIONS.EVENT_CLICKED, {
		event: cloneDeep(event),
		chunkStartDateMoment: chunkStartDate.clone(),
		chunkEndDateMoment: chunkEndDate.clone(),
		chunkStartDateMS: chunkStartDate.valueOf(),
		chunkEndDateMS: chunkEndDate.valueOf()
	});
}

export function dispatchEventMove(state, dispatch, event, difference, newStartMoment, newEndMoment, group) {
	const blockSpanChunk = getOverlappingBlockSpanChunk(state, newStartMoment, newEndMoment);
	if (!blockSpanChunk) {
		dispatch(ACTIONS.EVENT_MOVED, {
			event: cloneDeep(event),
			difference,
			newStartMoment: newStartMoment.clone(),
			newEndMoment: newEndMoment.clone(),
			newStartMS: newStartMoment.valueOf(),
			newEndMS: newEndMoment.valueOf(),
			group
		});
	} else {
		clearTemporaryEvent(state, dispatch);
		dispatchRejectedByBlockedSpan(state, dispatch, blockSpanChunk, ACTIONS.EVENT_MOVED, EVENT_TYPES.MOVE);
	}
}
/**
 * 
 * @param {import('../..').CalendarState} state 
 * @param {*} dispatch 
 * @param {*} startDate 
 * @param {*} endDate 
 * @param {*} group 
 */
export function dispatchDragNewEventEnd(state, dispatch, startDate, endDate, group = DEFAULT_SECTION_KEY) {
	if(!state.properties.enableNewCalendarClick)
		return;
	const blockSpanChunk = getOverlappingBlockSpanChunk(state, startDate, endDate);
	if (!blockSpanChunk)
		dispatch(ACTIONS.DRAG_END_NEW_EVENT, {
			newStartMoment: startDate.clone(),
			newEndMoment: endDate.clone(),
			newStartMS: startDate.valueOf(),
			newEndMS: endDate.valueOf(),
			group
		});
	else {
		clearTemporaryEvent(state, dispatch);
		dispatchRejectedByBlockedSpan(state, dispatch, blockSpanChunk, ACTIONS.DRAG_END_NEW_EVENT, EVENT_TYPES.CREATE);
	}
}

export function dispatchGridClickNewEvent(state, dispatch, startDate, endDate) {
	const blockSpanChunk = getOverlappingBlockSpanChunk(state, startDate, endDate, ACTIONS.GRID_CLICKED_NEW_EVENT);
	if (!blockSpanChunk)
		dispatch(ACTIONS.GRID_CLICKED_NEW_EVENT, {
			newStartMoment: startDate.clone(),
			newEndMoment: endDate.clone(),
			newStartMS: startDate.valueOf(),
			newEndMS: endDate.valueOf()
		});
	else {
		clearTemporaryEvent(state, dispatch);
		dispatchRejectedByBlockedSpan(state, dispatch, blockSpanChunk, ACTIONS.GRID_CLICKED_NEW_EVENT, EVENT_TYPES.CREATE);
	}
}

export function dispatchEventResize(state, dispatch, event, startDate, endDate) {
	const blockSpan = getOverlappingBlockSpanChunk(state, startDate, endDate, ACTIONS.GRID_CLICKED_NEW_EVENT);
	if (!blockSpan) {
		dispatch(ACTIONS.EVENT_RESIZED, {
			event: cloneDeep(event),
			newStartMoment: startDate.clone(),
			newEndMoment: endDate.clone(),
			newStartMS: startDate.valueOf(),
			newEndMS: endDate.valueOf()
		});
	} else {
		clearTemporaryEvent(state, dispatch);
		dispatchRejectedByBlockedSpan(state, dispatch, blockSpan, ACTIONS.EVENT_RESIZED, EVENT_TYPES.RESIZE);
	}
}

function dispatchRejectedByBlockedSpan(state, dispatch, blockSpanChunk, event, operation) {
	const causingBlockedSpan = getMarkSpanById(state, blockSpanChunk.$$mid);
	dispatch(ACTIONS.REJECTED_BY_BLOCKED_SPAN, {
		causingBlockedSpan,
		operation,
		event,
		occurrenceDateStartMoment: blockSpanChunk.startMoment,
		occurrenceDateStartMS: blockSpanChunk.startMoment.valueOf(),
		occurrenceDateEndMoment: blockSpanChunk.endMoment,
		occurrenceDateEndMS: blockSpanChunk.endMoment.valueOf()
	});
}
/**
 * @param {import('../body-views/timeline/utils').CalendarState} state
 */
export function clearTemporaryEvent(state, dispatch) {
	if(state.timelineView && state.timelineView.isActiveView) {
		state.timelineView.setCurrentTransaction(null);
		state.timelineView.setPendingTransaction(null);
		state.timelineView.clearTempDOM();
	}
	dispatch.updateState({temporaryEventSettings: null});

	if (state.externalEventSettings && state.externalEventSettings.originatedFromInternal)
		dispatch.updateState({externalEventSettings: null});	
}

export function generateUniqueId() {
	let now = Date.now();
	return `${now}${Math.random().toString(16).substr(2)}`;
}
export function validEventPosition(state, startMoment, endMoment) {
	const {properties: {splitMultiDayEvent: splitEvent}} = state;
	return !!(splitEvent || (!splitEvent && moment(startMoment).startOf('day').isSame(moment(endMoment).startOf('day'))));
}

export function getEventAriaLabel(state, chunkEvent) {
	const {properties: {timezone}} = state;
	let start = msToFormat(chunkEvent.startMS, timezone, INTERNAL_FORMAT.ARIA_DATE_FORMAT+' '+state.properties.timeFormat);
	let end = msToFormat(chunkEvent.endMS, timezone, INTERNAL_FORMAT.ARIA_DATE_FORMAT+' '+state.properties.timeFormat);
	let parentEvent;
	chunkEvent.eventId ? parentEvent = getEventById(state, chunkEvent.eventId) : parentEvent = chunkEvent;
	return t('{0} - {1} {2}', start, end, parentEvent.title);
}

export function closeEventPopover(state, dispatch) {
	dispatch.updateState({ popOvers: { event: { id: "", opened: false } } });
	dispatch(ACTIONS.POPOVER_CLOSED);
}

/**
 * 
 * @param {import('../..').CalendarState} state 
 * @param {import('../..').appDispatch} dispatch 
 */
export function openManagedPopover(state, dispatch) {
	const { popoverContentState = {id: ""}, popoverEnabled } = state.properties;
	const { event = {id: ""} } = state.popOvers;
	const isPopoverAlreadyOpen = event && event.opened;
	if (!popoverEnabled) {
		if (isPopoverAlreadyOpen)
			closePopover(state, dispatch);
		return;
	}
	if (event.id === popoverContentState.id)
		return;
	if(!isPopoverAlreadyOpen) {
		if(!popoverContentState.id)
			return;
	}
	const targetedCalendarEvent = state.dataProvider.getEventById(popoverContentState.id);
	if (!targetedCalendarEvent) {
		if (popoverContentState.value &&
			popoverContentState.value !== POPOVER_STATE.EMPTY &&
			popoverContentState.value !== POPOVER_STATE.DESTROYED)
			closePopover(state, dispatch);
		return;
	}
	const rawEvent = targetedCalendarEvent.rawEvent;
	const className = getEventPopoverClassName(state, rawEvent.id);
	const popoverTargetEl = state.calendarCoreRef.current.querySelector(`.${className}`);
	if (!popoverTargetEl)
		return closePopover(state, dispatch);
	const popoverRect = popoverTargetEl.getBoundingClientRect();
	const bodyRect = document.body.getBoundingClientRect();
	const popoverLeft = Math.max(popoverRect.left - bodyRect.left);
	const popoverTop = Math.max(popoverRect.top - bodyRect.top);
	const closedTime  = !Number.isInteger(state.eventPopoverClosedTime) ? 0: state.eventPopoverClosedTime;
	const openTime = !Number.isInteger(state.eventPopoverSetTime)? 1: state.eventPopoverSetTime;
	if (closedTime > openTime)
		return;
	dispatch(ACTIONS.TOGGLE_POPOVER,
		{
			popOver: POPOVERS.EVENT,
			event: rawEvent,
			eventEl: popoverTargetEl,
			pos: {
				left: popoverLeft,
				top: popoverTop
			}
		}
	);
}
/**
 * @param {import('../../..').CalendarState} state
 * @param {string} id 
 */
export function getEventPopoverClassName(state, id) {
	return `managed-event-popover-container-${id}`;
}

import moment from 'moment-timezone';
import {DIRECTION} from '../../constants';
import {getNodeIndex, getTimeFromStartOfDay} from '../../util';

export const COL_EVENT_CONSTANTS = {
	DRAG_IMG_CONTAINER: 'drag-image-container',
	TEMPORARY_EVENT: 'temporary-event'
};

export function calculateDateRange(contextMoment, numberOfDays, startDay) {
	if (numberOfDays === 1) {
		let startMoment = moment(contextMoment).startOf('day');
		let endMoment = moment(contextMoment).endOf('day');
		return {startMoment, endMoment};
	} else {
		let startMoment = moment(contextMoment).startOf('day');
		if (startDay <= contextMoment.day())
			startMoment.day(startDay);
		else
			startMoment.day(startDay - 7);
		let endMoment = moment(startMoment).add(numberOfDays - 1, 'days').endOf('day');
		return {startMoment, endMoment};
	}
}
export function isValidStepGranularity(viewSettings) {
	return Number.isInteger(viewSettings.snapGranularity) && viewSettings.snapGranularity > 0;
}
// Computes day index and time at mouse position
export function getMousePositionDayTime(event, gridBounds, viewSettings, state) {
	const {properties: props} = state;
	const {numberOfDays, stepSize, scaleSizeInSecs} = viewSettings;

	let day = window.Math.floor((event.clientX - gridBounds.x) * numberOfDays / gridBounds.width);
	if (props.dir === DIRECTION.RTL)
		day = viewSettings.numberOfDays - day - 1;
	if (day < 0)
		day = 0;
	else if (day > viewSettings.numberOfDays - 1)
		day = viewSettings.numberOfDays - 1;

	let stepSizeInSecs = stepSize * 60; // minutes to seconds
	let time = ((event.clientY - gridBounds.y) / gridBounds.height) * scaleSizeInSecs;
	let stepTime;
	if (time < 0) {
		time = 0;
		stepTime = 0;
	} else if (time > scaleSizeInSecs) {
		time = scaleSizeInSecs;
		stepTime = scaleSizeInSecs;
	} else {
		stepTime = Math.floor(time / stepSizeInSecs) * stepSizeInSecs;
	}

	return {
		day,
		time, // in seconds
		stepTime  // in seconds
	};
}

export function isPositionChanged(currentPosition, previousPosition, diffOnStepTime) {
	return !previousPosition || currentPosition.day !== previousPosition.day || (!diffOnStepTime && currentPosition.time !== previousPosition.time) || (diffOnStepTime && currentPosition.stepTime !== previousPosition.stepTime);
}


export function isEventModified(parentEvent, tempEvent) {
	return parentEvent.startMS !== tempEvent.startMS || parentEvent.endMS !== tempEvent.endMS;
}

export function getMomentByPositionChange(m, initialPosition, currentPosition, setStepTime, stepSize) {
	let tempMoment = moment(m).add(currentPosition.day - initialPosition.day, 'd');
	if (setStepTime)
		return tempMoment.startOf('day').add(currentPosition.stepTime, 's');
	else {
		let stepSizeInSecs = stepSize * 60; // minutes to seconds
		let stepTime = Math.floor((getTimeFromStartOfDay(m, 'seconds') + currentPosition.time - initialPosition.time) / stepSizeInSecs) * stepSizeInSecs;
		return tempMoment.startOf('day').add(stepTime, 's');
	}
}

// Computes day index and time of grid cell
export function getGridCellPositionDay(event, bounds, viewSettings, state) {
	let day = getNodeIndex(event.currentTarget);
	if (day < 0)
		day = 0;
	else if (day > viewSettings.numberOfDays - 1)
		day = viewSettings.numberOfDays - 1;
	return {
		day: day
	};
}

import { getNodeIndex, msUtils } from  '../../util';

export function getWeekEndDayNumber(startDayNumber) {
	if (startDayNumber == 0)
		return 6;
	return startDayNumber - 1;
}

export function getWeekDayIndex(startDayNumber, dayNumber) {
	if (startDayNumber <= dayNumber)
		return dayNumber - startDayNumber;
	else
		return dayNumber - startDayNumber + 7;
}

export function getNextDateMS(dateMS, weekEndDayNumber, timezone) {
	const dayNumber = msUtils.day(dateMS, timezone);

	if (weekEndDayNumber >= dayNumber)
		dateMS = msUtils.day(dateMS, timezone, weekEndDayNumber);
	else
		dateMS = msUtils.day(dateMS, timezone, weekEndDayNumber + 7);

	return msUtils.endOf(dateMS,  'day',  timezone);
}

export function getNextDate(date, weekEndDayNumber) {
	const dayNumber = date.day();

	if (weekEndDayNumber >= dayNumber)
		date.day(weekEndDayNumber);
	else
		date.day(weekEndDayNumber + 7);

	date.endOf('day');
	return date;
}

function getPreviousDate(date, weekStartDayNumber) {
	const dayNumber = date.day();

	if (weekStartDayNumber <= dayNumber)
		date.day(weekStartDayNumber);
	else
		date.day(weekStartDayNumber - 7);

	date.startOf('day');
	return date;
}

function getFirstDayOfaMonthView(date, weekStartDay) {
	const firstDateOfMonth = date.clone().startOf('month');
	const firstDateOfMonthView = getPreviousDate(firstDateOfMonth, weekStartDay);
	return firstDateOfMonthView;
}
function getLastDayOfaMonthView(date, weekLastDay) {
	const lastDateOfMonth = date.clone().endOf('month');
	const lastDateOfMonthView = getNextDate(lastDateOfMonth, weekLastDay);
	return lastDateOfMonthView;
}

export function getBetweenDates(startDateMoment, endDateMoment) {
	const dates = [];
	const startDateMomentClone = startDateMoment.clone();
	while(startDateMomentClone.valueOf() < endDateMoment.valueOf()) {
		dates.push(startDateMomentClone.clone());
		startDateMomentClone.add(1, 'days');
	}
	return dates;
}

export function calculateDateRange(date, weekStartDayNumber) {
	const weekEndDayNumber = getWeekEndDayNumber(weekStartDayNumber);

	return {
		startMoment: getFirstDayOfaMonthView(date, weekStartDayNumber),
		endMoment: getLastDayOfaMonthView(date, weekEndDayNumber)
	};
}

export function getRow(el) {
	return el.closest('.grid-row');
}

export function getGridCellPos(currentCell) {
	const row = getRow(currentCell);
	return {
		rowNumber: getNodeIndex(row),
		columnNumber: getNodeIndex(currentCell)
	};
}

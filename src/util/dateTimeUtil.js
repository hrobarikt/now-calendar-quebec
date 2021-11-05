import moment from 'moment-timezone';
import {INTERNAL_FORMAT, DIRECTION, VIEWS, INTERNAL_DATE_TIME_REGEX} from '../constants';
import {getCurrentViewSettings, getCurrentViewProvider} from './viewUtil';

(function () {
	moment.fn.tzValueOf = function () {
		return this.valueOf() + this.utcOffset() * 60 * 1000;
	};
})();


export function setLocale(momentObject, state) {
	momentObject.locale(state.properties.locale);
	return momentObject;
}

export function str2Moment(dateStr, tz) {
	return moment.tz(dateStr, INTERNAL_FORMAT.DATE_TIME, true, tz);
}

export function toMoment(d, tz) {
	return moment.tz(d, tz);
}

export function getTimeFromStartOfDay(dateTime, units = 'seconds') {
	return dateTime.diff(moment(dateTime).startOf('day'), units);
}

export function getTimeDiff(date1, date2, units = 'seconds') {
	return Math.abs(date1.diff(date2, units));
}

/* *
* Check if the start and end dates(moments) cover the current date(moment).
*/
export function isTodayInView(startMoment, endMoment, todayMoment) {
	return todayMoment.isBetween(startMoment, endMoment, null, '[]');
}

/**
 * Simplest possible template engine. The template here
 * is a pure JS code.
 * @param {String} tmpl JS code which is run with magic following available variables - props (properties Object), moment (moment JS object),
 * startMoment and endMoment. Start and end moment dates with locale correctly set. 'return' statement is auto added if not already there.
 * @param {*} state state object
 */
export function evalTemplate(tmpl, state) {
	if (!tmpl)
		return '';
	if (tmpl.indexOf('return ') < 0)
		tmpl = `return ${tmpl};`;
	const {properties: props} = state;
	let f = new Function('props', 'moment', 'startMoment', 'endMoment', tmpl + '\nreturn \'\';');
	return f(props, moment, setLocale(moment(state.startMoment), state), setLocale(moment(state.endMoment), state));
}

export function getCurrentDateFormats(dateFormats, state) {
	let {properties: {dateFormat, timeFormat}} = state;
	return {
		...{dateFormat, timeFormat},
		...dateFormats
	};
}

/* *
* Update the current date based on action.
* Clicking on next or previous button will change the current date.
*/
export function updateCurrentDate(state, dispatch, direction) {//, viewParam /*optional*/, contextDateParam /*optional*/, numberOfDaysParam /*optional*/) {
	if (state && direction) {
		const {properties: props} = state;
		const {currentView, contextDate} = props;
		const {numberOfDays} = getCurrentViewSettings(state);
		const viewProvider = getCurrentViewProvider(state);
		dispatch('PROPERTIES_SET', {contextDate: getNextContextDate(direction, viewProvider, contextDate, numberOfDays)});
	}
}

export function getNextContextDate(direction, viewProvider, contextDate, numberOfDays) {
	contextDate = moment(contextDate);
	switch (direction) {
	case DIRECTION.LEFT: {
		if (viewProvider == VIEWS.MONTH) {
			return contextDate.subtract(1, 'month');
		} else if (viewProvider == VIEWS.COLUMN) {
			return contextDate.subtract(7, 'days');
		} else {
			return contextDate.subtract(numberOfDays, 'days');
		}
	}
	case DIRECTION.RIGHT: {
		if (viewProvider == VIEWS.MONTH) {
			return contextDate.add(1, 'month');
		} else if (viewProvider == VIEWS.COLUMN) {
			return contextDate.add(7, 'days');
		} else {
			return contextDate.add(numberOfDays, 'days');
		}
	}
	}
}

export function anyToMoment(dateValue, props) {
	const {timezone} = props;
	if (!dateValue) {
		return toMoment(Date.now(), timezone).clone();
	}
	if (dateValue instanceof moment) {
		return toMoment(dateValue, timezone).clone();
	}
	if(typeof dateValue === 'string') {
		dateValue = dateValue.trim();
		if(INTERNAL_DATE_TIME_REGEX.test(dateValue))
			return moment.tz(dateValue, INTERNAL_FORMAT.DATE_TIME, true, timezone);
		else
			return moment(dateValue).tz(timezone);
	}
	if(Number.isInteger(dateValue)) {
		return moment.utc(dateValue).tz(timezone);
	}
}

export const msToFormat = (function () {
	const tempDate = new Date();
	const tempMoment = moment.utc(tempDate);

	function setMS(xMoment, xMS, tz) {
		xMoment.tz('GMT');
		tempDate.setTime(xMS);
		xMoment.set({
			year: tempDate.getUTCFullYear(),
			month: tempDate.getUTCMonth(),
			date: tempDate.getUTCDate(),
			hour: tempDate.getUTCHours(),
			minute: tempDate.getUTCMinutes(),
			second: tempDate.getUTCSeconds(),
			millisecond: tempDate.getUTCMilliseconds()
		}).tz(tz);
	}

	return (ms, tz, format, locale) => {
		setMS(tempMoment, ms, tz);
		if (locale)
			tempMoment.locale(locale);
		return tempMoment.format(format);
	};
})();


export const msCompare = (function () {
	const tempDate = new Date();
	const aMoment = moment.utc(tempDate);
	const bMoment = moment.utc(tempDate);

	function setMS(xMoment, xMS, tz) {
		xMoment.tz('GMT');
		tempDate.setTime(xMS);
		xMoment.set({
			year: tempDate.getUTCFullYear(),
			month: tempDate.getUTCMonth(),
			date: tempDate.getUTCDate(),
			hour: tempDate.getUTCHours(),
			minute: tempDate.getUTCMinutes(),
			second: tempDate.getUTCSeconds(),
			millisecond: tempDate.getUTCMilliseconds()
		}).tz(tz);
	}

	return {
		isSame: (aMS, bMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			setMS(bMoment, bMS, tz);
			return aMoment.isSame(bMoment, units);
		},
		isBefore: (aMS, bMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			setMS(bMoment, bMS, tz);
			return aMoment.isBefore(bMoment, units);
		},
		isAfter: (aMS, bMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			setMS(bMoment, bMS, tz);
			return aMoment.isAfter(bMoment, units);
		},
		isSameOrBefore: (aMS, bMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			setMS(bMoment, bMS, tz);
			return aMoment.isSameOrBefore(bMoment, units);
		}
	}
})();

export const msUtils = (function () {
	const tempDate = new Date();
	const aMoment = moment.utc(tempDate);

	function setMS(xMoment, xMS, tz) {
		xMoment.tz('GMT');
		tempDate.setTime(xMS);
		xMoment.set({
			year: tempDate.getUTCFullYear(),
			month: tempDate.getUTCMonth(),
			date: tempDate.getUTCDate(),
			hour: tempDate.getUTCHours(),
			minute: tempDate.getUTCMinutes(),
			second: tempDate.getUTCSeconds(),
			millisecond: tempDate.getUTCMilliseconds()
		}).tz(tz);
	}

	return {
		add: (aMS, n, units, tz) => {
			setMS(aMoment, aMS, tz);
			return aMoment.add(n, units).valueOf();
		},
		day: (aMS, tz, day) => {
			setMS(aMoment, aMS, tz);
			if (day !== undefined)
				return aMoment.day(day).valueOf();
			else
				return aMoment.day();
		},
		startOf: (aMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			return aMoment.startOf(units).valueOf();
		},
		endOf: (aMS, units, tz) => {
			setMS(aMoment, aMS, tz);
			return aMoment.endOf(units).valueOf();
		}
	}
})();



export const getDaysCountBetweenDates = (function () {
	const tempDate = new Date();
	const aMoment = moment.utc(tempDate);
	const bMoment = moment.utc(tempDate);

	function setMS(xMoment, xMS, tz) {
		xMoment.tz('GMT');
		tempDate.setTime(xMS);
		xMoment.set({
			year: tempDate.getUTCFullYear(),
			month: tempDate.getUTCMonth(),
			date: tempDate.getUTCDate(),
			hour: tempDate.getUTCHours(),
			minute: tempDate.getUTCMinutes(),
			second: tempDate.getUTCSeconds(),
			millisecond: tempDate.getUTCMilliseconds()
		}).tz(tz);
	}

	return (aMS, bMS, tz, includeStartDay) => {
		setMS(aMoment, aMS, tz);
		setMS(bMoment, bMS, tz);
		let diff = aMoment.startOf('day').diff(bMoment.startOf('day'), 'days');
		if (includeStartDay)
			diff++;
		return diff;
	};
})();

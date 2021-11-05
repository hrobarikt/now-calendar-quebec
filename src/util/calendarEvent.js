/// @ts-check
import moment from 'moment-timezone';
import { INTERNAL_FORMAT, INTERNAL_DATE_TIME_REGEX } from '../constants';
import { sanitizeHTML } from './layoutUtil';

const eventDate = new Date();
const eventMoment = moment.utc(eventDate);
export class CalendarEvent {
	static eventIndex = 0;
	/**
	 *
	 * @param {import('../..').RawCalendarEvent} rawEvent
	 */
	constructor(rawEvent, timezone = 'GMT') {
		Object.assign(this, rawEvent);
		this.rawEvent = rawEvent;
		this.id = rawEvent.id;
		this.group = rawEvent.group;
		this.textColor = rawEvent.textColor;
		this.bgColor = rawEvent.bgColor;
		this.borderColor = rawEvent.borderColor;
		this.gradientColor1 = rawEvent.gradientColor1;
		this.gradientColor2 = rawEvent.gradientColor2;
		this.title = sanitizeHTML(rawEvent.title);
		if (rawEvent.description)
			this.description = sanitizeHTML(rawEvent.description);
		this.start = rawEvent.start;
		this.end = rawEvent.end;
		if (typeof rawEvent.id !== 'string' || rawEvent.id.length === 0) // generate unique if not present
			this.id = String(CalendarEvent.eventIndex++);

		if (rawEvent.startMS) {
			this.startMS = rawEvent.startMS;
		} else if (rawEvent.startMoment && moment(rawEvent.startMoment).isValid()) {
			this.startMS = rawEvent.startMoment.valueOf();
		} else if(Number.isInteger(/**@type {number} */(rawEvent.start))) {
			this.startMS = /**@type {number} */(rawEvent.start);
		} else if(typeof rawEvent.start === 'string') {
			rawEvent.start = rawEvent.start.trim();
			/** @type {moment.Moment} */
			let startM = null;
			if(INTERNAL_DATE_TIME_REGEX.test(rawEvent.start))
				startM = moment.tz(rawEvent.start, INTERNAL_FORMAT.DATE_TIME, true, timezone);
			else
				startM = moment(rawEvent.start).tz(timezone);
			if(!startM.isValid())
				throw new Error('Invalid date');
			this.startMS = startM.valueOf();
		} else
			throw new Error('Invalid date format');


		//this.startMS = rawEvent.startMS;
		this.startMoment = /**@type {moment.Moment} */(undefined);
		this.end = rawEvent.end;
		if (rawEvent.endMS) {
			this.endMS = rawEvent.endMS;
		} else if (rawEvent.endMoment  && moment(rawEvent.endMoment).isValid()) {
			this.endMS = rawEvent.endMoment.valueOf();
		} else if(Number.isInteger(/**@type {number} */(rawEvent.end))) {
			this.endMS = /**@type {number} */(rawEvent.end);
		} else if(typeof rawEvent.end === 'string') {
			rawEvent.end = rawEvent.end.trim();
			/** @type {moment.Moment} */
			let endM = null;
			if(INTERNAL_DATE_TIME_REGEX.test(rawEvent.end))
				endM = moment.tz(rawEvent.end, INTERNAL_FORMAT.DATE_TIME, true, timezone);
			else
				endM = moment(rawEvent.end).tz(timezone);
			if(!endM.isValid())
				throw new Error('Invalid date format');
			this.endMS = endM.valueOf();
		} else
			throw new Error('Invalid date format');


		if (this.startMS > this.endMS)
			throw new Error('Event start date should be before end date');

		this.endMoment = /**@type {moment.Moment} */(undefined);
	}
	/**
	 *
	 * @param {string} tz
	 */
	initializeMoment(tz) {
		tz = tz || 'GMT';
		if(!this.startMoment)
			this.startMoment = moment.utc(this.startMS);
		if(!this.endMoment)
			this.endMoment = moment.utc(this.endMS);
		this.startMoment.tz(tz);
		this.endMoment.tz(tz);
	}
	uninitializeMoment() {
		this.startMoment = undefined;
		this.endMoment = undefined;
	}
	/**
	 *
	 * @param {String} newTZ
	 */
	setTimezone(newTZ) {
		eventMoment.tz('GMT');
		eventDate.setTime(this.startMS);
		eventMoment.set({
			year: eventDate.getUTCFullYear(),
			month: eventDate.getUTCMonth(),
			date: eventDate.getUTCDate(),
			hour: eventDate.getUTCHours(),
			minute: eventDate.getUTCMinutes(),
			second: eventDate.getUTCSeconds(),
			millisecond: eventDate.getUTCMilliseconds()}).tz(newTZ);
		this.startUTCOffsetMS = eventMoment.utcOffset() * 60 * 1000;
		eventMoment.tz('GMT');
		eventDate.setTime(this.endMS);
		eventMoment.set({
			year: eventDate.getUTCFullYear(),
			month: eventDate.getUTCMonth(),
			date: eventDate.getUTCDate(),
			hour: eventDate.getUTCHours(),
			minute: eventDate.getUTCMinutes(),
			second: eventDate.getUTCSeconds(),
			millisecond: eventDate.getUTCMilliseconds()}).tz(newTZ);
		this.endUTCOffsetMS = eventMoment.utcOffset() * 60 * 1000;
	}
	clone() {
		return new CalendarEvent({...this});
	}
}

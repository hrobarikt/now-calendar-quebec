import { str2Moment } from './dateTimeUtil';
import { Log } from './devUtil';
import {CalendarEvent} from './calendarEvent';
export function jsonParse(j, defaultJson) {
	if (typeof j === 'string')
		try {
			j = JSON.parse(j);
		} catch (e) {
			Log.error('Failed to parse JSON: ', j, e);
			j = {};
		}

	if (!j)
		j = {};

	return defaultJson ? { ...defaultJson, ...j } : j;
}

export function jsonParseArray(j) {
	if (typeof j === 'string') {
		if (j.indexOf('[') === 0)
			try {
				return JSON.parse(j);
			} catch (e) {
				Log.error('Failed to parse JSON: ', j, e);
			}
		else
			Log.error('Failed to parse JSON. Invalid array JSON: ', j);
	} else if (j)
		return j;
	return [];
}
/**
 *
 * @param {Array<import('../body-views/timeline/utils').RawCalendarEvent>} events
 * @param {*} timezone
 */
export function parseEvents(events, timezone) {
	/**
	 * @type {Array<CalendarEvent>}
	 */
	let processedEvents = [];
	for(let i = 0; i < events.length; i++) {
		try {
			const newEvent = new CalendarEvent(events[i], timezone);
			newEvent.setTimezone(timezone);
			processedEvents.push(newEvent);
    }catch(e) {
			Log.error(e.message, events[i]);

		}
	}
	return processedEvents;
}

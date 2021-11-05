import {createCustomElement} from '@servicenow/ui-core';
import rtlBehavior from '@servicenow/behavior-rtl';
import calendarRenderer from './renderer';
import calendarProps from './properties';
import calendarView from './view';
import actionHandlers from './action-handlers';
import eventHandlers from './event-handlers';
import styles from './style';



/**
 * Interactive calendar for viewing and managing time-based events. 
 *
 *
 * ```jsx
 * <now-calendar style={{ height: '90vh', display: "block" }} dir={props.dir} current-mode={props.mode}
 *	time-format={props.timeFormat}
 *	available-views={[VIEWS.WEEK, VIEWS.MONTH, VIEWS.TIMELINE_WEEK]}
 *	view-settings={props.viewSettings}
 *	view-templates={props.viewTemplates}
 *	hotkeys={props.hotkeys}
 *	agenda-template={props.agendaTemplate}
 *	first-day-of-week={props.firstDayOfWeek}
 *	current-view={props.view} context-date={props.contextDate}
 *	timezone={props.timezone}
 *	security={props.security}
 *	events={props.events}
 *	sections={props.sections}
 *	header-templates={{
 *	[WORK_WEEK]: 'startMoment  startMoment.format(\'ddd, MMM D\') + \'-\' + endMoment.format(\'ddd, MMM D\') : \'\''
 * 	}}
 *	timelineVerticalLines={props.timelineVerticalLines}
 *	availableTimezones={props.availableTimezones}
 *	timelineDayTemplateRenderer={props.timelineDayTemplateRenderer}
 *	popoverContentState={props.popoverContentState}
 *	popoverEnabled={props.popoverEnabled}
 *	split-multi-day-event={props.splitMultiDayEvent}
 *	mark-spans={props.markSpans}
 *	>
 *		<div slot="event-popover">
 *	 		{props.popoverTemplate}
 *		</div>
 *		<div style={{display:"inline", marginLeft:"8px"}} slot="right-header-btns">
 *	 		<now-button label="Custom Action" on-click={() => dispatch('TOGGLE_LEFT_PANEL')}></now-button>
 *		</div>
 *	</now-calendar>
 * ```
 *
 * Slots:
 * - Provide slot content for `timeline-section-title` for  TIMELINE_DAY, TIMELINE_WEEK view section top-left area.
 * - Provide slot content for `left-header-slot` for header view top-left area.
 * - Provide slot content for `left-header-btns` for header top-left after left-header-slot.
 * - Provide slot content for `contextual-panel-content` for side panel content. Set this per the view id selected. See property `contextualPanelItems`.
 * - Provide slot content for `right-header-btns` for any custom button on the top right header of the calendar.
 * - Provide slot content for `event-popover` to set content for the event popover. See Action `NOW_CALENDAR#POPOVER_OPENED`.
 *
 * @seismicElement now-calendar
 * @summary An interactive calendar that can render and manage events in various views.
 */
createCustomElement('now-calendar', {
	...calendarRenderer,
	...calendarProps,
	...calendarView,
	...actionHandlers,
	...eventHandlers,
	...styles,
	behaviors: [rtlBehavior],
	dispatches: {
		/**
		 * Dispatched when a child component emits 'NOW_CALENDAR#TEMPLATE_COMPONENT_EVENT'
		 * Payload includes:
		 * 
		 * - `data`: Object. Any JSON payload.
		 * @type {Object}
		 */
		'NOW_CALENDAR#TEMPLATE_EVENT': {},
		/**
		 * Dispatched when the view changes.
		 *
		 * Payload includes:
		 *
		 * - `from`: String. The old view.
		 * - `to`: String. The new view.
		 *
		 * @type {{from: string, to: string}}
		 */
		'NOW_CALENDAR#VIEW_CHANGED': {},
		/**
		 * Dispatched when the current selected date changes on the calendar. This can be through explicit user selection or through navigation between next, previous, and today.
		 *
		 *
		 * Payload includes:
		 *
		 * - `fromMoment`: Moment. Old selection date as a Moment object.
		 * - `fromMS`: Number. Old selection date, in UTC milliseconds.
		 * - `toMoment`: Moment. New selection date, as a Moment object.
		 * - `toMS`: Number. New selection date, in UTC milliseconds.
		 * @type {{fromMoment: Moment, toMoment: Moment, fromMS: number, toMS: number}}
		 */
		'NOW_CALENDAR#CONTEXT_DATE_CHANGED': {},
		/**
		 * Dispatched when the range of dates visible on the calendar changes.
		 *
		 *
		 * Payload includes:
		 *
		 * - `startMoment`: Moment. Start date seen in the view, as a Moment object.
		 * - `endMoment`: Moment. End date seen in the view, as a Moment object.
		 * - `startMS`: Number. Start date seen in the view, in UTC milliseconds.
		 * - `endMS`: Number. End date seen in the view, in UTC milliseconds.
		 *
		 * @type {{startMoment: Moment, endMoment: Moment, startMS: number, endMS: number}}
		 */
		'NOW_CALENDAR#RANGE_UPDATED': {},
		/**
		 * Dispatched when an event is clicked.
		 *
		 * Payload includes:
		 *
		 * - `event`: Object. Event object that is clicked.
		 * - `chunkStartDateMoment`: Moment. If an event is split, start date of the part of the event which was clicked, as a Moment object.
		 * - `chunkEndDateMoment`: Moment. If an event is split, end date of the part of the event which was clicked, as a Moment object.
		 * - `chunkStartDateMS`: Number. If an event is split, start date of the part of the event which was clicked, in UTC milliseconds.
		 * - `chunkEndDateMS`: Number. If an event is split, end date of the part of the event which was clicked, in UTC milliseconds.
		 *
		 * @type {{ event: Object, chunkStartDateMoment: Moment, chunkEndDateMoment: Moment, chunkStartDateMS:  number, chunkEndDateMS: number}}
		 */
		'NOW_CALENDAR#EVENT_CLICKED': {},
		/**
		 * Dispatched when a calendar grid is clicked to create a new event.
		 *
		 * Payload includes:
		 *
		 * - `newStartMoment`: Moment. Start date of event requested, as a Moment object.
		 * - `newEndMoment`: Moment. End date of event requested, as a Moment object.
		 * - `newStartMS`: Number. Start date of event requested, in UTC milliseconds.
		 * - `newEndMS`: Number. End date of event requested, in UTC milliseconds.
		 *
		 * @type {{startDateMoment: Moment, endDateMoment: Moment, startDateMS: number, endDateMS: number}}
		 */
		'NOW_CALENDAR#GRID_CLICKED_NEW_EVENT': {},
		/**
		 * Dispatched when an event is moved through a drag operation.
		 *
		 * Payload includes:
		 *
		 * - `event`: Object. Event object that is being moved.
		 * - `difference`: Number. Difference in milliseconds from the current position. Can be negative or positive.
		 * - `newStartMoment`: Moment. New start date, as a Moment object.
		 * - `newEndMoment`: Moment. New end date, as a Moment object.
		 * - `newStartMS`: Number. New start date, in UTC milliseconds.
		 * - `newEndMS`: Number. New end date, in UTC milliseconds.
		 * - `group`: String. New section ID to which the event belongs. Populated in the case of a grouped timeline.
		 *
		 * @type {{event: Object, difference: number, newStartMoment: Moment, newEndMoment: Moment, newStartMS: number, newEndMS: number, group: string}}
		 */
		'NOW_CALENDAR#EVENT_MOVED': {},
		/**
		 * Dispatched when a drag operation to create a new event ends.
		 *
		 * Payload includes:
		 *
		 * - `newStartMoment`: Moment. Start date of the event requested, as a Moment object.
		 * - `newEndMoment`: Moment. End date of the event requested, as a Moment object.
		 * - `newStartMS`: Number. Start date of the event requested, in UTC milliseconds.
		 * - `newEndMS`: Number. End date of the event requested, in UTC milliseconds.
		 * - `group`: String. Section ID to which the event belongs.
		 *
		 * @type {{startDateMoment: Moment, endDateMoment: Moment, startDateMS: number, endDateMS: number, group: string}}
		 */
		'NOW_CALENDAR#DRAG_END_NEW_EVENT': {},
		/**
		 * Dispatched when an event's start or end dates are changed through resizing.
		 *
		 * Payload includes:
		 *
		 * - `event`: Object. Event object that is being resized.
		 * - `newStartMoment`: Moment. Start date of the event after resizing, as a Moment object.
		 * - `newEndMoment`: Moment. End date of event after resizing, as a Moment object.
		 * - `newStartMS`: Number. Start date of event after resizing, in UTC milliseconds.
		 * - `newEndMS`: Number. End date of event after resizing, in UTC milliseconds.
		 *
		 * @type {{event: Object, startDateMoment: Moment, endDateMoment: Moment, startDateMS: number, endDateMS: number}}
		 */
		'NOW_CALENDAR#EVENT_RESIZED': {},
		/**
		 * Dispatched when the popover provided with the calendar opens. Use this action to provide slot content for `event-popover`. Set property `popoverContentState` to `ready` once slot content for `event-popover` is ready.
		 *
		 * Payload includes:
		 *
		 * - `event`: Object. Event object that needs to be displayed in the popover.
		 *
		 * @type {{event: Object}}
		 */
		'NOW_CALENDAR#POPOVER_OPENED': {},
		/**
		 * Dispatched when the popover provided with the calendar closes. Use this action to set the property `popoverContentState` to `empty`.
		 *
		 *
		 * Payload is empty always
		 * @type {{}}
		 */
		'NOW_CALENDAR#POPOVER_CLOSED': {},
		/**
		 * Dispatched when a section of the timeline is toggled.
		 *
		 *
		 * Payload includes:
		 *
		 * - `section`: Object. Section that was clicked.
		 *
		 * @type {{section: Object}}
		 */
		'NOW_CALENDAR#TIMELINE_SECTION_TOGGLED': {},
		/**
		 * Dispatched when a blocked span rejects a drag or resize operation.
		 *
		 *
		 * Payload includes:
		 *
		 * - `causingBlockedSpan`: Object. Definition causing the rejection.
		 * - `event`: Object. Event that was rejected
		 * - `occurrenceDateStartMoment`: Moment. Start date of the blocked span instance, as a Moment object.
		 * - `occurrenceDateStartMS`: Number. Start date of the blocked span instance, in UTC milliseconds.
		 * - `occurrenceDateEndMoment`: Moment. End date of the blocked span instance, as a Moment object.
		 * - `occurrenceDateEndMS`: Number. End date of the blocked span instance, in UTC milliseconds.
		 * - `operation`: String. Type of operation that was rejected. Options include `move` , `resize` or `create`.
		 *
		 * @type {{causingBlockedSpan: Object, event: Object, occurrenceDateStartMoment: Moment, occurrenceDateEndMoment: Moment, occurrenceDateStartMS: number, occurrenceDateEndMS: number, operation: string}}
		 */
		'NOW_CALENDAR#REJECTED_BY_BLOCKED_SPAN': {},
		/**
		 * Dispatched when one of the icons in the flyer is clicked.
		 *
		 * Payload includes:
		 *
		 * - `viewId`: String. Contextual Panel view to display. This is tied to the id attribute set in property `contextualPanelItems`.
		 *
		 * @type {{viewId: string}}
		 */
		'NOW_CALENDAR#SET_CONTEXTUAL_PANEL_VIEW': {},
		/**
		 * Dispatched when the timezone is changed from the timezone picker.
		 *
		 * Payload includes:
		 *
		 * - `from`: String. The old timezone.
		 * - `to`: String. The new timezone.
		 *
		 * @type {{from: string, to: string}}
		 */
		'NOW_CALENDAR#TIMEZONE_CHANGED': {},
	}
});

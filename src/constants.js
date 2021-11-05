
export const INTERNAL_FORMAT = {
	DATE: 'YYYY-MM-DD',
	TIME: 'HH:mm:ss',
	DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
	DATE_DISPLAY_FORMAT: 'ddd, MMM D',
	TIME_DISPLAY_FORMAT: 'HH:mm',
	ARIA_DATE_FORMAT: 'dddd, MMMM Do YYYY',
	ARIA_DATE_TIME_FORMAT: 'dddd, MMMM Do YYYY HH:mm',
	DAY: 'dddd',
	ONLY_DATE: 'DD',
	DATE_MONTH_ABBR: 'MMM D'
};

export const WEEK_DAYS = {
	SUNDAY: 0,
	MONDAY: 1,
	TUESDAY: 2,
	WEDNESDAY: 3,
	THURSDAY: 4,
	FRIDAY: 5,
	SATURDAY: 6
};

export const DIRECTION = {
	LTR: 'ltr',
	RTL: 'rtl',
	LEFT: 'left',
	RIGHT: 'right',
	UP: 'up',
	DOWN: 'down'
};

export const POSITION = {
	START: 'start',
	END: 'end'
};

const ACTION_PREFIX = 'NOW_CALENDAR#';
export const ACTIONS = {
	INITIALIZED: `${ACTION_PREFIX}INITIALIZED`,
	VIEW_CHANGED: `${ACTION_PREFIX}VIEW_CHANGED`,
	CONTEXT_DATE_CHANGED: `${ACTION_PREFIX}CONTEXT_DATE_CHANGED`,
	RANGE_UPDATED: `${ACTION_PREFIX}RANGE_UPDATED`,
	INTERNAL_STATE_SET:`${ACTION_PREFIX}INTERNAL_STATE_SET`,
	TOGGLE_POPOVER: `${ACTION_PREFIX}TOGGLE_POPOVER`,
	EVENT_CLICKED: `${ACTION_PREFIX}EVENT_CLICKED`,
	GRID_CLICKED_NEW_EVENT: `${ACTION_PREFIX}GRID_CLICKED_NEW_EVENT`,
	EVENT_MOVED: `${ACTION_PREFIX}EVENT_MOVED`,
	DRAG_END_NEW_EVENT: `${ACTION_PREFIX}DRAG_END_NEW_EVENT`,
	EVENT_RESIZED: `${ACTION_PREFIX}EVENT_RESIZED`,
	POPOVER_OPENED: `${ACTION_PREFIX}POPOVER_OPENED`,
	POPOVER_CLOSED: `${ACTION_PREFIX}POPOVER_CLOSED`,
	TIMELINE_SECTION_TOGGLED: `${ACTION_PREFIX}TIMELINE_SECTION_TOGGLED`,
	NOW_DROPDOWN_SELECTED_ITEMS_SET: 'NOW_DROPDOWN#SELECTED_ITEMS_SET',
	SET_CONTEXTUAL_PANEL_VIEW: `${ACTION_PREFIX}SET_CONTEXTUAL_PANEL_VIEW`,
	TIMEZONE_CHANGED: `${ACTION_PREFIX}TIMEZONE_CHANGED`,
	REJECTED_BY_BLOCKED_SPAN: `${ACTION_PREFIX}REJECTED_BY_BLOCKED_SPAN`,
	NOW_DROPDOWN_OPENED_SET: 'NOW_DROPDOWN#OPENED_SET',
	TEMPLATE_EVENT: `${ACTION_PREFIX}TEMPLATE_EVENT`,
	TEMPLATE_COMPONENT_EVENT: `${ACTION_PREFIX}TEMPLATE_COMPONENT_EVENT`
};

export const VIEWS = {
	MONTH: 'MONTH',
	COLUMN: 'COLUMN',
	WEEK: 'WEEK',
	DAY: 'DAY',
	TIMELINE_DAY: 'TIMELINE_DAY',
	TIMELINE_WEEK: 'TIMELINE_WEEK'
};

export const TYPES = {
	CALENDAR: 'Calendar',
	TIMELINE: 'Timeline'
};

export const DEFAULT_TEMPLATES = {
	DATE_PICKER_TEMPLATE_FOR_WEEK: {
		MONTH_FIRST: 'startMoment ? startMoment.date() > endMoment.date() ? startMoment.month() == 11 ? startMoment.format(\'MMMM DD YYYY\') + \' - \' + endMoment.format(\'MMMM DD YYYY\') :  startMoment.format(\'MMMM DD\') + \' - \' + endMoment.format(\'MMMM DD YYYY\') : startMoment.format(\'MMMM \') + startMoment.format(\'DD\') + \' - \' + endMoment.format(\'DD YYYY\') : \'\'',
		DATE_FIRST: 'startMoment ? startMoment.date() > endMoment.date() ? startMoment.month() == 11 ? startMoment.format(\'DD MMMM YYYY\') + \' - \' + endMoment.format(\'DD MMMM YYYY\') :  startMoment.format(\'DD MMMM\') + \' - \' + endMoment.format(\'DD MMMM YYYY\') : startMoment.format(\'DD\') + \' - \' + endMoment.format(\'DD MMMM YYYY\') : \'\''
	},
	DATE_PICKER_TEMPLATE_FOR_DAY: {
		MONTH_FIRST: 'startMoment ? startMoment.format(\'dddd  MMMM DD YYYY\') : \'\'',
		DATE_FIRST: 'startMoment ? startMoment.format(\'dddd  DD MMMM YYYY\') : \'\''
	},
	DATE_PICKER_TEMPLATE_FOR_MONTH: {
		MONTH_FIRST: 'startMoment ? startMoment.clone().add(10, \'days\').format(\'MMMM YYYY\') : \'\'',
		DATE_FIRST: 'startMoment ? startMoment.clone().add(10, \'days\').format(\'MMMM YYYY\') : \'\''
	}
};

export const WHEN_OUT_OF_MODE_OPTIONS = {
	HIDE: 'hide',
	DISABLE: 'disable'
};

export const POPOVERS = {
	DATE_PICKER: 'datePicker',
	EVENT: 'event',
	SETTINGS: 'settings'
};

export const POPOVER_STATE = {
	READY: 'ready',
	PENDING: 'pending',
	RENDERED: 'rendered',
	EMPTY: 'empty',
	DESTROYED: 'destroyed'
};

export const EVENTS  = {
	MOUSE_CLICKED: 'click',
	KEY_DOWN: 'keydown'
};

export const EVENT_TYPES = {
	MOVE: 'move',
	CREATE: 'create',
	RESIZE: 'resize',
	CLICK_CREATE: 'click_create',
	AGENDA_DRAG: 'agenda_drag'
};

export const EVENT_STATES = {
	ONDRAGSTART: 'ondragstart',
	ONDRAG: 'ondrag',
	ONDRAGEND: 'ondragend',
	ONDRAGLEAVE: 'ondragleave',
	ONCLICK: 'onclick'
};

export const GRADIENT = {
	ANGLE: '45',
	LINE_WIDTH: '5'
};

export const KEYS = {
	D: 68,
	E: 69,
	F: 70,
	N: 78,
	P: 80,
	T: 84,
	S: 83,
	ENTER: 13,
	ESC: 27,
	TAB: 9,
	LEFT: 37,
	UP: 38,
	RIGHT: 39,
	DOWN: 40,
	FSLASH: 191,
	MODIFIER: {
		SHIFT: 'shiftKey',
		CTRL: 'ctrlKey',
		ALT: 'altKey',
		META: 'metaKey'
	}
};

export const INTERNAL_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
export const ROW_SPAN_HEIGHT_IN_PX = 80;
export const TEMPLATE_TYPE = {
	COMPONENT: 'component',
	MACROPONENT: 'macroponent'
}
export const RESIZABLE_HANDLE_HEIGHT = 20;
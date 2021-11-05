import { WEEK_DAYS, VIEWS, DEFAULT_TEMPLATES, INTERNAL_FORMAT, POPOVERS, POPOVER_STATE } from './constants';
import { jsonParse, toMoment, Log } from './util';
import { t } from 'sn-translate';
import moment from 'moment-timezone';
import { CalendarUIDataProvider } from "./util/calendarUIDataProvier";
import { TimelineFactory } from "./body-views/timeline/timeline-view";
const DefaultDatePickerTemplates = {
	[VIEWS.DAY]: DEFAULT_TEMPLATES.DATE_PICKER_TEMPLATE_FOR_DAY,
	[VIEWS.WEEK]: DEFAULT_TEMPLATES.DATE_PICKER_TEMPLATE_FOR_WEEK,
	[VIEWS.MONTH]: DEFAULT_TEMPLATES.DATE_PICKER_TEMPLATE_FOR_MONTH,
	[VIEWS.TIMELINE_DAY]: DEFAULT_TEMPLATES.DATE_PICKER_TEMPLATE_FOR_DAY,
	[VIEWS.TIMELINE_WEEK]: DEFAULT_TEMPLATES.DATE_PICKER_TEMPLATE_FOR_WEEK
};

const DefaultAriaConfig = {
	ariaTitle: t('Calendar Widget'),
	ariaBodyTitle: t('Calendar Widget Main Area'),
};
/**
 *
 * @param {string=} dir
 */
function getDefaultDir(dir) {
	if (!dir || dir === 'default')
		return document.dir || getComputedStyle(document.body).direction || 'ltr';
	return dir;
}


/**
 *
 * @param {string=} lang
 */
function getDefaultLang(lang) {
	if (!lang || lang === 'default')
		return navigator.language || 'en';
	return lang;
}

/**** Dev Note: Update JS Doc in now-calendar-readme-gen.js on API change ****/
const CalendarProperties = {

	externalEvent: {
		default: null,
		"schema": {
			"anyOf": [{
				"type": "object",
				"properties": {
					"id": {
						"type": "string"
					},
					"duration": {
						"type": "number"
					},
					"startPositionDifference": {
						"type": "number"
					},
					"originatedFromInternal": {
						"type": "boolean"
					}
				}
			},
			{ "type": "string" },
			{ "type": "null" }]
		}
	},

	/**
	 * @type {Array<RawCalendarEvent>}
	 */
	events: {
		default: [],
		"schema": {
			"type": "array",
			"$id": "#event_item",
			"items": {
				"type": "object",
				"properties": {
					"id": {
						"type": "string"
					},
					"title": {
						"type": "string"
					},
					"description": {
						"type": "string"
					},
					"bgColor": {
						"type": "string"
					},
					"start": {
						"anyOf": [
							{
								"type": "string"
							},
							{
								"type": "number"
							}
						]
					},
					"end": {
						"anyOf": [
							{
								"type": "string"
							},
							{
								"type": "number"
							}
						]
					},
					"gradientColor1": {
						"type": "string"
					},
					"gradientColor2": {
						"type": "string"
					},
					"childEvents": {
						"$ref": "#event_item"
					}
				},
				"required": [
					"start",
					"end"
				]
			}
		}
	},
	/**
	 * @type {Array<RawSectionItem>}
	 */
	sections: {
		default: [],
		"schema": {
			"$id": "#section_item",
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"id": {
						"type": "string"
					},
					"title": {
						"type": "string"
					},
					"isCollapsed": {
						"type": "boolean"
					},
					"showHeader": {
						"type": "boolean"
					},
					"textColor": {
						"type": "string"
					},
					"children": {
						"type": "array",
						"items": {
							"$ref": "#"
						}
					}
				},
				"required": ["id"],
				"optional": ["children"]

			}
		}
	},
	/**
	 * @type {string}
	 */
	timezone: {
		default: 'GMT',
		reflect: true,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {string}
	 */
	locale: {
		default: getDefaultLang(),
		reflect: true,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {*}
	 */
	currentMode: {
		/**
		 * This property can still be used without setting
		 * any value for availableModes.
		 */
		reflect: true,
		schema: {
			type: 'object',
			properties: {},
			additionalProperties: true
		}
	},
	/**
	 * @type {Array<{mode: string, icon: string, label: string}>}
	 */
	availableModes: {
		/**
		 * [{
		 *  mode: string,
		 *  icon: string,
		 *  label: string
		 * }]
		 * This enables the display of mode buttons.
		 */
		default: [],
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					mode: {
						type: 'string'
					},
					icon: {
						type: 'string',
					},
					label: {
						type: 'string'
					}
				},
				additionalProperties: true
			}
		}
	},
	/**
	 * @type {Array<string>}
	 */
	availableViews: {
		/**
		 * [{
		 * 	viewProvider: one of VIEWS.*,
		 *  view: string,
		 *  label: string,
		 *  type: string
		 * }] - OR - ['viewProvider String']
		 */
		default: [VIEWS.DAY, VIEWS.WEEK, VIEWS.MONTH],
		schema: {
			type: "array",
			items: {
				type: "object",
				properties: {
					view: {
						type: "string"
					},
					viewProvider: {
						type: "string"
					},
					label: {
						type: "string"
					},
					type: {
						oneOff: [
							{
								type: "Calendar"
							},
							{
								type: "Timeline"
							}
						]
					}
				}
			},
			required: [
				"view",
				"viewProvider",
				"label",
				"type"
			]
		}
	},
	/**
	 * @type {string}
	 */
	currentView: {
		default: VIEWS.WEEK,
		reflect: true,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {Record<string, any>}
	 */
	viewSettings: {
		default: {},
		schema: {
			type: "object",
			properties: {
			},
			additionalProperties: true
		}
	},
	/**
	 * @type {Array<HotkeyConfig>}
	 */
	hotkeys: {
		default: [],
		"schema": {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"eventName": {
						"type": "string"
					},
					"selector": {
						"type": "string"
					},
					"keyCode": {
						"type": "number"
					},
					"name": {
						"type": "string"
					},
					"view": {
						"type": "string"
					},
					"info": {
						"type": "object",
						"properties": {
							"next": {
								"type": "object",
								"properties": {
									"keyName": {
										"type": "string"
									},
									"description": {
										"type": "string"
									}
								}
							},
							"previous": {
								"type": "object",
								"properties": {
									"keyName": {
										"type": "string"
									},
									"description": {
										"type": "string"
									}
								}
							}
						}
					}
				},
				"additionalProperties": true
			}
		}
	},
	/**
	 * @type {Function}
	 */
	agendaTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {Moment}
	 */
	contextDate: {
		reflect: true,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {Record<string, string>}
	 */
	datePickerTemplates: {
		default: {},
		schema: {
			type: 'object',
			properties: {
			},
			additionalProperties: true
		}
	},
	/**
	 * @type {Record<string, string>}
	 */
	configAria: {
		default: {},
		schema: {
			type: 'object',
			properties: {},
			additionalProperties: true
		}
	},
	/**
	 * @type {number}
	 */
	firstDayOfWeek: {// Integer 0-Sunday,1-Monday,....6-Saturday
		default: WEEK_DAYS.SUNDAY,
		schema: {
			type: 'number',
			minimum: 0,
			maximum: 6
		}
	},
	/**
	 * @type {string}
	 */
	dateFormat: {
		default: INTERNAL_FORMAT.DATE,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {string}
	 */
	timeFormat: {
		default: INTERNAL_FORMAT.TIME_DISPLAY_FORMAT,
		schema: {
			type: 'string'
		}
	},
	/**
	 * @type {Array<MarkspanItem>}
	 */
	markSpans: {
		default: [],
		"schema": {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"startDate": {
						"type": "string"
					},
					"endDate": {
						"type": "string"
					},
					"occurrenceDays": {
						"type": "array",
						"items": {
							"type": "number"
						}
					},
					"zones": {
						"type": "array",
						"items": {
							"startTime": {
								"type": "string"
							},
							"endTime": {
								"type": "string"
							}
						}
					},
					"textColor": {
						"type": "string"
					},
					"bgColor": {
						"type": "string"
					},
					"block": {
						"type": "boolean"
					},
					"title": {
						"type": "string"
					},
					"timezone": {
						"type": "string"
					}
				}
			},
			"additionalProperties": true
		}
	},
	/**
	 * @type {CalendarSecuritySettings}
	 */
	security: {
		default: {
			readOnly: false,
			allowCreate: true,
			allowMove: true,
			allowResize: true
		},
		schema: {
			type: 'object',
			properties: {
				readOnly: {
					type: "boolean"
				},
				allowCreate: {
					type: "boolean"
				},
				allowMove: {
					type: "boolean"
				},
				allowResize: {
					type: "boolean"
				}
			}
		}
	},
	/**
	 * @type {{value: string}}
	 */
	popoverContentState: {
		default: { value: POPOVER_STATE.EMPTY },
		schema: {
			type: "object",
			properties: {
				value: { type: 'string' },
				timestamp: { type: 'number' }
			}
		}
	},
	/**
	 * @type {boolean}
	 */
	popoverEnabled: {
		default: false,
		schema: {
			type: "boolean"
		}
	},
	/**
	 * @type {boolean}
	 */
	splitMultiDayEvent: {
		default: false,
		schema: {
			type: "boolean"
		}
	},
	/**
	 * @type {DayTemplateRenderer}
	 */
	dayTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {WeekTemplateRenderer}
	 */
	weekTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {MonthTemplateRenderer}
	 */
	monthTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {TimelineTemplateRenderer}
	 */
	timelineDayTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {TimelineWeekTemplateRenderer}
	 */
	timelineWeekTemplateRenderer: {
		default: null,
		"schema": {
			"anyOf": [
				{ "type": "string" },
				{ "type": "null" }
			]
		}
	},
	/**
	 * @type {Array<TimelineVerticalLineDef>}
	 */
	timelineVerticalLines: {
		default: [],
		schema: {
			type: 'array',
			items: {
				type: "object",
				properties: {
					meta: {
						type: 'object',
						properties: {},
						additionalProperties: true
					},
					inlineStyle:
					{
						type: 'object',
						properties: {},
						additionalProperties: true
					},
					utcMS: { type: 'number' }
				}
			}
		}
	},
	/**
	 * @type {Array<SidebarItem>}
	 */
	contextualPanelItems: {
		default: [],
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					icon: { type: 'string' },
					id: { type: 'string' },
					label: { type: 'string' }
				},
				additionalProperties: true
			}
		}
	},
	/**
	 * @type {CustomizableLableConfig}
	 */
	customizableLabels: {

		default: {
			newButton: {
				text: t("New")
			},
			agendaEmptyState: {
				text: t("No Events Scheduled"),
				subText: t("")
			}
		},
		"schema": {
			"type": "object",
			"properties": {
				"newButton": {
					"type": "object",
					"properties": {
						"text": {
							"type": "string"
						}
					}
				},
				"agendaEmptyState": {
					"type": "object",
					"properties": {
						"text": {
							"type": "string"
						},
						"subtext": {
							"type": "string"
						}
					}
				}
			},
			"additionalProperties": true
		}
	},
	/**
	 * @type {Array<TimezoneConfig>}
	 */
	availableTimezones: {
		default: [],
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {
						type: 'string'
					},
					label: {
						type: 'string'
					}
				}
			}
		}
	},
	enableNewButton: {
		default: true,
		"schema": {
			"type": "boolean"
		}
	},
	enableNewCalendarClick: {
		default: true,
		"schema": {
			"type": "boolean"
		}
	}
};

export default {
	properties: CalendarProperties,
	initialState: {
		popOvers: {
			[POPOVERS.DATE_PICKER]: false,
			//[POPOVERS.EVENT]: false,
			[POPOVERS.SETTINGS]: false
		},
		tooltip: {
			id: '',
			ref: null,
			content: ''
		},
		contextualPanelCurrentView: 'agenda-view',
		agendaViewSectionEvents: {}
	},
	/**
	 * 
	 * @param {CalendarState} state 
	 */
	transformState(state) {
		const { properties: props } = state;
		props.dir = getDefaultDir(props.dir);
		props.locale = getDefaultLang(props.locale);
		let timezone = props.timezone;
		let availableTimezones = props.availableTimezones;

		if (availableTimezones.length === 0) {
			Log.error('availableTimezones does not contain information about timezone');
			availableTimezones = [{
				name: timezone,
				label: timezone
			}];
		}
		else {
			let timezoneFound = false;

			props.availableTimezones.forEach((availableTimezone) => {
				if (availableTimezone.name === timezone) {
					timezoneFound = true;
				}
			});

			if (!timezoneFound) {
				Log.error('availableTimezones does not contain information about timezone');
				availableTimezones.push({
					name: timezone,
					label: timezone
				});
			}
		}

		return {
			...state,
			todayMoment: toMoment(Date.now(), props.timezone),
			properties: {
				...props,
				configAria: jsonParse(props.configAria, DefaultAriaConfig),
				datePickerTemplates: jsonParse(props.datePickerTemplates, DefaultDatePickerTemplates),
				availableTimezones
			}
		};
	}
};

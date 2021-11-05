import _ from "lodash";
import { createUpdateStateEffect } from "@servicenow/ui-effect-update-state";
import { actionTypes } from "@servicenow/ui-core";
import {
	ACTIONS,
	POPOVERS,
	VIEWS,
	INTERNAL_FORMAT,
	TEMPLATE_TYPE,
} from "./constants";
import { ActionHandlers as HeaderActionHandlers } from "./header-view";
import { ViewActionHandlers as BodyActionHandlers } from "./body-views";
import { getTemplates, getComponentsByTagNames } from "./library-uxf";
import { CalendarUIDataProvider } from "./util/calendarUIDataProvier";
import {
	parseEvents,
	Log,
	getCurrentViewProvider,
	processAvailableViewsConfig,
	isDebugMode,
	createPopoverTarget,
	deletePopoverTarget,
	addShortcut,
	anyToMoment,
	toMoment,
} from "./util";
import { reset } from "./keyboard-action-handlers";
import {
	TimelineViewBase,
	TimelineFactory,
} from "./body-views/timeline/timeline-view";
import { CalendarEvent } from "./util/calendarEvent";
import { closePopover } from "./event-handlers";
import { isMoment } from "moment";

/**
 * This module provides the actionHandlers configuration and has little magic
 * up its sleeve. It is responsible to pull action handlers from various sources
 * like the header view and body views. This way action handler codes can co-exist
 * with the views where they are most relevant. For body views specifically it ensures
 * that the action handlers registered by them are only run when the respective
 * view is active.
 */

const AllActionHandlers = {};

function proxyViewCaller(f, onlyForView, ...args) {
	const coeffect = args[args.length - 1];
	const { state, properties } = coeffect;
	state.properties = properties;
	const currentViewProvider = getCurrentViewProvider(state);
	if (currentViewProvider === onlyForView) return f.apply(this, args);
}

function populateAllActionHandlers(actionHandlers, onlyForView) {
	for (let action in actionHandlers) {
		if (action === ACTIONS.INTERNAL_STATE_SET) {
			Log.error(
				`Cannot register listeners for ${ACTIONS.INTERNAL_STATE_SET} action`
			);
			return;
		}
		let handlers = AllActionHandlers[action];
		if (!handlers) {
			handlers = [];
			AllActionHandlers[action] = handlers;
		}
		let ah = actionHandlers[action];
		if (onlyForView) {
			if (typeof ah === "function") {
				ah = {
					args: [],
					effect: proxyViewCaller.bind(null, ah, onlyForView),
				};
			} else {
				ah = {
					...ah,
					effect: proxyViewCaller.bind(null, ah.effect, onlyForView),
				};
			}
			handlers.push(ah);
		} else {
			if (typeof ah === "function")
				ah = {
					args: [],
					effect: ah,
				};
			handlers.push(ah);
		}
	}
}

populateAllActionHandlers(HeaderActionHandlers, false);

function populateAllBodyActionHandlers() {
	for (let viewName in BodyActionHandlers) {
		let actionHandlers = BodyActionHandlers[viewName];
		if (actionHandlers) {
			populateAllActionHandlers(actionHandlers, viewName);
		}
	}
}
populateAllBodyActionHandlers();

function runActionHandlers(actionName, context) {
	if (isDebugMode())
		Log.info("Action:", actionName, "with coeffect:", context.coeffects);
	let handlers = AllActionHandlers[actionName] || [];
	handlers = handlers.map((h) => {
		return { effect: h.effect, args: [...h.args, context.coeffects] };
	});
	return {
		...context,
		effects: [
			//...context.effects, We do not run the main effect as it is always noop in this case
			...handlers,
		],
	};
}

function createActionHandlerRunner(actionName) {
	return {
		effect: function noop() {
			/* No op main effect */
		},
		args: [],
		interceptors: [runActionHandlers.bind(null, actionName)],
	};
}

const ActionHandlers = {};
_.union(Object.values(ACTIONS), [
	actionTypes.COMPONENT_BOOTSTRAPPED,
	actionTypes.COMPONENT_CONNECTED,
	actionTypes.COMPONENT_PROPERTY_CHANGED,
	actionTypes.COMPONENT_DISCONNECTED,
	actionTypes.COMPONENT_RENDERED,
]).forEach((a) => {
	ActionHandlers[a] = createActionHandlerRunner(a);
});

/********************** */
/* Core Action Handlers */
/********************** */

ActionHandlers[ACTIONS.INTERNAL_STATE_SET] = createUpdateStateEffect(
	(state, action) => {
		if (!action.payload) return;
		return {
			...state,
			...action.payload,
		};
	}
);

ActionHandlers[ACTIONS.TOGGLE_POPOVER] = ({ action, dispatch, state }) => {
	/** Dispatch action to parent for resetting popover slot content */
	const { properties: props } = state;
	closePopover(state, dispatch);
	const { popOver } = action.payload;
	if (popOver === POPOVERS.EVENT) {
		/** Event popover is already open */
		if (
			state.popOvers.event &&
			state.popOvers.event.opened &&
			state.popOvers.event.target &&
			state.popOvers.event.target === action.payload.eventEl
		) {
			dispatch(ACTIONS.INTERNAL_STATE_SET, { popOvers: { event: { id: "" } } });
		} else {
			if (state.properties.popoverEnabled) {
				/** Open event popover */
				const targetRef = createPopoverTarget(
					action.payload.eventEl,
					action.payload.pos,
					state
				);
				state.popoverEl.target = targetRef;
				state.popoverEl.container = state.popoverContainerEl;
				/** Dispatch action to parent for getting popover slot content */
				dispatch(ACTIONS.POPOVER_OPENED, {
					event: { ...action.payload.event },
					parentEvent: { ...action.payload.parentEvent },
					isChildEvent: action.payload.isChildEvent,
					timestamp: Date.now(),
				});
				dispatch(ACTIONS.INTERNAL_STATE_SET, {
					popOvers: {
						event: {
							id: action.payload.event.id,
							opened: true,
							target: action.payload.eventEl,
							targetRef: targetRef,
						},
					},
				});
			}
		}
	} else if (popOver === POPOVERS.SETTINGS) {
		if (state.popOvers[popOver]) {
			dispatch(ACTIONS.POPOVER_CLOSED);
			dispatch(ACTIONS.INTERNAL_STATE_SET, {
				popOvers: {},
				showKeyBoardShortCuts: false,
			});
			if (state.popOvers[POPOVERS.SETTINGS].target)
				state.popOvers[POPOVERS.SETTINGS].target.focus();
		} else {
			dispatch(ACTIONS.INTERNAL_STATE_SET, {
				popOvers: {
					[popOver]: {
						opened: true,
						target: action.payload.eventEl,
					},
				},
				showKeyBoardShortCuts: false,
			});
		}
	} else {
		/** Toggle non-event popover */
		dispatch(ACTIONS.INTERNAL_STATE_SET, {
			popOvers: {
				[popOver]: !state.popOvers[popOver],
			},
		});
	}
};

ActionHandlers[ACTIONS.NOW_DROPDOWN_SELECTED_ITEMS_SET] = ({
	action,
	dispatch,
	state,
}) => {
	const { payload } = action;

	if (payload.dropdown === "timezone" && payload.value.length > 0) {
		dispatch("PROPERTIES_SET", { timezone: payload.value[0] });
		dispatch(ACTIONS.TIMEZONE_CHANGED, {
			from: state.properties.timezone,
			to: payload.value[0],
		});
	}

	if (payload.dropdown === "view" && payload.value.length > 0) {
		dispatch("PROPERTIES_SET", { currentView: payload.value[0] });
	}
};

/********************** */
/* Base Action Handlers */
/********************** */

function handleContextDateChange(value, state, dispatch) {
	const { properties: props } = state;
	if (value || (!value && !state.contextMoment)) {
		let newValue = anyToMoment(value, props).startOf("D");
		let oldValue = state.contextMoment
			? state.contextMoment.clone()
			: state.contextMoment;
		dispatch.updateState({ contextMoment: newValue });
		if (
			!oldValue ||
			(isMoment(oldValue) &&
				oldValue.clone().startOf("D").valueOf() !==
					newValue.clone().startOf("D").valueOf())
		)
			dispatch(ACTIONS.CONTEXT_DATE_CHANGED, {
				fromMoment: oldValue,
				toMoment: newValue,
				fromMS: oldValue ? oldValue.valueOf() : oldValue,
				toMS: newValue.valueOf(),
			});
	}
}

/**
 *
 * @param {import('..').PropertyChangePayload<"sections">} payload
 * @param {import('..').CalendarState} state
 * @param {import('..').appDispatch} dispatch
 */

function handleSectionChange(payload, state, dispatch) {
	if (!Array.isArray(payload) && !Array.isArray(payload.value)) {
		let newSections = payload.value.changes;
		if (Array.isArray(newSections)) {
			if (payload.value.operation === "set")
				state.dataProvider.initializeSectionStore();

			for (let i = 0; i < newSections.length; i++) {
				if (!newSections[i]) continue;
				switch (payload.value.operation) {
					case "add":
						state.dataProvider.addSection(newSections[i]);
						break;
					case "modify":
						state.dataProvider.modifySection(newSections[i]);
						break;
					case "set":
						state.dataProvider.addSection(newSections[i]);
						break;
					case "remove":
						state.dataProvider.removeEventById(newSections[i].id);
						break;
				}
			}
		}
	} else {
		state.dataProvider.initializeSectionStore();
		let sections = [];
		if (Array.isArray(payload)) sections = payload;
		else if (Array.isArray(payload.value)) sections = payload.value;
		state.dataProvider.addSections(sections);
	}
}
/**
 *
 * @param {import('..').PropertyChangePayload<"events">} payload
 * @param {import('..').CalendarState} state
 * @param {import('..').appDispatch} dispatch
 */
function handleEventsChange(payload, state, dispatch) {
	const { properties: props } = state;
	let MAX_EVENTS = 15000;
	if (
		props.currentView === VIEWS.TIMELINE_DAY ||
		props.currentView === VIEWS.TIMELINE_WEEK
	)
		MAX_EVENTS = 50000;
	if (!Array.isArray(payload) && !Array.isArray(payload.value)) {
		const newEvents = payload.value;
		if (!newEvents) return;
		/**
		 * @type {Array<import('..').RawCalendarEvent>}
		 */
		let deltaChanges = newEvents.changes;
		if (Array.isArray(deltaChanges)) {
			if (newEvents.operation === "set")
				state.dataProvider.initiateEventStore();
			deltaChanges = deltaChanges.slice(0, MAX_EVENTS);
			for (let i = 0; i < deltaChanges.length; i++) {
				if (!deltaChanges[i]) continue;

				switch (newEvents.operation) {
					case "add":
					case "modify":
					case "set":
						{
							let newEvent = new CalendarEvent(deltaChanges[i]);
							newEvent.setTimezone(props.timezone);
							state.dataProvider.addEvent(newEvent);
						}
						break;
					case "remove":
						state.dataProvider.removeEventById(deltaChanges[i].id);
						break;
				}
			}
		}
	} else {
		let events = [];
		if (Array.isArray(payload))
			events = parseEvents(payload.slice(0, MAX_EVENTS), props.timezone);
		else if (Array.isArray(payload.value))
			events = parseEvents(payload.value.slice(0, MAX_EVENTS), props.timezone);

		const dataProvider = state.dataProvider;
		dataProvider.initiateEventStore();
		for (const event of events) dataProvider.addEvent(event);
	}
	let providerVersion =
		typeof state.dataProviderVersion !== "number"
			? 0
			: state.dataProviderVersion;
	dispatch(ACTIONS.INTERNAL_STATE_SET, {
		dataProviderVersion: providerVersion,
		temporaryEventSettings: null,
	});
}

function registerHotkeys(value, state, dispatch) {
	if (value) {
		value.forEach((v) => {
			addShortcut(v.eventName, v.selector, v.keyCode, v.viewName);
		});
	}
}

function resetKeyhandler(state, dispatch) {
	reset(state, dispatch);
}
/**
 *
 * @param {Record<string, {templates: Record<string, import('..').CalendarTemplateItem>}>} viewSettings
 * @param {import('..').CalendarState} state
 * @param {import('..').appDispatch} dispatch
 */
async function loadViewTemplates(viewSettings, state, updateState) {
	const toBeLoadedMacroponentSysIds = [];
	const toBeLoadedComponents = [];
	for (const viewName in viewSettings) {
		const viewTemplates = viewSettings[viewName].templates || {};
		for (const templateName in viewTemplates) {
			/**
			 * @type {import('..').CalendarTemplateItem}
			 */
			const currentTemplate = viewTemplates[templateName] || {
				value: "",
				type: "",
			};
			if (
				typeof currentTemplate.value !== "string" ||
				currentTemplate.value.length === 0
			)
				continue;

			if (currentTemplate.type === TEMPLATE_TYPE.MACROPONENT) {
				let tagName = currentTemplate.value;
				if (!tagName.startsWith(`${TEMPLATE_TYPE.MACROPONENT}-`))
					tagName = `${TEMPLATE_TYPE.MACROPONENT}-${currentTemplate.value}`;
				if (!customElements.get(tagName))
					toBeLoadedMacroponentSysIds.push(
						currentTemplate.value.replace(`${TEMPLATE_TYPE.MACROPONENT}-`, "")
					);
			} else if (currentTemplate.type === TEMPLATE_TYPE.COMPONENT) {
				if (currentTemplate.value.indexOf("-") === -1) continue;
				if (!customElements.get(currentTemplate.value))
					toBeLoadedComponents.push(currentTemplate.value);
			}
		}
	}
	if (toBeLoadedComponents.length > 0)
		await getComponentsByTagNames(toBeLoadedComponents);
	if (toBeLoadedMacroponentSysIds.length > 0)
		await getTemplates(toBeLoadedMacroponentSysIds);
	// force rerender. Otherwise template components will not be renderered till mousehover or so property changes
	updateState({ templatesLoadTime: Date.now() });
}

function updateDateFormat(state) {
	const { properties: props } = state;
	const { dateFormat } = props;
	if (dateFormat.indexOf("MM") > dateFormat.toUpperCase().indexOf("DD")) {
		INTERNAL_FORMAT.ARIA_DATE_FORMAT = "dddd, Do MMMM YYYY";
		INTERNAL_FORMAT.ARIA_DATE_TIME_FORMAT = "dddd, Do MMMM YYYY HH:mm";
	}
}

const BaseActionHandlers = {
	[actionTypes.COMPONENT_BOOTSTRAPPED]: ({
		properties,
		state,
		dispatch,
		updateState,
		action: {
			payload: { host },
		},
	}) => {
		Log.info("Bootstrapped", host);
		state.properties = properties;
		if (!host.style.display) host.style.display = "block"; // Custom element does not take height, unless display is set

		const { properties: props } = state;
		loadViewTemplates(properties.viewSettings, state, updateState);
		processAvailableViewsConfig(state, dispatch);
		dispatch.updateState({
			dataProvider: new CalendarUIDataProvider(),
			timelineView: TimelineFactory(),
			componentInitialized: true,
			hostHeight: host.style.height,
		});
		setTimeout(() => {
			dispatch.updateState(({ state, properties }) => {
				const props = properties;
				const newState = { ...state, properties };
				state = newState;
				dispatch(ACTIONS.INITIALIZED);
				if (!state.contextMoment)
					handleContextDateChange(
						props.contextDate ||
							toMoment(Date.now(), props.timezone).startOf("D"),
						state,
						dispatch
					);
				handleSectionChange(props.sections, state, dispatch);
				handleEventsChange(props.events, state, dispatch);
				registerHotkeys(props.hotkeys, state, dispatch);
				dispatch(ACTIONS.VIEW_CHANGED, { from: null, to: props.currentView });
				updateDateFormat(state);
				return {
					shouldUpdate: true,
					shouldRender: true,
				};
			});
		}, 0);
	},
	/**
	 * @param {{properties: import('..').CalendarProperties, state: import('..').CalendarState, dispatch: appDispatch}} param0
	 */
	[actionTypes.COMPONENT_PROPERTY_CHANGED]: ({
		properties,
		state,
		dispatch,
		updateState,
		updateProperties,
		action,
	}) => {
		state.properties = properties;
		let {
			payload: { name, previousValue, value },
		} = action;
		value = value !== null && value !== void 0 ? value : "";
		previousValue =
			previousValue !== null && previousValue !== void 0 ? previousValue : "";
		if (
			typeof previousValue === "string" &&
			(previousValue.startsWith("@") || previousValue.length === 0)
		)
			previousValue = null;
		if (
			typeof value === "string" &&
			(value.startsWith("@") || value.length === 0)
		)
			value = properties[name];
		const payload = {
			name,
			previousValue,
			value,
		};
		switch (name) {
			case "contextDate":
				payload.value = anyToMoment(value, properties);
				payload.previousValue = anyToMoment(state.contextMoment, properties);
				break;
			case "availableViews":
				processAvailableViewsConfig(state, dispatch);
				break;
			case "viewSettings":
				loadViewTemplates(value, state, updateState);
				break;
			case "popoverEnabled":
				if (typeof value === "boolean" && value) {
					const { popoverContentState } = state.properties;
					if (
						popoverContentState &&
						popoverContentState.value === "ready" &&
						typeof popoverContentState.id === "string" &&
						popoverContentState.id.length > 0
					)
						updateState({ eventPopoverSetTime: Date.now() });
				}
				break;
			case "popoverContentState":
				if (
					value &&
					value.value === "ready" &&
					typeof value.id === "string" &&
					value.id.length > 0
				)
					updateState({ eventPopoverSetTime: Date.now() });
				break;
		}
		/**
		 * @type {TimelineViewBase}
		 */
		const timelineView = state.timelineView;
		if (timelineView) timelineView.onPropertyChange(payload);
		if (isDebugMode())
			Log.info(
				"Property changed",
				name,
				"from value",
				previousValue,
				"to value",
				value
			);
		if (name === "timezone") {
			/**
			 * @type {Array<CalendarEvent>}
			 */
			const events = state.dataProvider.getAllEvents();
			for (let event of events) event.setTimezone(value);
			handleContextDateChange(state.contextMoment.clone(), state, dispatch);
		} else if (name === "contextDate") {
			handleContextDateChange(value, state, dispatch);
		} else if (name === "currentView") {
			setTimeout(
				() =>
					dispatch(ACTIONS.VIEW_CHANGED, { from: previousValue, to: value }),
				1
			);
			resetKeyhandler(state, dispatch);
		} else if (name === "events") {
			handleEventsChange(payload, state, dispatch);
			resetKeyhandler(state, dispatch);
		} else if (name === "sections") {
			handleSectionChange(payload, state, dispatch);
		}
	},
	[actionTypes.COMPONENT_CONNECTED]({ host, updateState }) {
		updateState({ host });
	},
	/**
	 *
	 * @param {{state: import('..').CalendarState}} param0
	 */
	[actionTypes.COMPONENT_RENDERED]({ state, host, dispatch }) {
		if (!state.timelineView) return;
		if (state.timelineView.isActiveView) {
			const currentViewPort = state.timelineView.getViewPort();
			state.timelineView.onResize();
			if (
				currentViewPort.height > 0 &&
				currentViewPort.width > 0 &&
				(!state.timelineViewPort ||
					!state.timelineViewPort.equals(currentViewPort))
			)
				state.timelineView.setViewPort(currentViewPort);
		}
		state.timelineView.checkForSizeZero(host, dispatch);
	},
	/**
	 *
	 * @param {{state: import('..').CalendarState, dispatch: import('..').appDispatch}} param0
	 */
	[actionTypes.COMPONENT_DISCONNECTED]: function ({ state, dispatch, action }) {
		if (state.timelineView) state.timelineView.onDisconnected();
	},
	[ACTIONS.TEMPLATE_COMPONENT_EVENT]({ dispatch, action }) {
		dispatch(ACTIONS.TEMPLATE_EVENT, { data: action.payload.data || {} });
	},
};
populateAllActionHandlers(BaseActionHandlers, false);

export default {
	actions: {
		[ACTIONS.INTERNAL_STATE_SET]: {
			private: true,
		},
		[ACTIONS.TOGGLE_POPOVER]: {
			private: true,
		},
		[ACTIONS.TEMPLATE_COMPONENT_EVENT]: {
			private: true,
		},
	},
	actionHandlers: ActionHandlers,
};

import { getCurrentViewKeyHandlers, resetShortCutsFocusCounter, getViewShortcuts, isValidKeyEvent, updateCurrentDate, isPopoverOpen } from './util';
import { ACTIONS, KEYS, POPOVERS, DIRECTION } from './constants';

let count = 0;
let lastFocusElement;
let lastCalendarViewElement;
export function onCalendarFocus(event, state, dispatch) {
	const {properties:props} = state;
	const {currentView:viewName} = props;
	const keyHandlers = getCurrentViewKeyHandlers(state, props.viewSettings[viewName]);
	const calendarViewElement = event.target.parentElement.querySelector('.calendar-view');
	if (lastFocusElement && !lastFocusElement.getAttribute('tabindex'))
		lastFocusElement = null;
	keyHandlers.setFocus(calendarViewElement, state, lastFocusElement);
}

export function reset(state, dispatch) {
	const {resetFocus:rf, properties:props, popoverContainerEl} = state;
	const {currentView:viewName} = props;
	const keyHandlers = getCurrentViewKeyHandlers(state, props.viewSettings[viewName]);

	if (rf) {
		if (lastFocusElement && !lastFocusElement.getAttribute('tabindex'))
			lastFocusElement = null;

		if (!lastCalendarViewElement && popoverContainerEl)
			lastCalendarViewElement = popoverContainerEl.closest('.calendar-view');

		keyHandlers.resetFocus(state, lastFocusElement, lastCalendarViewElement);
	}

	lastFocusElement = null;
	resetShortCutsFocusCounter();

	dispatch(ACTIONS.INTERNAL_STATE_SET, {resetFocus: false});
}

export function onCalendarFocusOut(event, state) {
	if (!event.target.classList.contains('calendar-view'))
		count--;

	if (count <= 0) {
		const calendarViewElement = event.currentTarget.parentElement.querySelector('.calendar-focus');
		calendarViewElement.setAttribute('tabindex', '0');
		lastCalendarViewElement = event.currentTarget.parentElement.querySelector('.calendar-view');
	}
}

export function onCalendarFocusIn(event) {
	count++;
	if (count > 0) {
		const calendarViewElement = event.currentTarget.parentElement.querySelector('.calendar-focus');
		calendarViewElement.setAttribute('tabindex', '-1');
		lastFocusElement = event.target;
		lastCalendarViewElement = event.currentTarget.parentElement.querySelector('.calendar-view');
	}
}

function debounce(func, wait, immediate) {
	var timeout;
	return function () {
		var context = this, args = arguments;
		var later = function () {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

export const changeView = debounce(function (dispatch, view_id) {
	dispatch('PROPERTIES_SET', {currentView: view_id})
}, 200);

export function onKeyDown(event, state, dispatch) {
	if (!isValidKeyEvent(event) || event.composedPath().indexOf('slot') > -1 || event.composedPath()[0].localName == 'input' || event.composedPath()[0].localName == 'textarea' || (isPopoverOpen(state) && !(state.popOvers && state.popOvers[POPOVERS.SETTINGS] && event.which == KEYS.FSLASH)))
		return;

	if ((event.which == KEYS.P || event.which == KEYS.N || event.which == KEYS.T) && !event.shiftKey) {
		if (event.which == KEYS.T) {
			const {todayMoment} = state;
			dispatch('PROPERTIES_SET', {contextDate: todayMoment});
			if (event.target.closest('.calendar-view') || event.target.closest('.contextual-panel'))
				dispatch(ACTIONS.INTERNAL_STATE_SET, {resetFocus: true});
			return;
		}
		const direction = event.which == KEYS.P ? DIRECTION.LEFT : DIRECTION.RIGHT;
		if (event.target.closest('.calendar-view') || event.target.closest('.contextual-panel'))
			dispatch(ACTIONS.INTERNAL_STATE_SET, {resetFocus: true});
		updateCurrentDate(state, dispatch, direction);
		return;
	}
	if (event.which == KEYS.F) {
		event.currentTarget.querySelector('.calendar-focus').focus();
	}
	if (event.keyCode === KEYS.FSLASH) {
		const settingsTarget = event.currentTarget.querySelector('.shortcuts');
		dispatch(ACTIONS.TOGGLE_POPOVER, {popOver: POPOVERS.SETTINGS, eventEl: settingsTarget});
	} else {
		const viewShortCuts = getViewShortcuts(state);
		const view = _.find(viewShortCuts.keys, k => k.name.toUpperCase() === event.key.toUpperCase());
		if (view) {
			if (event.currentTarget.querySelector('.calendar-view').querySelectorAll(':focus').length > 0) {
				dispatch(ACTIONS.INTERNAL_STATE_SET, {resetFocus: true});
			}
			changeView(dispatch, view.view_id);
		}
	}
}

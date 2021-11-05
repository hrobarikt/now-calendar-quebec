import {Log, assertDefined, debug} from './devUtil';
import {ACTIONS, VIEWS, WHEN_OUT_OF_MODE_OPTIONS} from '../constants';
import * as viewManager from '../body-views';
import {DayTemplateRenderer, WeekTemplateRenderer, ColumnTemplateRenderer} from '../body-views/column/column-template-renderer';
import {TimelineDayTemplateRenderer, TimelineWeekTemplateRenderer} from '../body-views/timeline/template-renderer';
import {MonthTemplateRenderer} from '../body-views/month/month-template-renderer';
import { getTemplateRenderer } from '../template-renderer';

function addUserView({availableViewRenderers, viewName, viewLabel, viewProvider, type, key}) {
	let r = viewManager.ViewRenderers[viewProvider];
	if (r) {
		if (availableViewRenderers[viewName])
			Log.info('Cannot register this user view as this view is already registered: ', viewName);
		else {
			// Key value (viewName) is again stored in value object since it makes job much easier later in header view
			availableViewRenderers[viewName] = {...r, viewLabel, viewProvider, type, viewName, key};
			return true;
		}
	} else
		Log.error('Invalid view provider name provided: ', viewProvider);
}

function addSystemView({availableViewRenderers, viewName}) {
	let r = viewManager.ViewRenderers[viewName];
	if (r) {
		if (availableViewRenderers[viewName])
			Log.info('Cannot register this user view as this view is already registered: ', viewName);
		else {
			availableViewRenderers[viewName] = {...r, viewName};
			return true;
		}
	} else
		Log.error('Invalid view name provided: ', viewName);
}

export function processAvailableViewsConfig(state, dispatch) {
	const {properties:{availableViews}} = state;
	const {availableViewNames=[]} = state;
	const {availableViewRenderers={}} = state;
	availableViews.forEach(v => {
		if (typeof v === 'string') {
			if (addSystemView({viewName:v, availableViewRenderers}))
				availableViewNames.push(v);
		} else {
			assertDefined(v.view);
			assertDefined(v.label);
			assertDefined(v.viewProvider);
			let view = {viewName:v.view, viewLabel:v.label,
				viewProvider:v.viewProvider, type:v.type,
				availableViewRenderers};
			if (v.key)
				view.key = v.key;
			if (addUserView(view))
				availableViewNames.push(v.view);
		}
	});
	dispatch(ACTIONS.INTERNAL_STATE_SET, {availableViewNames, availableViewRenderers});
}

export function getCurrentViewRenderer(state, params = {}) {
	const viewName = state.properties.currentView;
	const {availableViewRenderers={}} = state;
	let r = availableViewRenderers[viewName];
	if (r) {
		return r.renderer.bind(null, {...r.defaultParams, ...params, ...r.fixedParams});
	} else {
		Log.error('Invalid view name provided: ', viewName);
		// This indicates programming error in this or parent component
		debug();
	}
}

export function getCurrentViewKeyHandlers(state, params = {}) {
	const {availableViewRenderers={}} = state;
	let viewName = state.properties.currentView;
	let r = availableViewRenderers[viewName];
	if (r) {
		return r.keyHandlers;
	} else {
		Log.error('Invalid view name provided: ', viewName);
		// This indicates programming error in this or parent component
		debug();
	}
}

export function getCurrentViewSettings(state) {
	const {availableViewRenderers={}} = state;
	let viewName = state.properties.currentView;
	let r = availableViewRenderers[viewName];
	if (r) {
		let {properties:props} = state;
		let {viewSettings} = props;
		let {[viewName]:v={}} = viewSettings;
		return {...r.defaultParams, ...v, ...r.fixedParams, viewLabel:r.viewLabel};
	} else {
		Log.error('Invalid view name provided: ', viewName);
		// This indicates programming error in this or parent component
		debug();
	}
}

export function getCurrentViewTemplateRenderer(state) {
	const {availableViewRenderers={}, properties: props} = state;
	let viewName = state.properties.currentView;
	let r = availableViewRenderers[viewName];
	if (r) {
		let templateRenderer = r.templateRenderer;

		// TODO: Below changes are workaround for DEF0087061, revert below changes once root cause is discovered
		if (viewName === VIEWS.DAY && props.dayTemplateRenderer && props.dayTemplateRenderer) {
			templateRenderer = props.dayTemplateRenderer;
		}
		else if (viewName === VIEWS.WEEK && props.weekTemplateRenderer && props.weekTemplateRenderer) {
			templateRenderer = props.weekTemplateRenderer;
		}
		else if (viewName === VIEWS.MONTH && props.monthTemplateRenderer && props.monthTemplateRenderer) {
			templateRenderer = props.monthTemplateRenderer;
		}
		else if (viewName === VIEWS.TIMELINE_DAY && props.timelineDayTemplateRenderer && props.timelineDayTemplateRenderer) {
			templateRenderer = props.timelineDayTemplateRenderer;
		}
		else if (viewName === VIEWS.TIMELINE_WEEK && props.timelineWeekTemplateRenderer && props.timelineWeekTemplateRenderer) {
			templateRenderer = props.timelineWeekTemplateRenderer;
		}
		if(typeof templateRenderer === 'string')
			return getTemplateRenderer(viewName, templateRenderer.trim()) || getTemplateRenderer(r.viewProvider, templateRenderer.trim()) || getTemplateRenderer(r.viewProvider, r.templateRenderer);
		return templateRenderer;
	} else {
		Log.error('Invalid view name provided: ', viewName);
		// This indicates programming error in this or parent component
		debug();
	}
}

export function getCurrentViewProvider(state) {
	let viewName = state.properties.currentView;
	const {availableViewRenderers={}} = state;
	let r = availableViewRenderers[viewName];
	if (r) {
		if (r.viewProvider)
			return r.viewProvider;
		else
			return viewName;
	} else {
		Log.error('Invalid view name provided: ', viewName);
		// This indicates programming error in this or parent component
		debug();
	}
}

export function renderViewDropDownList(state) {
	const {availableViewNames, availableViewRenderers} = state;
	let dropdownItems = getAvailableViewsList(state);
	/* Flattening the list if there is only one section */
	if (Object.keys(dropdownItems).length == 1)
		return Object.values(dropdownItems)[0].children;
	return Object.values(dropdownItems);
}

export function getAvailableViewsList(state) {
	const {availableViewNames, availableViewRenderers} = state;
	let list = {};
	availableViewNames.map(vn => availableViewRenderers[vn])
		.map( item => {
			if (!list[item.type]) {
				list[item.type] = {
					label : item.type,
					children : []
				};
			}
			let view = {
				id : item.viewName,
				label : item.viewLabel
			};
			if (item.key)
				view.key = item.key;

			list[item.type].children.push(view);
		});
	return list;
}

export function scrollViewOnEventDrag(mouseEvent) {
	let viewElm = mouseEvent.target.closest('.view-body');
	if (viewElm.clientHeight + viewElm.offsetTop - mouseEvent.clientY < 40)
		viewElm.scrollTop += 5;
	else if (mouseEvent.clientY - viewElm.offsetTop < 40)
		viewElm.scrollTop -= 5;
}

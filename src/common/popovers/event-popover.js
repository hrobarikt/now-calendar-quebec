import { createCustomElement,actionTypes } from '@servicenow/ui-core';
import snabbdom, { createRef } from '@servicenow/ui-renderer-snabbdom';
import style from './event-popover.scss';
import '@servicenow/now-loader';
import { fitBehavior, setFitOpened, setFitTarget, setFitContent } from '@servicenow/behavior-fit';
import { POPOVER_STATE, KEYS, ACTIONS, POPOVERS } from '../../constants';
import { t } from "sn-translate";
let cachedTime;
const UPDATE_FIT_STYLE = 'UPDATE_FIT_STYLE';
const FIT_BEHAVIOUR_STATE_SET = "FIT_BEHAVIOR#STATE_SET";
let isPopoverEnabled = false;

function setFocus(el) {
	if (el)
		el.querySelector('.start').focus();
}

export function trapFocus(event) {
	if(event.currentTarget.classList.contains('end')){
		if (event.which === KEYS.TAB && !event.shiftKey)
			setFocus(event.currentTarget.closest('.popover'));
	}
	if(event.currentTarget.classList.contains('start')){
		if (event.which === KEYS.TAB && event.shiftKey) {
			const rootEl = event.currentTarget.closest('.popover');
			if (rootEl) {
				const endEl = rootEl.querySelector('.end');
				if (endEl)
					endEl.focus();
			}
		}
	}
}

const updateTarget = (dispatch,target, opened) => {
	if (target && target instanceof HTMLElement) {
		setFitOpened(dispatch, opened);
		if (rootRef.current && rootRef.current.style && rootRef.current.style.width === '0px') {
			rootRef.current.removeAttribute('style');
		}
		setFitTarget(dispatch, target);
	}
};

function updateFitStyle(dispatch, state, elm, opened) {
	const { properties: { target }} = state;
	setFitTarget(dispatch, null);
	setFitContent(dispatch, elm);
	updateTarget(dispatch, target, opened);
}

function getFitStyle(state) {
	const { properties: {container, opened}, behaviors: {fit} } = state;
	if (!fit || !fit.style)
		return fit.style;

	if (!opened || !fit.style.top || !isPopoverEnabled){
		return;
	}

	const snCalendarCoreEl = container.closest('.sn-calendar-core');
	let calendarCoreRect, correctedStyle = {...fit.style};
	if (snCalendarCoreEl) {
		calendarCoreRect = snCalendarCoreEl.getBoundingClientRect();
		if (correctedStyle && correctedStyle.top && calendarCoreRect.top > 0) {
			correctedStyle.top = (parseFloat(fit.style.top) - calendarCoreRect.top) + 'px';
		}
	}
	if (calendarCoreRect && fit.style.left) {
		correctedStyle.left = (parseFloat(fit.style.left) / (calendarCoreRect.left + calendarCoreRect.width)) * 100 + '%';
	}
	return {
		left: correctedStyle.left,
		top: correctedStyle.top,
		width: correctedStyle.width,
		visibility: "visible"
	}
}

function getPopoverContent(state, dispatch) {
	const { properties: { contentState, target }} = state;
	if (contentState.value === POPOVER_STATE.READY) {
		if (!cachedTime || !contentState.timestamp || cachedTime === contentState.timestamp)
			return	(<div id="popover_content" className="popover-content">
				<slot name="sn-calendar-event-popover-user-content" />
			</div>);
	}

	return	(<div id="popover_content" className="loader-container">
		<now-loader className="now-loader" size="md" />
	</div>);
}

let rootRef = createRef();
createCustomElement('sn-now-calendar-event-popover-container', {
	renderer: {type: snabbdom},
	view(state, dispatch) {
		const {
			properties: {opened, target, container},
			behaviors: {fit}
		} = state;
		if (!opened)
			return null;
		return <div on-click={(e) => e.stopPropagation()}
			tabindex="0" className="popover" ref={rootRef}
			hook={
				{	insert:({elm}) => {
						setFitContent(dispatch, elm);
						updateTarget(dispatch, target)
					},
					destroy:({elm}) => {
						setFitContent(dispatch, null);
						dispatch.updateState({firstFocusTime: 0});
					},
					postpatch({elm}) {
						if (state.firstFocusTime)
							return;
						setTimeout( () => {
							dispatch.updateState({invalidationTime: Date.now()});
						}, 50);
					}
				}
			}
			style={getFitStyle(state)}>
			<div className="start" tabindex="0" aria-label={t("Event popover start")}
				on-keydown={(e) => trapFocus(e)}
				hook-update={ ({elm}) => {
					if(!state.firstFocusTime)
						elm.focus();
				}}
				on-focus={ () => {
					if (!state.firstFocusTime)
						dispatch.updateState({firstFocusTime: Date.now()})
				}}
				/>
				{getPopoverContent(state, dispatch)}
			<div className="end" tabindex="0" aria-label={t("Event poprover end")}
				on-keydown={(e) => trapFocus(e)} />
		</div>;
	},
	properties: {

		/** HTML element around which the "content" will be positioned */
		target: {
			default: null
		},
		/** HTML element in which the "content" element should be constrained, behavior will consider 'window' if not specified */
		container: {
			default: null
		},
		/** Boolean to toggle the visibility of content element */
		opened: {
			default: false,
		},
		/** Defines different state of the popover content => ['empty', 'pending', 'ready', 'rendered'] */
		contentState: {
			default: {
				value: 'empty'
			}
		}
	},
	styles: style,
	behaviors: [
		{
			behavior: fitBehavior,
			options: {
				position:
					[
						'top-start top-end',
						'top-end top-start',
						'center-end center-start',
						'center-start center-end',
						'bottom-end bottom-start',
						'bottom-start bottom-end'
					],
				offset: [0, 0, 8, 8, 8, 8]
			}
		}
	],
	actionHandlers: {
		[actionTypes.COMPONENT_PROPERTY_CHANGED]: ({properties, state, dispatch, action, updateState}) => {
			const {payload:{name}} = action;
			switch(name) {
				case 'opened':
					cachedTime = 0;
					break;
				case 'contentState':
				case 'target':
					updateState({firstFocusTime: 0});
					dispatch(UPDATE_FIT_STYLE);


					break;
				default:
				break;
			}
		},
		[UPDATE_FIT_STYLE]: ({action, dispatch, state}) => {
			const {properties: { contentState, opened }} = state;
			if (contentState.value && contentState.value === POPOVER_STATE.PENDING && contentState.timestamp)
				cachedTime = contentState.timestamp;

			updateFitStyle(dispatch, state, rootRef.current, opened);
		},
		[FIT_BEHAVIOUR_STATE_SET]: ({action}) => {
			if (action.payload.opened !== undefined)
				isPopoverEnabled = action.payload.opened
		}
	}
});

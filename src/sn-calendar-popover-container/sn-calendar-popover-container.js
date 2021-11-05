import {createCustomElement, actionTypes} from '@servicenow/ui-core';
import snabbdom, {createRef} from '@servicenow/ui-renderer-snabbdom';
import style from './sn-calendar-popover.scss';
import { fitBehavior, setFitContent, setFitOpened, setFitTarget } from '@servicenow/behavior-fit';
import { trapFocus } from "../common/popovers/event-popover";
import { t } from "sn-translate";
const RE_CALCULATE_POSITION = 'RE_CALCULATE_POSITION';
/**
 * Update the style attributes in case the sn-calendar-core is shifted or contained in another component with top/left offsets
 * because the popover is absolutely positioned inside a relatively positioned container
 * and fit behavior calculates the offsets using getBoundingClientRect
 */
function getCorrectedStyle(state) {
	let {properties: { targetRef, customStyles },  behaviors: {fit}} = state;
	let snCalendarCoreEl, calendarCoreRect, targetRect, correctedStyle = { ...fit.style };

	if (targetRef && targetRef.current) {
		targetRect = targetRef.current.getBoundingClientRect();
		snCalendarCoreEl = targetRef.current.closest('.sn-calendar-core');
		if (snCalendarCoreEl)
			calendarCoreRect = snCalendarCoreEl.getBoundingClientRect();
	}
	if (calendarCoreRect && correctedStyle) {
		// Adjust vertical offset
		if (correctedStyle.top && calendarCoreRect.top > 0)
			correctedStyle.top = (parseFloat(fit.style.top) - calendarCoreRect.top) + 'px';

		// Adjust horizontal offset
		if (targetRect && correctedStyle.left && correctedStyle.width) {
			// When core calendar offset is non-zero
			if (calendarCoreRect.left > 1) {
				// Make sure popover is not overflown out of calendar after adjustment
				const popoverRight = calendarCoreRect.left + parseFloat(correctedStyle.left) + parseFloat(correctedStyle.width);
				if (popoverRight > calendarCoreRect.right) {
					correctedStyle.left = ((targetRect.right - parseFloat(correctedStyle.width) - calendarCoreRect.left) / calendarCoreRect.width) * 100 + '%';
				}
				else {
					correctedStyle.left = ((targetRect.left - calendarCoreRect.left) / calendarCoreRect.width) * 100 + '%';
				}
			}
			else {
				//Convert style.left from px to %
				correctedStyle.left = (parseFloat(fit.style.left) / calendarCoreRect.width) * 100 + '%';
			}
		}
	}
	if (customStyles) {
		correctedStyle = {
			...correctedStyle,
			...customStyles
		}
	}
	if (!(correctedStyle.left && correctedStyle.top))
			correctedStyle.opacity = "0";
	else
		correctedStyle.opacity = "1";
	return correctedStyle;
}

const updateTarget = (dispatch, target) => {
	if (target) {
		setFitOpened(dispatch, true);
		setFitTarget(dispatch, target);
		target.focus();
	}
	else {
		setFitOpened(dispatch, false);
		setFitTarget(dispatch, null);
	}
};

let elmRef = createRef();

const view = (state, dispatch) => {
	let {properties: {opened, targetRef, customStyles},  behaviors: {fit}} = state;
	if(!opened)
		return null;
	return <div
		ref={elmRef}
		hook={
			{
				insert:({elm}) => {
					setFitContent(dispatch, elm);
					updateTarget(dispatch, targetRef.current);
				},
				destroy:({elm}) => {
					setFitContent(dispatch, elm);
					updateTarget(dispatch, null);
					if(state.properties.targetRef && state.properties.targetRef.current)
						state.properties.targetRef.current.focus();

				}
			}
		}
		className="sn-calendar-popover popover" style={getCorrectedStyle(state)}>
			<div className="start" tabindex="0" aria-label={t("popover content start")}
				hook-insert={ ({elm}) => {
					setTimeout( () => {
						elm.focus();
					}, 16);
				}}
			on-keydown={ (e) => {
				trapFocus(e);
			}}></div>
			<slot name="sn-calendar-popover-content"></slot>
			<div className="end" tabindex="0" aria-label={t("popover content end")}
			on-keydown={ (e) => {
				trapFocus(e);
			}}></div>
	</div>
};

createCustomElement('sn-calendar-popover-container', {
	renderer: {
		type: snabbdom,
		view
	},
	properties: {
		target: {
			default: null
		},
		/** HTML element in which the "content" element should be constrained, behavior will consider 'window' if not specified */
		container: {
			default: null
		},
		/** Boolean to toggle the visibility of content element */
		opened: {
			default: false
		},
		targetRef: {
			default: 'null'
		},
		rePositionPopover: {
			default: 1,
			onChange: (newVal, oldVal, dispatch) => {
				dispatch(RE_CALCULATE_POSITION);
			}
		},
		customStyles: {
			default: null
		}
	},
	onConnect(host, dispatch) {
		if (host.target) {
			updateTarget(dispatch, host.target);
		}
	},
	behaviors: [
		{
			behavior: fitBehavior,
			options: {
				position:
				[
					'bottom-start top-start',
					'bottom-end top-end'
				],
				offset: [14, 0, 0, 0, 0, 0]
			}
		}
	],
	styles: style,
	actionHandlers: {
		[actionTypes.COMPONENT_RENDERED]({host, properties}) {
			if (!properties.opened)
				return;
			if (host.shadowRoot.activeElement)
				return;
			const elm = host.shadowRoot.querySelector(".start");
			if(elm)
				elm.focus();
		},
		[RE_CALCULATE_POSITION]: ({action, dispatch, state}) => {
			const {properties: props} = state;
			elmRef.current.style.height = '';
			elmRef.current.style.width = '';
			setFitContent(dispatch, elmRef.current);
			updateTarget(dispatch, props.targetRef.current);
		}
	}
});

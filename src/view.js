import renderHeader from './header-view';
import {openManagedPopover, Log, isDebugMode, getCurrentViewRenderer, getCurrentViewProvider, getCurrentViewKeyHandlers, measure, isNotToolTipEvent} from './util';
import '@servicenow/now-tooltip';
import {ACTIONS, POPOVERS, VIEWS, POPOVER_STATE } from './constants';
import './common/popovers/event-popover';
import renderAgendaView from './agenda-view/agenda-view';
import {t} from 'sn-translate';
import {createRef} from '@servicenow/ui-renderer-snabbdom';
import { onCalendarFocus, onCalendarFocusOut, onCalendarFocusIn, onKeyDown } from './keyboard-action-handlers';

/**
 * 
 * @param {import('..').CalendarState} state 
 * @param {import('..').appDispatch} dispatch 
 */
function view(state, dispatch) {
	let {properties:props, contextualPanelCurrentView, contextualPanelIconClick} = state;
	
	if (!state.componentInitialized)
		return <div></div>;
	const {currentView:viewName} = props;
	const renderBody = getCurrentViewRenderer(state,  props.viewSettings[viewName]);
	const keyHandlers = getCurrentViewKeyHandlers(state, props.viewSettings[viewName]);
	const hideAgendaView = props.viewSettings[viewName] ? props.viewSettings[viewName].hideAgendaView : false;
	let hideContextualBar = false;

	if (!renderBody) {
		Log.error('Bad view name provided: ', viewName);
		if (isDebugMode())
			debugger;
		return <div></div>;
	}
	const measuredRenderBody = measure(renderBody);
	const measuredRenderHeader = measure(renderHeader);
	const measuredAgendaView = measure(renderAgendaView);

	state.calendarCoreRef = createRef();

	let style = {};
	if (!state.hostHeight)
		style.height = "100vh";
	
	let updatedContextualPanelView = contextualPanelCurrentView;

	if (hideAgendaView && props.contextualPanelItems.length === 0) {
		hideContextualBar = true;
		updatedContextualPanelView = "";
	} else {
		if (hideAgendaView) {
			if (contextualPanelCurrentView == 'agenda-view' && props.contextualPanelItems.length)
				updatedContextualPanelView = props.contextualPanelItems[0].id;
			else 
				updatedContextualPanelView = contextualPanelCurrentView;
		} else if (!contextualPanelCurrentView && !contextualPanelIconClick){
			updatedContextualPanelView = 'agenda-view'
		}
	}

	if (updatedContextualPanelView !== contextualPanelCurrentView) {
		dispatch(ACTIONS.INTERNAL_STATE_SET, {contextualPanelCurrentView: updatedContextualPanelView, contextualPanelIconClick: false});
		dispatch(ACTIONS.SET_CONTEXTUAL_PANEL_VIEW, {viewId: updatedContextualPanelView});
	}
	const isAgendaView = contextualPanelCurrentView === 'agenda-view';
	return <section className="sn-calendar-core" tabindex='0' aria-label={props.configAria.ariaTitle} ref={state.calendarCoreRef}
		on-keydown={(el) => onKeyDown(el, state, dispatch)}
		style={style}
	 	hook-postpatch={ () => {
			openManagedPopover(state, dispatch);
		 }}>
		<header>
			{measuredRenderHeader(state, dispatch)}
		</header>
		<section className="calendar-main-section" role='application' aria-label={props.configAria.ariaBodyTitle}>
			<div className="calendar-wrapper">
				<div className="calendar-focus" on-focus={(el) => onCalendarFocus(el, state, dispatch)} tabindex="0"></div>
				<div className={`calendar-view ${hideContextualBar ? 'cal-display-block' : ''}`}
					on-keydown={(el) => keyHandlers.onKeyDown(el, state, dispatch)}
					on-focusout={(el) => onCalendarFocusOut(el, state)}
					on-focusin={(el) => onCalendarFocusIn(el, state)}
				>
					{measuredRenderBody(state, dispatch)}
				</div>
				<div className={`contextual-panel ${updatedContextualPanelView ? '' : 'hide-panel'}`}>
					{updatedContextualPanelView == 'agenda-view' ? measuredAgendaView(state, dispatch, props.viewSettings[viewName]) : <slot name="contextual-panel-content"></slot>}
				</div>
				<div className={`contextual-bar ${hideContextualBar ? 'hide-panel' : ''}`}>
					<now-button className={"contextual-bar-icon agenda-view " + (updatedContextualPanelView === 'agenda-view' ? "active" : '')} icon="calendar-clock-outline" size="md" bare
						config-aria={{'aria-expanded': `${isAgendaView}`, 'aria-label': isAgendaView ? t('Hide Agenda View'): t('Show Agenda View')}}
						tooltip-content={isAgendaView ? t('Hide Agenda View') : t('Show Agenda View')}
						style={{'display': hideAgendaView ? 'none' : ''}}
						on-click={(e) =>{ if ( isNotToolTipEvent(e) ) {(
							dispatch(ACTIONS.INTERNAL_STATE_SET, {
								contextualPanelCurrentView : contextualPanelCurrentView === 'agenda-view' ? '' : 'agenda-view',
								contextualPanelIconClick: true
							})
						)}}}
					/>
					{renderContextualBarIcons(state, dispatch)}
				</div>
			</div>
		</section>
		<now-tooltip
			className="calendar-tooltip"
			id={'tooltip'+state.tooltip.id}
			target-ref={state.tooltip.ref}
			content={state.tooltip.content}
		/>
		<sn-now-calendar-event-popover-container
			hook-insert={({elm}) => {
				dispatch(ACTIONS.INTERNAL_STATE_SET, {popoverEl: elm});
				}}
			contentState={props.popoverContentState}
			opened={state.popOvers[POPOVERS.EVENT] && state.popOvers[POPOVERS.EVENT].opened && props.popoverContentState.value !== POPOVER_STATE.DESTROYED}>
			<div slot="sn-calendar-event-popover-user-content">
				<slot name="event-popover" />
			</div>
		</sn-now-calendar-event-popover-container>
	</section>;
}

export function renderContextualBarIcons(state, dispatch) {
	const {properties: {contextualPanelItems}, contextualPanelCurrentView} = state;
	return contextualPanelItems.map(view => {
		const isCurrentView = contextualPanelCurrentView === view.id;
		return <now-button className={'contextual-bar-icon ' + view.id + ' ' + (contextualPanelCurrentView === view.id ? 'active' : '') } icon={view.icon} size="md" bare
					config-aria={{'aria-expanded': `${isCurrentView}`, 'aria-label': contextualPanelCurrentView === view.id ? t('Hide {0}', view.label) : t('Show {0}', view.label)}}
					tooltip-content={contextualPanelCurrentView === view.id ? t('Hide {0}', view.label) : t('Show {0}', view.label)}
					on-click={(e) => {
						if ( isNotToolTipEvent(e) ) {
							dispatch(ACTIONS.INTERNAL_STATE_SET, {
									contextualPanelCurrentView : contextualPanelCurrentView === view.id ? '' : view.id,
									contextualPanelIconClick: true
								});
							dispatch(ACTIONS.SET_CONTEXTUAL_PANEL_VIEW, {viewId: view.id})
						}
					}}
				/>;
	});
}

export default {
	view,
};

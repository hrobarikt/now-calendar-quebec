import {isMoveAllowed, getCurrentViewProvider, getDirProperty, setLocale, getEventAriaLabel, isNDSColor, isValidHexColor, lighten, isCustomColor} from '../util';
import { onEventDragEnd, onEventDragStart } from './agenda-event-handlers';
import { updateContainerHeight } from '.././util/layoutUtil';
import {createRef} from '@servicenow/ui-renderer-snabbdom';
import { ACTIONS, POPOVERS, VIEWS, INTERNAL_FORMAT, KEYS, GRADIENT } from '../constants';
import {t} from 'sn-translate';
import {AgendaTemplateRenderer, NOW_CALENDAR_DEFAULT_AGENDA_TEMPLATE_RENDERER} from './agenda-template-renderer';
import { getTemplateRenderer } from '../template-renderer';

function sortEvents(events, dayStartMoment, dayEndMoment) {
	events.forEach((event) => {
		if (event.startMS < dayStartMoment.valueOf() || event.endMS > dayEndMoment.valueOf()) {
			event.isMultiDay = true;
		}
		else if (event.startMS === dayStartMoment.valueOf() || event.endMS === dayEndMoment.valueOf())
			event.isAllDay = true;
	});

	const sortedEvents = events.sort(function (date1, date2) {
		if ((date1.isMultiDay || date1.isAllDay) && !(date2.isMultiDay || date2.isAllDay))
			return -1;
		else if (!(date1.isMultiDay || date1.isAllDay) && (date2.isMultiDay || date2.isAllDay))
			return 1;
		else if (date1.startMS < date2.startMS)
			return -1;
		else if (date1.startMS > date2.startMS)
			return 1;
		else {
			const date1Duration = date1.endMS - date1.startMS;
			const date2Duration = date2.endMS - date2.startMS;
			if (date1Duration === date2Duration)
				return 0;
			return date1Duration < date2Duration ? -1 : 1;
		}
	});
	return sortedEvents;
}
function getAgendaStyles(event, cls) {
	const eventStyles = {};
	const borderStyles = {};
    if (event.gradientColor1 && event.gradientColor2) {
		borderStyles["background-image"]='repeating-linear-gradient(' + parseInt(GRADIENT.ANGLE) + 'deg, '
			+ event.gradientColor1 + ', '
			+ event.gradientColor2 + ' ' + parseInt(GRADIENT.LINE_WIDTH) + 'px, '
			+ event.gradientColor1 + ' ' + 2 * parseInt(GRADIENT.LINE_WIDTH) + 'px)';
	} else {
		if (isNDSColor(event.bgColor))
			cls.push(event.bgColor);
		else if (isCustomColor(event.bgColor)) {
			borderStyles['background-color'] = event.bgColor;
			eventStyles['background-color'] = lighten(event.bgColor, 20);
			cls.push('custom-color');
		}
	}
    return {
		eventStyles,
		borderStyles
	};
}


function getEvent(state, dispatch, viewSettings, event, dayStartMoment, dayEndMoment) {
	const { properties: props } = state;
	const { timeFormat } = props;

	const allowMove = isMoveAllowed(state, event);
	const cls = ['agenda-event', 'default'];
	if (allowMove)
		cls.push('move');

	const agendaStyles = getAgendaStyles(event, cls);
	let agendaTemplateRenderer = null;
	if(typeof state.properties.agendaTemplateRenderer === 'string')
		agendaTemplateRenderer = getTemplateRenderer('AGENDA_VIEW', state.properties.agendaTemplateRenderer);
	if(!(agendaTemplateRenderer instanceof AgendaTemplateRenderer))
		agendaTemplateRenderer = getTemplateRenderer('AGENDA_VIEW', NOW_CALENDAR_DEFAULT_AGENDA_TEMPLATE_RENDERER);
	return (<div className={cls.join(' ')}
		style={agendaStyles.eventStyles}
		hook-update={(newVnode) => {
			if (!state.temporaryEventSettings)
				newVnode.elm.classList.add('no-hover');
		}}
		tabindex="0"
		draggable={allowMove + ''}
		aria-label={getEventAriaLabel(state, event)}
		ondragstart={(mouseEvent) => onEventDragStart(mouseEvent, event, viewSettings, state, dispatch)}
		ondragend={(mouseEvent) => onEventDragEnd(mouseEvent, event, viewSettings, state, dispatch)}
		on-click={(e)=>{onEventClick(e, state, dispatch, event);}}
		on-keydown={(e) => { e.which === KEYS.ENTER ? onEventClick(e, state, dispatch, event) : null; }}
	>
		<div className="agenda-event-border" style={agendaStyles.borderStyles}/>
		<div className="agenda-event-wrapper"
			on-mouseenter={mv => {
				mv.target.closest('.agenda-event').classList.remove('no-hover');
			}}>
			{agendaTemplateRenderer.agendaContainer(event, { timeFormat, dayStartMoment, dayEndMoment }, state, dispatch)}
		</div>
	</div>);
}

function renderAgendaView(state, dispatch, viewSettings) {
	const eventCards = [];
	const { properties: props, todayMoment, agendaViewSectionEvents } = state;
	const { dateFormat, dir } = props;
	let agendaDateFormat;

	if (dateFormat.indexOf('MM') > dateFormat.toUpperCase().indexOf('DD')) {
		agendaDateFormat = 'ddd, DD MMM, YYYY';
	} else {
		agendaDateFormat = 'ddd, MMM DD, YYYY';
	}


	const dayStartMoment = state.contextMoment.clone().set({
		hour: 0,
		minute: 0,
		second: 0,
		milliseconds: 0
	});
	const dayEndMoment = state.contextMoment.clone().set({
		hour: 23,
		minute: 59,
		second: 59,
		milliseconds: 999
	});
	/**
	 * @type {Array<CalendarEvent>}
	 */
	let filteredEvents;
	let agendaViewEvents = agendaViewSectionEvents ? agendaViewSectionEvents.events : null;
	const view = getCurrentViewProvider(state);
	const isTimelineView = (view === VIEWS.TIMELINE_DAY || view === VIEWS.TIMELINE_WEEK);
	if (isTimelineView) {
		if (!agendaViewEvents)
			return;
		else
			filteredEvents = agendaViewEvents;
	}
	else {
		filteredEvents = state.dataProvider.getEventsBetween(dayStartMoment.valueOf(), dayEndMoment.valueOf());
	}
	let sortedEvents = sortEvents(filteredEvents, dayStartMoment, dayEndMoment);

	let eventBucket = {
		beforeEvents: [],
		afterEvents:[]
	};

	for (let i = 0; i < sortedEvents.length; i++) {
		const event = sortedEvents[i];
		if (event.isAllDay || event.isMultiDay || (event.endMS < todayMoment.valueOf())) {
			eventBucket.beforeEvents.push(event);
		} else {
			eventBucket.afterEvents.push(event);
		}
	}

	if (eventBucket.beforeEvents.length > 0) {
		const beforeCards = [];
		for (let i = 0; i < eventBucket.beforeEvents.length; i++) {
			beforeCards.push(getEvent(state, dispatch, viewSettings, eventBucket.beforeEvents[i], dayStartMoment, dayEndMoment));
		}
		eventCards.push(<div className="cards">
			{beforeCards}
		</div>);
	}
	if (eventBucket.afterEvents.length > 0) {
		const afterCards = [];
		for (let i = 0; i < eventBucket.afterEvents.length; i++) {
			afterCards.push(getEvent(state, dispatch, viewSettings, eventBucket.afterEvents[i], dayStartMoment, dayEndMoment));
		}
		eventCards.push(<div className="cards">
			{afterCards}
		</div>);
	}

	const agendaViewContainerRef = createRef();


	return (
		<div className="agenda-view-container" ref={agendaViewContainerRef}>
			<div className="header">
				<div className="date" role="heading" aria-level="2">
					{state.contextMoment && setLocale(state.contextMoment.clone(), state).format(agendaDateFormat)}
				</div>
			</div>
			{ isTimelineView ? (<div className="section">
				<div className="title">{agendaViewSectionEvents.section}</div>
			</div>) : '' }
			<div className="agenda-events" hook-update={(newVnode) => updateContainerHeight(state, dispatch, newVnode.elm, agendaViewContainerRef.current)}>
			{
					   (eventCards.length===0) ? (<center className="agendaempty">

						<img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTMxcHgiIGhlaWdodD0iMTQwcHgiIHZpZXdCb3g9IjAgMCAxMzEgMTQwIiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogICAgPCEtLSBHZW5lcmF0b3I6IFNrZXRjaCA1Ny4xICg4MzA4OCkgLSBodHRwczovL3NrZXRjaC5jb20gLS0+CiAgICA8dGl0bGU+RW1wdHkgU3RhdGUgQWdlbmRhIFBhbmVsPC90aXRsZT4KICAgIDxkZXNjPkNyZWF0ZWQgd2l0aCBTa2V0Y2guPC9kZXNjPgogICAgPGRlZnM+CiAgICAgICAgPHBhdGggZD0iTTE0LDExLjg0NzkzNTkgTDEwLjUxMDgxNDYsOC4zNTg3NTA1MiBDOS45MTY1Mzg1NSw3Ljc2NDQ3NDQzIDguOTUzMDI2NjIsNy43NjQ0NzQ0MyA4LjM1ODc1MDUyLDguMzU4NzUwNTIgQzcuNzY0NDc0NDMsOC45NTMwMjY2MiA3Ljc2NDQ3NDQzLDkuOTE2NTM4NTUgOC4zNTg3NTA1MiwxMC41MTA4MTQ2IEwxMS44NDc5MzU5LDE0IEw4LjM1ODc1MDUyLDE3LjQ4OTE4NTMgQzcuNzY0NDc0NDMsMTguMDgzNDYxNCA3Ljc2NDQ3NDQzLDE5LjA0Njk3MzQgOC4zNTg3NTA1MiwxOS42NDEyNDk1IEM4Ljk1MzAyNjYyLDIwLjIzNTUyNTYgOS45MTY1Mzg1NSwyMC4yMzU1MjU2IDEwLjUxMDgxNDYsMTkuNjQxMjQ5NSBMMTQsMTYuMTUyMDY0MiBMMTcuNDg5MTg1MywxOS42NDEyNDk1IEMxOC4wODM0NjE0LDIwLjIzNTUyNTYgMTkuMDQ2OTczNCwyMC4yMzU1MjU2IDE5LjY0MTI0OTUsMTkuNjQxMjQ5NSBDMjAuMjM1NTI1NiwxOS4wNDY5NzM0IDIwLjIzNTUyNTYsMTguMDgzNDYxNCAxOS42NDEyNDk1LDE3LjQ4OTE4NTMgTDE2LjE1MjA2NDIsMTQgTDE5LjY0MTI0OTUsMTAuNTEwODE0NiBDMjAuMjM1NTI1Niw5LjkxNjUzODU1IDIwLjIzNTUyNTYsOC45NTMwMjY2MiAxOS42NDEyNDk1LDguMzU4NzUwNTIgQzE5LjA0Njk3MzQsNy43NjQ0NzQ0MyAxOC4wODM0NjE0LDcuNzY0NDc0NDMgMTcuNDg5MTg1Myw4LjM1ODc1MDUyIEwxNCwxMS44NDc5MzU5IFogTTE0LDI3LjY5NTY1MjIgQzYuNDM2MTAwMTMsMjcuNjk1NjUyMiAwLjMwNDM0Nzc1OCwyMS41NjM4OTk4IDAuMzA0MzQ3NzU4LDE0IEMwLjMwNDM0Nzc1OCw2LjQzNjEwMDEzIDYuNDM2MTAwMTMsMC4zMDQzNDc3NTggMTQsMC4zMDQzNDc3NTggQzIxLjU2Mzg5OTgsMC4zMDQzNDc3NTggMjcuNjk1NjUyMiw2LjQzNjEwMDEzIDI3LjY5NTY1MjIsMTQgQzI3LjY5NTY1MjIsMjEuNTYzODk5OCAyMS41NjM4OTk4LDI3LjY5NTY1MjIgMTQsMjcuNjk1NjUyMiBaIiBpZD0icGF0aC0xIj48L3BhdGg+CiAgICA8L2RlZnM+CiAgICA8ZyBpZD0iRW1wdHktU3RhdGUtQWdlbmRhLVBhbmVsIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KICAgICAgICA8ZyBpZD0iR3JvdXAiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE0LjAwMDAwMCwgMjEuMDAwMDAwKSI+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik00My42LDIwIEw0My42LDMxIEwzNywzMSBMMzcsMjAgTDQzLjYsMjAgWiBNNzAsMjAgTDcwLDMxIEw2My40LDMxIEw2My40LDIwIEw3MCwyMCBaIiBpZD0iQ29tYmluZWQtU2hhcGUiIHN0cm9rZT0iIzI5M0U0MCIgc3Ryb2tlLXdpZHRoPSI0Ij48L3BhdGg+CiAgICAgICAgICAgIDxwb2x5bGluZSBpZD0iUGF0aC0xMSIgc3Ryb2tlPSIjMjkzRTQwIiBzdHJva2Utd2lkdGg9IjQiIGZpbGw9IiNGRkZGRkYiIHBvaW50cz0iNjYuNSA4MCAyNC41IDgwIDI0IDI3IDM3IDI3IDM3IDIwIDQ0IDIwIDQ0IDI3IDYzIDI3IDYzIDIwIDcwIDIwIDcwIDI3IDgzIDI3IDgzIDY2IDgzIDcwLjUiPjwvcG9seWxpbmU+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yNC41LDQyLjUgTDgyLjUsNDIuNSIgaWQ9IkxpbmUtNiIgc3Ryb2tlPSIjMjkzRTQwIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJzcXVhcmUiPjwvcGF0aD4KICAgICAgICAgICAgPGcgaWQ9IkNsb3NlXzEiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDY2LjAwMDAwMCwgNjUuMDAwMDAwKSI+CiAgICAgICAgICAgICAgICA8bWFzayBpZD0ibWFzay0yIiBmaWxsPSJ3aGl0ZSI+CiAgICAgICAgICAgICAgICAgICAgPHVzZSB4bGluazpocmVmPSIjcGF0aC0xIj48L3VzZT4KICAgICAgICAgICAgICAgIDwvbWFzaz4KICAgICAgICAgICAgICAgIDxnIGZpbGwtcnVsZT0ibm9uemVybyI+PC9nPgogICAgICAgICAgICAgICAgPGcgaWQ9IkNvbG9ycy9CcmFuZC9icmFuZC0yIiBtYXNrPSJ1cmwoI21hc2stMikiIGZpbGw9IiM4MUI1QTEiIGZpbGwtcnVsZT0ibm9uemVybyI+CiAgICAgICAgICAgICAgICAgICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTEuMjE3MzkxLCAtMS4yMTczOTEpIiBpZD0iUmVjdGFuZ2xlIj4KICAgICAgICAgICAgICAgICAgICAgICAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIj48L3JlY3Q+CiAgICAgICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICAgICAgPC9nPgogICAgICAgICAgICA8L2c+CiAgICAgICAgICAgIDxjaXJjbGUgaWQ9Ik92YWwiIGZpbGw9IiNBOUIyQjIiIGN4PSI5IiBjeT0iOSIgcj0iMiI+PC9jaXJjbGU+CiAgICAgICAgICAgIDxjaXJjbGUgaWQ9Ik92YWwiIGZpbGw9IiNBOUIyQjIiIGN4PSIxMDIiIGN5PSIzMyIgcj0iMiI+PC9jaXJjbGU+CiAgICAgICAgICAgIDxjaXJjbGUgaWQ9Ik92YWwiIGZpbGw9IiMyOTNFNDAiIGN4PSI4Mi41IiBjeT0iMy41IiByPSIzLjUiPjwvY2lyY2xlPgogICAgICAgICAgICA8Y2lyY2xlIGlkPSJPdmFsIiBmaWxsPSIjMjkzRTQwIiBjeD0iMy41IiBjeT0iNDkuNSIgcj0iMy41Ij48L2NpcmNsZT4KICAgICAgICA8L2c+CiAgICA8L2c+Cjwvc3ZnPg==" alt=""/>

						<div className="EmptyTitle"> {props.customizableLabels.agendaEmptyState.text} </div>
						<div className="optional">
							{props.customizableLabels.agendaEmptyState.subText}
						</div>
					</center>):eventCards
				}


			</div>
		</div>

	);
}

function onEventClick(mouseClickEvent, state, dispatch, parentEvent) {
	mouseClickEvent.stopPropagation();
	parentEvent.initializeMoment(state.properties.timezone);
	dispatch(ACTIONS.TOGGLE_POPOVER,
		{
			popOver: POPOVERS.EVENT,
			event: parentEvent,
			eventEl: mouseClickEvent.currentTarget,
			pos: {
				left: mouseClickEvent.clientX ? mouseClickEvent.clientX - document.querySelector('body').getBoundingClientRect().x : mouseClickEvent.currentTarget.getBoundingClientRect().x + mouseClickEvent.currentTarget.getBoundingClientRect().width/2,
				top:  mouseClickEvent.clientY ? mouseClickEvent.clientY - document.querySelector('body').getBoundingClientRect().y : mouseClickEvent.currentTarget.getBoundingClientRect().top + mouseClickEvent.currentTarget.getBoundingClientRect().height/2
			}
		}
	);
}

export function setFocus(event, state) {
	let agendaEvent, targetEl;
	if (event.currentTarget)
		targetEl = event.currentTarget;
	else if (event.originalTarget)
		targetEl = event.originalTarget;
	else {
		const path =  event.path || (event.composedPath && event.composedPath());
		targetEl = path[0];
	}
	let calMainSectionEl = targetEl.closest('.calendar-main-section');
	if (!calMainSectionEl && state && state.calendarCoreRef && state.calendarCoreRef.current)
		calMainSectionEl = state.calendarCoreRef.current;
	if (calMainSectionEl)
		agendaEvent = calMainSectionEl.querySelector('.agenda-event');

	if (agendaEvent) {
		agendaEvent.focus();
		return;
	}
	if (targetEl)
		targetEl.focus();
}

export default renderAgendaView;

import {getBetweenDates,} from './utils';
import {WEEK_DAYS, VIEWS, ACTIONS, KEYS, INTERNAL_FORMAT, EVENT_TYPES} from '../../constants';
import {
	setLocale,
	isCreateAllowed,
	getBlockSpanOnDate,
	SCROLL_BAR_WIDTH,
	getMarkSpanStyles
} from '../../util';
import { onGridCellDragStart, onGridCellDragEnd, onGridClickHandler } from './month-event-handlers';
import {setCellFocus} from './month-keyboard-handlers';
import { setFocus } from '../../agenda-view/agenda-view';
import moment from 'moment-timezone';


function getHeaderColumn(date, state) {
	setLocale(date, state);
	return <div className="grid-header-cell">
		<span>{date.format('dddd')}</span>
	</div>;
}

export function getHeaderColumns(state) {
	let {startMoment} = state;
	let headerColumns = [];

	const date = startMoment.clone();
	Object.keys(WEEK_DAYS).forEach(() => {
		headerColumns.push(getHeaderColumn(date, state));
		date.add(1, 'days');
	});

	headerColumns.push(<div className="grid-header-cell scrollSpacing" key="scrollSpacing" hook-update={(newVnode) => {
		newVnode.elm.style.width = SCROLL_BAR_WIDTH + 'px';
	}}/>);

	return headerColumns;
}

export function getBodyGrid(state, dispatch, monthViewConfig) {
	const {startMoment, endMoment} = state;
	const dates = getBetweenDates(startMoment, endMoment);
	let rows = [];
	let rowCount = dates.length / 7;
	for (let i = 0; i < rowCount; i++)
		rows.push(getRow(dates.splice(0, 7), i, state, dispatch, monthViewConfig));
	return rows;
}

function getRow(dates, rowIndex, state, dispatch, monthViewConfig) {
	const createAllowed = isCreateAllowed(state);
	const cells = [];
	dates.map((date, colIndex) => {
		cells.push(getCell(date, createAllowed, rowIndex, colIndex, state, dispatch, monthViewConfig));
	});
	return <div className="grid-row" key={`grid-row-${rowIndex}`}>
		{cells}
	</div>;
}

function dateClicked(event, state, date, dispatch) {
	const {contextualPanelCurrentView} = state;
	if (contextualPanelCurrentView !== 'agenda-view')
		dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView : 'agenda-view'});
	dispatch('PROPERTIES_SET', { contextDate:  date});
	setFocus(event);
}

function getCell(cellMoment, createAllowed, rowIndex, colIndex, state, dispatch, monthViewConfig) {
	const isDayViewConfigured = state.availableViewNames.indexOf(VIEWS.DAY) !== -1;
	const {todayMoment, contextMoment} = state;
	let cls = ['grid-cell'];
	const dateMonth = cellMoment.month();
	const contextDateMonth = contextMoment.month();

	let dateNumber = cellMoment.date();

	if ((dateMonth !== 0 && dateMonth < contextDateMonth) || (dateMonth === 11 && contextDateMonth === 0)) {
		cls.push('previous-month');
		if (moment(contextMoment).add(-1, 'month').endOf('month').isSame(cellMoment, 'day')) {
			dateNumber = setLocale(moment(cellMoment), state).format(INTERNAL_FORMAT.DATE_MONTH_ABBR);
			cls.push('previous-next-abbr');
		}
	}
	else if ((dateMonth !== 0 && dateMonth > contextDateMonth) || (dateMonth === 0 && contextDateMonth === 11)) {
		cls.push('next-month');
		if (moment(contextMoment).add(1, 'month').startOf('month').isSame(cellMoment, 'day')) {
			dateNumber = setLocale(moment(cellMoment), state).format(INTERNAL_FORMAT.DATE_MONTH_ABBR);
			cls.push('previous-next-abbr');
		}
	}
	else {
		cls.push('current-month');
	}
	if (todayMoment && cellMoment.isSame(todayMoment, 'day')) {
		cls.push('today');
	}
	const blockSpan = getBlockSpanOnDate(state, cellMoment, true /* full day blocked */);
	let markSpanStyles;
	if(blockSpan) {
		markSpanStyles = getMarkSpanStyles(blockSpan);
		cls.push('block');
	}

	createAllowed = createAllowed && !blockSpan;
	if (createAllowed)
		cls.push('clickable');

	let dateCls = ['date-number'];
	if (isDayViewConfigured)
		dateCls.push('cursor-pointer');
	if (cellMoment.isSame(contextMoment, 'day'))
		dateCls.push('context-date-header');

	const styles = {};
	if (colIndex === 0)
		styles.height = monthViewConfig.rowHeights[rowIndex] + 'px';

	return <div className={cls.join(' ')}
		style={styles}
		attrs={!isCreateAllowed(state) ? {} : { tabindex: '-1' }}
		aria-label={cellMoment.format(INTERNAL_FORMAT.ARIA_DATE_FORMAT)}
		on-dragstart={createAllowed ? (mouseEvent) => onGridCellDragStart(mouseEvent, state, dispatch, monthViewConfig) : null}
		on-dragend={createAllowed ? (mouseEvent) => onGridCellDragEnd(mouseEvent, state, dispatch) : null}
		draggable={createAllowed ? 'true' : 'false'}
		on-click={(mouseEvent) => createAllowed ? onGridClickHandler(mouseEvent, cellMoment, state, dispatch) : null}
		on-keydown={(mouseEvent) => (createAllowed && mouseEvent.which === KEYS.ENTER) ? onGridClickHandler(mouseEvent, cellMoment, state, dispatch) : null}>
		{
			blockSpan ? <div className="mark-span" tabIndex="-1" aria-label={blockSpan.title} style={markSpanStyles}/> : ''
		}
		<div className="grid-cell-header" style={{height: monthViewConfig.cellHeaderHeight + 'px'}}>
			<div className={dateCls.join(' ')} tabindex="-1" on-click={(e) => {
				dateClicked(e, state, cellMoment, dispatch);
			}}
			on-keydown={(e) => { e.which === KEYS.ENTER ? dateClicked(e, state, cellMoment, dispatch) : null; }}
			role='link'
			aria-label={moment(cellMoment).format(INTERNAL_FORMAT.ARIA_DATE_FORMAT)}
			>
				{dateNumber}
			</div>
		</div>
		<div className="grid-cell-content"/>
	</div>;
}

export function renderMonthViewGrid(state, dispatch, monthViewConfig) {
	return <div className="grid-area">
		<div className="grid-body-wrapper">
			<div className="grid-body"
				hook-update={(newVnode) => setTimeout(() => setCellFocus(state, dispatch, newVnode.elm))}>
				{getBodyGrid(state, dispatch, monthViewConfig)}
			</div>
		</div>
	</div>;
}

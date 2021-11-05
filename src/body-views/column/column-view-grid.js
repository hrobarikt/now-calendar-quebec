import moment from 'moment-timezone';
import {getColumns} from './column-helper';
import {getTimeFromStartOfDay, isCreateAllowed, setLocale} from '../../util';
import {onGridCellClick} from './column-event-handlers';
import {onChunkEventCreateDragEnd, onChunkEventCreateDragStart} from './column-event-handlers/chunk-event-handlers';
import {INTERNAL_FORMAT, ROW_SPAN_HEIGHT_IN_PX} from '../../constants';

function getValueOnTimeAxis(timeRowSpan, r,  currentDateFormats, todayCol, state) {
	const {startMoment, todayMoment} = state;
	const minimumGap = timeRowSpan / 10;
	const todayTimeInMins = getTimeFromStartOfDay(todayMoment, 'm');
	let rowMoment = moment(startMoment).add(r * timeRowSpan, 'm');
	if (todayCol !== undefined) {
		const rowTimeInMins = getTimeFromStartOfDay(rowMoment, 'm');
		if (Math.abs(todayTimeInMins - rowTimeInMins) <= minimumGap)
			return '';
	}
	return setLocale(rowMoment, state).format(currentDateFormats.timeFormat);
}

export function renderColumnViewScale({numberOfDays, timeRowSpan, currentDateFormats, todayCol}, state, dispatch) {
	const totalTimeRows = 24 * 60 / timeRowSpan;

	const rows = [];
	for (let r = 0; r < totalTimeRows; r++) {
		let timeVal = getValueOnTimeAxis(timeRowSpan, r, currentDateFormats, todayCol, state);
		let cols = [
			<div className="item colTime" aria-label={r !== 0 ? timeVal : ''}>
				{
					r !== 0 ? <div className="time">{timeVal}</div> : ''
				}
			</div>,
			<div className="item"/> /* leave remaining space empty in the row */
		];

		rows.push(<div className="row">
			{cols}
		</div>);
	}

	return <div className="table">
		{rows}
	</div>;
}

export function renderColumnViewGrid(viewSettings, state, dispatch) {
	let {numberOfDays, timeRowSpan, splitRow, todayCol} = viewSettings;

	timeRowSpan = timeRowSpan / splitRow;
	let totalTimeRows = 24 * 60 / timeRowSpan;
	const {startMoment} = state;

	let createAllowed = isCreateAllowed(state);
	const rowStyle = {
		height: ROW_SPAN_HEIGHT_IN_PX  + 'px'
	};
	if(splitRow > 1)
		rowStyle.height = (ROW_SPAN_HEIGHT_IN_PX / splitRow) + 'px'
	const rows = [];
	for (let r = 0; r < totalTimeRows; r++) {
		let cols = [];
		cols = cols.concat(getColumns(state, numberOfDays, c => 'gridSpan', c => {
			let cls = ['grid'];
			if (splitRow) {
				cls.push('splitRow');
				if (r % splitRow !== 0)
					cls.push('lightBorder');
			}
			if (todayCol !== undefined && todayCol === c)
				cls.push('today');
			if (createAllowed)
				cls.push('clickable');
			return {className: cls.join(' '), style: rowStyle};
		}, c => {
			if (!createAllowed)
				return null;
			return () => {
				const clickEventStartMoment = moment(startMoment).add(c, 'days').add(r * timeRowSpan, 'm');
				const clickEventEndMoment = moment(clickEventStartMoment).add(timeRowSpan, 'm');
				if (!clickEventStartMoment.isSame(clickEventEndMoment, 'date') && clickEventEndMoment.hour() === 0 && clickEventEndMoment.second() === 0) {
					clickEventEndMoment.add(-1, 'ms');
				}
				onGridCellClick(clickEventStartMoment, clickEventEndMoment, state, dispatch);
			};
		},
		(c) => {
			const cellStartMoment = moment(startMoment).add(c, 'days').add(r * timeRowSpan, 'm');
			return cellStartMoment.format(INTERNAL_FORMAT.ARIA_DATE_TIME_FORMAT);
		}));

		rows.push(<div className="row"
					   draggable={createAllowed + ''}
					   ondragstart={(event) => onChunkEventCreateDragStart(event, viewSettings, state, dispatch)}
					   ondragend={(event) => onChunkEventCreateDragEnd(event, viewSettings, state, dispatch)}>
			{cols}
		</div>);
	}

	return <div className="table">
		{rows}
	</div>;
}

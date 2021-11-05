import moment from 'moment-timezone';
import {SCROLL_BAR_WIDTH, setLocale} from '../../util';
import {INTERNAL_FORMAT, KEYS, ACTIONS} from '../../constants';
import {getMultidayEventsHtml} from './column-view-multiday-event';
import {t} from 'sn-translate';
import { setFocus } from '../../agenda-view/agenda-view';

function renderColumnViewHeader(viewSettings, templateRenderer, multiDayChunkEvents, state, dispatch) {
	const {showHeader, numberOfDays, todayCol} = viewSettings;
	const {properties: props, contextualPanelCurrentView} = state;

	if (!showHeader)
		return '';

	const {startMoment, contextMoment} = state;

	function onDateClick(event, colDate) {
		if (contextualPanelCurrentView !== 'agenda-view')
			dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView : 'agenda-view'});
		dispatch('PROPERTIES_SET', {contextDate: colDate});
		setFocus(event);
	}

	const headerCols = [];

	for (let c = 0; c < numberOfDays; c++) {
		const colDate = moment(startMoment).add(c, 'days');
		const cls = ['item', 'colDate'];
		const dateCls = ['date-number', 'clickable'];


		if (todayCol !== undefined && todayCol === c)
			cls.push('today');
		
		if (colDate.isSame(contextMoment, 'day'))
			cls.push('contextDate');


		headerCols.push(<div className={cls.join(' ')}>
			<div className="day">{setLocale(colDate, state).format(INTERNAL_FORMAT.DAY)}</div>
			<div className={dateCls.join(' ')}
				on-click={(event) => {
					onDateClick(event, colDate);
				}}
        		on-keydown={(event) => { event.which === KEYS.ENTER ? onDateClick(event, colDate) : null; }}
				tabIndex="-1"
				role='link'
				aria-label={setLocale(colDate, state).format(INTERNAL_FORMAT.ARIA_DATE_FORMAT)}
			>{setLocale(colDate, state).format(INTERNAL_FORMAT.ONLY_DATE)}
			</div>
		</div>);
	}

	return (<div className="column-view-header">
		<div className="table">
			<div className="row date-header-row">
				<div className="item"></div>
				{headerCols}
				<div className="item scrollSpacing" key="scrollSpacing" hook-update={(newVnode) => {
					newVnode.elm.style.width = SCROLL_BAR_WIDTH + 'px';
				}}/>
			</div>
		</div>
		<div className="table">
			{getMultidayEventsHtml(viewSettings, templateRenderer, multiDayChunkEvents, state, dispatch)}
		</div>
	</div>);
}

export default renderColumnViewHeader;

import {getCurrentViewSettings} from '../../util';
import {calculateDateRange} from './util';
import {ACTIONS} from '../../constants';

function recalculateDateRange({state, dispatch}) {
	const {firstDayOfWeek:startDay} = state.properties;
	let {numberOfDays} = getCurrentViewSettings(state);
	let {startMoment, endMoment} = calculateDateRange(state.contextMoment, numberOfDays, startDay);
	if (!state.startMoment || !state.endMoment || !state.startMoment.isSame(startMoment) || !state.endMoment.isSame(endMoment)) {
		dispatch(ACTIONS.INTERNAL_STATE_SET, {startMoment, endMoment});
		setTimeout(() => dispatch(ACTIONS.RANGE_UPDATED, {startMoment: startMoment.clone(), endMoment: endMoment.clone(), startMS: startMoment.valueOf(), endMS: endMoment.valueOf()}), 1);
	}
}

const ActionHandlers = {
	[ACTIONS.VIEW_CHANGED]: recalculateDateRange,
	[ACTIONS.CONTEXT_DATE_CHANGED]: recalculateDateRange,
};

export default ActionHandlers;

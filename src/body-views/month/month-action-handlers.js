import {ACTIONS} from '../../constants';
import {calculateDateRange} from './utils';

function recalculateDateRange({state, dispatch}) {
	const {firstDayOfWeek:startDay} = state.properties;
	const {startMoment, endMoment} = calculateDateRange(state.contextMoment, startDay);

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

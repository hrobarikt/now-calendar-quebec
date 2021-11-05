/// @ts-check
import {ACTIONS} from '../../constants';
import {calculateDateRange} from '../column/util';
import { getCurrentViewSettings } from '../../util';

/**
 * @param {{state: import('../../..').CalendarState, dispatch: import('../../..').appDispatch}} {state, dispatch}
 */

function recalculateDateRange({state, dispatch}) {
	const {firstDayOfWeek:startDay} = state.properties;
	let {numberOfDays} = getCurrentViewSettings(state);
	const {startMoment, endMoment} = calculateDateRange(state.contextMoment, numberOfDays, startDay);
	state.timelineView.triggerRangeUpdated(startMoment, endMoment, dispatch);
}

const ActionHandlers = {
	[ACTIONS.VIEW_CHANGED]: recalculateDateRange,
	[ACTIONS.CONTEXT_DATE_CHANGED]: recalculateDateRange,
};

export default ActionHandlers;

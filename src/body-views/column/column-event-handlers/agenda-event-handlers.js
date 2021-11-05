import {getMomentByPositionChange, getMousePositionDayTime, isPositionChanged} from '../util';
import moment from 'moment-timezone';
import {ACTIONS, EVENT_STATES} from '../../../constants';
import {anyToMoment, clearTemporaryEvent, dispatchEventMove, getEventById, isMoveAllowed, scrollViewOnEventDrag} from '../../../util';
import {getCurrentPosition, updateSettingsOnDrag} from './event-handler-utils';


/* ****************************** *
 * Agenda event move handlers	  *
 * ****************************** */

export function onAgendaDragEnter(event, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	temporaryEventSettings.counter++;
}

export function onAgendaEventDragOver(mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings, startMoment} = state;
	const {tempEvent, originalEvent} = temporaryEventSettings;
	const currentPosition = getCurrentPosition(mouseEvent, viewSettings, state);
	scrollViewOnEventDrag(mouseEvent);

	// Apply new styles only when mouse position changes
	if (!temporaryEventSettings.previousPosition || isPositionChanged(currentPosition, temporaryEventSettings.previousPosition, true)) {
		let tempStartMoment = moment(startMoment).add(currentPosition.day, 'd').add(currentPosition.stepTime, 's');
		let tempEndMoment = anyToMoment(originalEvent.endMS, state.properties).add(tempStartMoment.diff(anyToMoment(originalEvent.startMS, state.properties)));
		tempEvent.startMS = tempStartMoment.valueOf();
		tempEvent.endMS = tempEndMoment.valueOf();
		updateSettingsOnDrag(viewSettings, state, dispatch, {
			tempEvent,
			previousPosition: currentPosition
		});
	}
}

export function onAgendaEventDragLeave(event, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	temporaryEventSettings.counter--;
	if (temporaryEventSettings.counter === 0) {
		temporaryEventSettings.eventState = EVENT_STATES.ONDRAGLEAVE;
		setTimeout(() => {
			dispatch(ACTIONS.INTERNAL_STATE_SET, {...temporaryEventSettings});
		});
	}
}

export function onAgendaEventDrop(mouseEvent, viewSettings, state, dispatch) {
	const {temporaryEventSettings} = state;
	if (!temporaryEventSettings)
		return;

	const {tempEvent, originalEvent} = temporaryEventSettings;
	if (!isMoveAllowed(state, originalEvent))
		return;

	const difference = tempEvent.startMS - originalEvent.startMS;
	if (difference !== 0)
		dispatchEventMove(state, dispatch, originalEvent, difference,  anyToMoment(tempEvent.startMS, state.properties), anyToMoment(tempEvent.endMS, state.properties));
	else
		clearTemporaryEvent(state, dispatch);
}

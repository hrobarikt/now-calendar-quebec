import TemplateRenderer from '../template-renderer';
import {t} from 'sn-translate';
import moment from 'moment-timezone';
import '@servicenow/now-highlighted-value';
import { registerTemplateRenderer } from '../template-renderer';
import {msToFormat} from "../util";



export class AgendaTemplateRenderer extends TemplateRenderer {

	constructor() {
		super();
	}

	agendaContainer(event, props, state, dispatch) {
		let startMS = event.startMS;
		const {todayMoment} = state;
		if (startMS < props.dayStartMoment.valueOf())
			startMS = props.dayStartMoment.valueOf();

		let endMS = event.endMS;
		if (endMS > props.dayEndMoment.valueOf())
			endMS = props.dayEndMoment.valueOf() + 1;
		let showNowLabel = (todayMoment.valueOf() > startMS &&  todayMoment.valueOf() < endMS);
		const durationInMs = endMS - startMS;
		let hrs, mins, secs;
		if ((durationInMs / 1000) - 24*60*60 === 0)
			hrs = 24, mins = 0, secs = 0;
		else {
			const tempMoment = moment().startOf('day').seconds(durationInMs / 1000);
			hrs = tempMoment.hour();
			mins = tempMoment.minute();
			secs = tempMoment.second();	
		}
		const time = msToFormat(startMS, state.properties.timezone, state.properties.timeFormat, state.properties.locale);
		let durationHours;
		let durationMinutes;
		let durationSeconds;
		if (hrs > 1) {
			durationHours = t('{0} hrs', [hrs]);
		} else if (hrs === 1) {
			durationHours = t('{0} hr', [hrs]);
		}
		if (mins > 1) {
			durationMinutes = t('{0} mins', [mins]);
		} else if (mins === 1) {
			durationMinutes = t('{0} min', [mins]);
		}
		if (hrs === 0) {
			if (secs > 1) {
				durationSeconds = t('{0} secs', [secs]);
			} else if (secs === 1) {
				durationSeconds = t('{0} sec', [secs]);
			}
		}

		let cls = ['agenda'];
		if (showNowLabel)
			cls.push('agenda-now');

		return (<div className={cls.join(' ')}>

			<div className="agenda-row">
				<div className="agenda-column">
					<div className="time">{time}</div>
				</div>
				<div className="agenda-column">
					<div className="event-title" title={event.title}>{event.title}</div>
					{
						showNowLabel
							? (<div className="now-label">
								<now-highlighted-value label="now" status="positive" show-icon />
							</div>)
							: ''
					}
				</div>
			</div>
			<div className="agenda-row">
				<div className="agenda-column duration">
					<div className="hours">{durationHours}</div>
					<div className="minutes">{durationMinutes}</div>
					<div className="seconds">{durationSeconds}</div>
				</div>
				<div className="agenda-column" title={event.description}>
					<div className="event-description">
						{event.description}
					</div>
				</div>
			</div>
		</div>
		);
	}
}
export const NOW_CALENDAR_DEFAULT_AGENDA_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_AGENDA_TEMPLATE_RENDERER';
registerTemplateRenderer('AGENDA_VIEW', NOW_CALENDAR_DEFAULT_AGENDA_TEMPLATE_RENDERER, new AgendaTemplateRenderer());
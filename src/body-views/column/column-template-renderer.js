import TemplateRenderer from '../../template-renderer';
import {t} from 'sn-translate';
import {msToFormat} from "../../util";

export const NOW_CALENDAR_DEFAULT_COLUMN_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_COLUMN_TEMPLATE_RENDERER';
export const NOW_CALENDAR_DEFAULT_DAY_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_DAY_TEMPLATE_RENDERER';
export const NOW_CALENDAR_DEFAULT_WEEK_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_WEEK_TEMPLATE_RENDERER';

export function eventContainer(event, props) {
	const {timeFormat, locale, timezone} = props;
	const start = msToFormat(event.startMS, timezone, timeFormat, locale);
	const end = msToFormat(event.endMS, timezone, timeFormat, locale);
	return <div className="event-container">
		<div className="event-title">
			<span>{t('{0} - {1}', start, end)}</span>
			<br/>
			{event.title}
		</div>
		<div className="event-description">
			{event.description}
		</div>
	</div>;
}

export class ColumnTemplateRenderer extends TemplateRenderer{
	constructor() {
		super();
	}

	eventContainer(event, props) {
		return eventContainer(event, props);
	}

	multidayEventContainer(event, props) {
		const {timeFormat, locale, timezone} = props;
		const start = msToFormat(event.startMS, timezone, timeFormat, locale);
		const end = msToFormat(event.endMS, timezone, timeFormat, locale);

		return <div className="event-container">
			<div className="event-title">
				<span>{t('{0} - {1} {2}', start, end, event.title)}</span>
			</div>
		</div>;
	}
}

export class DayTemplateRenderer extends ColumnTemplateRenderer{
	constructor() {
		super();
	}
}

export class WeekTemplateRenderer extends ColumnTemplateRenderer{
	constructor() {
		super();
	}
}


import TemplateRenderer, {registerTemplateRenderer} from '../../template-renderer';
import {t} from 'sn-translate';
import {msToFormat} from "../../util";
import {VIEWS} from '../../constants';
export class MonthTemplateRenderer extends TemplateRenderer{
	constructor() {
		super();
	}

	eventContainer(event, props) {
		const {timeFormat} = props;
		return <div className="event-container">
			<div className="event-text">{t('{0} - {1} {2}', msToFormat(event.startMS, props.timezone, timeFormat), msToFormat(event.endMS, props.timezone, timeFormat), event.title)}</div>
		</div>;
	}
}

export const NOW_CALENDAR_DEFAULT_MONTH_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_MONTH_TEMPLATE_RENDERER';
registerTemplateRenderer(VIEWS.MONTH, NOW_CALENDAR_DEFAULT_MONTH_TEMPLATE_RENDERER, new MonthTemplateRenderer());

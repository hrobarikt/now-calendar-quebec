import {t} from 'sn-translate';
import {registerViewRenderer} from '../view-manager';
import {VIEWS, WEEK_DAYS, TYPES} from '../../constants';
import style from './month.scss';
import renderMonthView from './month-view';
import actionHandlers from './month-action-handlers';
import keyHandlers from './month-keyboard-handlers';
import { NOW_CALENDAR_DEFAULT_MONTH_TEMPLATE_RENDERER } from './month-template-renderer';

const Styles = [style];

registerViewRenderer(VIEWS.MONTH, t('Month'), {
	actionHandlers,
	styles:Styles,
	viewRenderer: {
		renderer:renderMonthView,
		templateRenderer: NOW_CALENDAR_DEFAULT_MONTH_TEMPLATE_RENDERER
	},
	keyHandlers
}, TYPES.CALENDAR);


import {t} from 'sn-translate';
import {registerViewRenderer} from '../view-manager';
import {VIEWS, TYPES} from '../../constants';
import style from './column.scss';
import renderColumnView from './column-view';
import actionHandlers from './column-action-handlers';
import keyHandlers from './column-keyboard-handlers';
import { registerTemplateRenderer } from '../../template-renderer';
import { NOW_CALENDAR_DEFAULT_COLUMN_TEMPLATE_RENDERER, NOW_CALENDAR_DEFAULT_WEEK_TEMPLATE_RENDERER, NOW_CALENDAR_DEFAULT_DAY_TEMPLATE_RENDERER, ColumnTemplateRenderer, DayTemplateRenderer, WeekTemplateRenderer} from './column-template-renderer';

const Styles = [style];
registerTemplateRenderer(VIEWS.COLUMN, NOW_CALENDAR_DEFAULT_COLUMN_TEMPLATE_RENDERER, new ColumnTemplateRenderer());
registerTemplateRenderer(VIEWS.WEEK, NOW_CALENDAR_DEFAULT_WEEK_TEMPLATE_RENDERER, new WeekTemplateRenderer());
registerTemplateRenderer(VIEWS.DAY, NOW_CALENDAR_DEFAULT_DAY_TEMPLATE_RENDERER, new DayTemplateRenderer());
registerViewRenderer(VIEWS.COLUMN, '-', {
	actionHandlers,
	styles:Styles,
	viewRenderer: {
		renderer:renderColumnView,
		defaultParams:{
			numberOfDays:7,
			timeRowSpan:60,
			splitRow: 2,
			showHeader: true
		},
		templateRenderer: NOW_CALENDAR_DEFAULT_COLUMN_TEMPLATE_RENDERER
	},
	keyHandlers
}, TYPES.CALENDAR);
registerViewRenderer(VIEWS.WEEK, t('Week'), {
	actionHandlers,
	styles:Styles,
	viewRenderer: {
		renderer:renderColumnView,
		fixedParams:{numberOfDays:7},
		defaultParams:{
			timeRowSpan:60,
			splitRow: 2,
			showHeader: true
		},
		templateRenderer: NOW_CALENDAR_DEFAULT_WEEK_TEMPLATE_RENDERER
	},
	keyHandlers
}, TYPES.CALENDAR);
registerViewRenderer(VIEWS.DAY, t('Day'), {
	actionHandlers,
	styles:Styles,
	viewRenderer: {
		renderer:renderColumnView,
		fixedParams:{numberOfDays:1},
		defaultParams:{timeRowSpan:60, splitRow: 2, showHeader: true},
		templateRenderer: NOW_CALENDAR_DEFAULT_DAY_TEMPLATE_RENDERER
	},
	keyHandlers
}, TYPES.CALENDAR);

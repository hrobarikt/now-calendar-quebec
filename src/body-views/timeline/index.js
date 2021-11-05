import {t} from 'sn-translate';
import {registerViewRenderer} from '../view-manager';
import {VIEWS, TYPES} from '../../constants';
import actionHandlers from './action-handler';
import  timelineView from './timeline-view';
import style from './timeline.scss';
import {TimelineUnits, MINIMUM_TITLE_WIDTH} from '../timeline/utils';

import keyHandlers from './timeline-keyboard-handlers';
import {TimelineDayTemplateRenderer, TimelineWeekTemplateRenderer} from './template-renderer';
import { registerTemplateRenderer } from '../../template-renderer';

const NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER = 'NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER';
registerTemplateRenderer(VIEWS.TIMELINE_DAY, NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER, new TimelineDayTemplateRenderer());
registerTemplateRenderer(VIEWS.TIMELINE_WEEK, NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER, new TimelineWeekTemplateRenderer());
/**
 * @type{import('../../..').TimelineConfig}
 */
const dayViewParams = {
    eventHeight: 20,
    xStep: 60,
    xSize: 24,
    xStart: 0,
    xUnitName: TimelineUnits.minutes,
    titleWidth: MINIMUM_TITLE_WIDTH,
    viewName: VIEWS.TIMELINE_DAY,
    groupBy: 'group',
    scrollDebounceTime: 100,
    noScrolling: false,
    eventMinWidthMS: 30 * 60 * 1000,  // Make sure it is half the value of xStep in milliseconds
    animation: false
};
/**
 * @type {import('../../..').TimelineConfig}
 */
const weekViewParams = {
	...dayViewParams,
	xStep: 1, // each cell is 1 day
	xSize: 7, // 7 days
	xStart: 0,
	xUnitName: TimelineUnits.days,
	viewName: VIEWS.TIMELINE_WEEK,
	eventMinWidthMS: 6 * 60 * 60 * 1000  // Make sure in week view the minimum width is of 6 hrs
};
const renderer = timelineView();
const dayViewObj = {
	actionHandlers,
	styles: [style],
	viewRenderer: {
		renderer: renderer,
		fixedParams: {
			numberOfDays: 1
		},
		/**
         * @type {import('../../..').TimelineConfig}
         */
		defaultParams: dayViewParams,
		templateRenderer: NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER
	},
	keyHandlers
};

const weekViewObj = {
	actionHandlers,
	styles: [style],
	viewRenderer: {
		renderer: renderer,
		fixedParams: {
			numberOfDays: 7
		},
		/**
         * @type {import('../../..').TimelineConfig}
         */
		defaultParams: weekViewParams,
		templateRenderer: NOW_CALENDAR_DEFAULT_TIMELINE_TEMPLATE_RENDERER
	},
	keyHandlers
};

weekViewObj.viewRenderer.defaultParams = weekViewParams;
registerViewRenderer(VIEWS.TIMELINE_DAY, t('Day'), dayViewObj, TYPES.TIMELINE);
registerViewRenderer(VIEWS.TIMELINE_WEEK, t('Week'), weekViewObj, TYPES.TIMELINE);

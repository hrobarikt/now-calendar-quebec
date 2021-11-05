/// @ts-check
import moment from 'moment-timezone';
import { DIRECTION, INTERNAL_FORMAT, ACTIONS, KEYS, VIEWS } from '../../constants';
import { TimelineUtils } from './utils';
import { setLocale } from '../../util';
import { setFocus } from '../../agenda-view/agenda-view';

export class TimelineHeaderView {
	constructor() {
        this.scrollEl = /**@type {HTMLElement} */(null);
        this.timelabelEl = /**@type {HTMLElement} */(null);
		this.dir = DIRECTION.LTR;
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
	}
	/**
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {moment.Moment} startTime
     * @param {moment.Moment} endTime
	 * @param {import('../../..').appDispatch} dispatch
     */
	getCellView(viewConfig, state, startTime, endTime, dispatch) {
	}
	/**
     * 
     * @param {number} left 
     * @param {number} top 
     */
	onEventAreaScroll(left, top) {
        if (!this.scrollEl)
            return;
        const isRTL = this.dir === DIRECTION.RTL;
        this.scrollEl.style.transform = `translate(${isRTL?Math.abs(left): -left}px, 0px)`;
	}
}

export class TimelineHeaderDayWeekView extends TimelineHeaderView {
	constructor() {
        super();
        this.timelabelWidth = 0;
    }
    /**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
    render(viewConfig, state, dispatch) {
        const { properties: props, contextualPanelCurrentView } = state;
        this.dir = props.dir;
        const isRTL = props.dir === DIRECTION.RTL;
        const cellWidth = TimelineUtils.getCellWidth(viewConfig);
        const isCustomTimeScaleRenderer = viewConfig.templates.timeScaleGrid.value.length > 0;
        let uiCellWidth = `${cellWidth}px`;
        let dates = TimelineUtils.getRenderViewDates(state.startMoment, viewConfig);
        let focuChangeMethod = state.timelineView.onFocusChange.bind(state.timelineView);
        let cellViews = dates.map((thisDate) => {
            const style = {
                width: uiCellWidth,
                minWidth: uiCellWidth,
                maxWidth: uiCellWidth
            };
            const {contextMoment, todayMoment, contextualPanelCurrentView, dataProvider} = state;
            let events = {...dataProvider.allEvents};
            let cls = [];
            if (moment(thisDate.start).startOf('day').isSame(moment(todayMoment).startOf('day')))
			    cls.push('today');
            if (moment(thisDate.start).startOf('day').isSame(moment(contextMoment).startOf('day')))
			    cls.push('contextDate');
            return (<td style={style} className={cls.join(' ')}>{props.timelineTemplateRenderer.getHeaderTimeCellView(viewConfig, props, thisDate.start, thisDate.end, dispatch, events, contextualPanelCurrentView, focuChangeMethod)}</td>);
        });
        let titleStyleObj = {
            width: state.timelineView.titleAreaWidth + 'px',
        };
        if (this.dir === DIRECTION.RTL) {
            titleStyleObj.right = '0px';
        }
        else {
            titleStyleObj.left = '0px';
        }
        const styleHeaderTimeline = {
            padding: `0px ${viewConfig.scrollbarWidth}px 0px 0px`
        };
        const left = isRTL? state.timelineView.viewPort.x : -state.timelineView.viewPort.x;
        const timeScaleGridStyle = {
            width: TimelineUtils.getEventLineWidth(viewConfig) + 'px',
            transform: `translate(${left}px, 0px)`
        };
        const tableStyle = {
            tableLayout: 'fixed',
            ...timeScaleGridStyle,
            transform: ''
        };
        tableStyle.width = `${TimelineUtils.getEventLineWidth(viewConfig)}px`;
        if(isRTL)
            styleHeaderTimeline.padding = `0px 0px 0px ${viewConfig.scrollbarWidth}px`;
        let thisObj = this;
        function customTimeScaleView() {
            /**
             * @type {import('../../..').TimeScaleGridConfig}
             */
            const options = {
                viewConfig,
                calendarProperties: state.properties,
                stepRanges: state.timelineView.gridStepRanges,
                cellWidth
            };
            return <div className="time-scale-grid">
                        {state.properties.timelineTemplateRenderer.renderTimeScale(options)}
                    </div>
        }
        function defaultTimeScaleView() {
            return <table role="presentation" style={tableStyle} className="timeline-header-slots" cellSpacing="0" cellPadding="0">
                        <tr>
                            {cellViews}
                        </tr>
                    </table>
        }
        const posX = (state.todayMoment.valueOf() - state.utcViewStartMS) * 100 / (state.utcViewEndMS - state.utcViewStartMS);
        /**
         * @type {import('react').CSSProperties}
         */
        const todayTimeLableStyle = {
        };
        const isInView = state.todayMoment.isBetween(state.startMoment, state.endMoment);
        if (isInView && this.timelabelEl) {
            if(isRTL)
                todayTimeLableStyle.right = `calc(${posX}% - ${this.timelabelEl.clientWidth/2}px)`;
            else
                todayTimeLableStyle.left = `calc(${posX}% - ${this.timelabelEl.clientWidth/2}px)`;
        }
        /**
         * @type {import('react').CSSProperties}
         */
        const timeScaleStyle = {
            gridTemplateColumns: `${viewConfig.titleWidth}px auto`
        };
        return <div className="timeline-timescale-area" style={timeScaleStyle}>
                    <div className="timescale-header-section">
                        {props.timelineTemplateRenderer.renderSectionTitle(viewConfig, state.properties)}
                    </div>
                    <div className="timescale-body-section">
                        <div className="header-timeline-wrapper" style={timeScaleGridStyle}
                            ref={ (el) => {
                                thisObj.scrollEl = el;
                            }}>
                            {isCustomTimeScaleRenderer? customTimeScaleView(): defaultTimeScaleView()}
                            {isInView ? <div className="current-time" style={todayTimeLableStyle}
                            hook-insert={ ({elm}) => {
                                thisObj.timelabelEl = elm;
                                requestAnimationFrame( () => {
                                    thisObj.timelabelWidth = thisObj.timelabelEl.getBoundingClientRect().width;
                                });
                            }}><label aria-hidden="true">{state.todayMoment.tz(state.properties.timezone).format(state.properties.timeFormat)}</label></div>: null}
                        </div>
                    </div>
            </div>
    }
}

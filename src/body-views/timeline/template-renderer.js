/// @ts-check
import moment from 'moment-timezone';
import {ACTIONS, DIRECTION, INTERNAL_FORMAT, KEYS, VIEWS, TEMPLATE_TYPE} from '../../constants';
import {LEVEL_INTENDATION, TimelineUtils} from './utils';
import {setFocus} from '../../agenda-view/agenda-view';
import TemplateRenderer from '../../template-renderer';
import {t} from 'sn-translate';
import { cloneDeep } from 'lodash';

/**
 * @typedef {import('../../..').CalendarTemplateItem} CalendarTemplateItem
 * @typedef {import('../../..').CalendarProperties} CalendarProps
 * @typedef {import('../../..').TimelineConfig} TimelineViewConfig
 * @typedef {import('./event-row-view').EventSection} EventSection
*/



export class TimelineTemplateRenderer extends TemplateRenderer{
	constructor() {
		super();
		this.viewStartMS = 0;
		this.viewEndMS = 0;
	}

	/**
 	 * @param {CalendarTemplateItem} templateItem
 	 * @param {{viewConfig: TimelineViewConfig, calendarProperties: CalendarProps}} options
	*/
	renderCustomTemplate(templateItem, options) {
		templateItem = {...templateItem};
		const {viewConfig, calendarProperties } = options
		delete options.viewConfig;
		delete options.calendarProperties;
		const originalViewConfig = calendarProperties.viewSettings[calendarProperties.currentView];
		for(const key in viewConfig)
			originalViewConfig[key] = viewConfig[key];
		if (templateItem.type === TEMPLATE_TYPE.MACROPONENT && !templateItem.value.startsWith(`${TEMPLATE_TYPE.MACROPONENT}-`))
			templateItem.value = `${TEMPLATE_TYPE.MACROPONENT}-${templateItem.value}`;
		const componentOptions = {
			...options,
			...calendarProperties,
			viewConfig: originalViewConfig,
			viewStartMS: this.viewStartMS,
			viewEndMS: this.viewEndMS
		}
		return <templateItem.value  {...componentOptions} />
	}
	/**
	 * 
	 * @param {number} start 
	 * @param {number} end 
	 */
	setViewStartAndEnd(start, end) {
		this.viewStartMS = start;
		this.viewEndMS = end;
	}
	getTemplateStyle() {
		return '';
	}

	/**
	 * 
	 * @param {import('../../..').TimeScaleGridConfig} config 
	 */
	renderTimeScale(config) {
		return this.renderCustomTemplate(config.viewConfig.templates.timeScaleGrid, config);
	}
	/**
	 * 
	 * @param {import('../../..').GridTemplateConfig} config 
	 */
	renderMainGrid(config) {
		const { viewConfig, stepRanges, cellWidth } = config;
		if (viewConfig.templates.mainGrid.value.length > 0)
			return this.renderCustomTemplate(viewConfig.templates.mainGrid, config);
		const thisObj = this;
		let thisCellWidth = cellWidth + 'px';
		const thisTime = moment.utc(Date.now());
		return  <table role="presentation" cellSpacing="0" cellPadding="0" style={{ height: '100%', width: '100%', tableLayout: 'fixed' }}>
					<tbody>
						<tr>
							{stepRanges.map( (stepRange) => {
								/**
								 * @type {import('../../..').SubGridTempalateConfig}
								 */
								const subGridViewArgs = {...config,  stepRange};
								const cls = [];
								if (viewConfig.viewName === VIEWS.TIMELINE_WEEK) {
									if (thisTime.isBetween(stepRange.start, stepRange.end))
										cls.push('today');
								}
								const styleObj = {
									width: thisCellWidth,
									minWidth: thisCellWidth,
									maxWidth: thisCellWidth,
									height: viewConfig.eventAreaScrollHeight + 'px'
								};
								return (<td style={styleObj} className={cls.join(' ')}>
											{viewConfig.splitRow > 1? thisObj.renderSubGridView(subGridViewArgs): null}
										</td>)
							})}
						</tr>
					</tbody>
				</table>
	}
	/**
	 * @param {import('../../..').SubGridTempalateConfig} config
	 */
	renderSubGridBody(config) {
		return null;
	}
	/**
	 * 
	 * @param {import('../../..').SubGridTempalateConfig} config 
	 */
	renderSubGridView(config) {
		const { viewConfig } = config;
		const gridItems = [];
		let columnTemplate = '';
		for(let i = 0; i < viewConfig.splitRow; i++) {
			gridItems.push(<div class={{"light-border": i !== viewConfig.splitRow - 1}}>
				{this.renderSubGridBody(config)}
			</div>);
			columnTemplate += 'auto ';
		}
		columnTemplate = columnTemplate.trim()
		/**
		 * @type {import('react').CSSProperties}
		 */
		const styleObj = {
			gridTemplateColumns: columnTemplate,
		};
		return <div style={styleObj} className={"visual-grid"}>
			{gridItems}
		</div>
	}
	/**
	 * 
	 * @param {moment.Moment} momentObject 
	 * @param {import('../../..').CalendarProperties} props 
	 */
	setLocale(momentObject, props) {
		momentObject.locale(props.locale);
		return momentObject;
	}

	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 * @param {moment.Moment} startTime
	 * @param {moment.Moment} endTime
	 * @param {import('../../..').appDispatch} dispatch
	 * @param {?import('../../util/').CalendarEvent[]} events
	 * @param {?string} contextualPanelCurrentView
	 */
	getHeaderTimeCellView(viewConfig, props, startTime, endTime, dispatch, events, contextualPanelCurrentView, onFocusChange) {
		if (viewConfig.viewName === VIEWS.TIMELINE_WEEK) {
			const cls = [];
			const dateCls = ['date-number', 'clickable'];
			const onDateClick = /**
				* @param {any} event
				* @param {moment.Moment} date
				*/
				(event, date, keyFocus) => {
					if (keyFocus)
						onFocusChange(date);
					else {
						if (contextualPanelCurrentView !== 'agenda-view')
							dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView: 'agenda-view' });
						dispatch('PROPERTIES_SET', { contextDate: date });
						setTimeout(() => setFocus(event), 500);
					}
				};

			return (<div>
				<div className="day">{this.setLocale(startTime, props).format(INTERNAL_FORMAT.DAY)}</div>
				<div className={dateCls.join(' ')}
					tabindex='-1'
					on-keydown={(event) => { event.which === KEYS.ENTER ? onDateClick(event, startTime, false) : null; }}
					on-mousedown={(mouseEvent) => {
						onDateClick(mouseEvent, startTime, false);
					}}
					on-focus={(event) => onDateClick(event, startTime, true)}
					aria-label={this.setLocale(startTime, props).format(INTERNAL_FORMAT.ARIA_DATE_FORMAT)}
				>
					{this.setLocale(startTime, props).format(INTERNAL_FORMAT.ONLY_DATE)}
				</div>
			</div>);
		}
		return <span>{startTime.format(props.timeFormat)}</span>;
	}
	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	renderSectionTitle(viewConfig, props) {
		return (<slot name="timeline-section-title"></slot>);
	}
	/**
	 * @param {import('../../..').TimelineVerticalLineDef} line
	 * @param {import('../../..').CalendarProperties} props
	 */
	renderVerticalLineBody(line, props) {
		return [];
	}
	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 * @param {import('./event-row-view').EventSection} section
	 */
	renderSectionHeader(viewConfig, props, section) {
		const padding = (section.level + 1) * LEVEL_INTENDATION;
		const ARIA_LABEL_COLLAPSED = t('Collapsed, click to expand {0}', section.title);
		const ARIA_LABEL_EXPANDED = t('Expanded, click to collapse {0}', section.title);
		let ariaLabel = ARIA_LABEL_EXPANDED;
		let style = {
			padding: `0px 0px 0px ${padding}px`,
		};
		if (props.dir === DIRECTION.RTL)
			style.padding = `0px ${padding}px 0px 0px`;

		let iconName = 'chevron-down-outline';
		if (section.isCollapsed) {
			ariaLabel = ARIA_LABEL_COLLAPSED;
			iconName = 'chevron-right-outline';
			if (props.dir === DIRECTION.RTL) {
				iconName = 'chevron-left-outline';
			}
		}
		if (viewConfig.templates.sectionHeadTitle.value.length > 0) {
			const options = {
				isCollapsed: section.isCollapsed,
				calendarProperties: props,
				viewConfig: viewConfig,
				intendation: LEVEL_INTENDATION,
				level: section.level,
				section: section.rawSection
			};
			return <div className='row-header' style={style}>
						{this.renderCustomTemplate(viewConfig.templates.sectionHeadTitle, options)}
					</div>
		}

		return <div className='row-header' style={style}>
			<span section_id={section.id}>
				<now-icon icon={iconName} size='md' style={{color: 'RGB(var(--now-color--neutral-12,66,80,81))'}} className='row-header-icon clickable' attrs={{'section_id': section.id}}> </now-icon>
			</span>
			<span title={section.title} aria-label={ariaLabel} className='row-header-title'>{section.title}</span>
		</div>;
	}
	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 * @param {import('./event-row-view').EventSection} section
	 */
	renderEventSectionHeader(viewConfig, props, section) {
		if (viewConfig.templates.sectionHeadBody.value.length > 0) {
				const options = {
					isCollapsed: section.isCollapsed,
					section: section.rawSection,
					calendarProperties: props,
					viewConfig: viewConfig
				};
				return this.renderCustomTemplate(viewConfig.templates.sectionHeadBody, options);
			}
		return [];
	}
	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 * @param {import('./event-row-view').EventRow} row
	 */
	renderRowTitle(viewConfig, props, row) {
		const expandCollapseIconSize = 10;
		const padding = (row.level + 1) * LEVEL_INTENDATION + expandCollapseIconSize;
		let titleStyle = {
			padding: `0px 0px 0px ${padding}px`
		};
		if (props.dir === DIRECTION.RTL) {
			titleStyle = {
				padding: `0px ${padding}px 0px 0px`,
			};
		}
		if(viewConfig.templates.rowTitle.value.length > 0) {
			const section = TimelineUtils.findSection((/**@type {EventSection} */(row.parent)).rawSection, row.id);
			const options = {
				viewConfig: viewConfig,
				section,
				calendarProperties: props,
				rowId: row.id
			};
			return this.renderCustomTemplate(viewConfig.templates.rowTitle, options);
		}
		return (<span attrs={{title: row.title}} style={titleStyle}>{row.title}</span>);
	}

	/**
	 * 
	 * @param {import('../../..').RowBackgroundTemplateConfig} config
	 */
	renderRowBackground(config) {
		const { viewConfig } = config;
		if(viewConfig.templates.rowBody.value.length === 0)
			return null;
		return <div style={{width: "100%", height: "100%"}}>
			{this.renderCustomTemplate(viewConfig.templates.rowBody, config)}
		</div>
	}
	/**
	 * @param {import('../../..').CalendarProperties} props
	 * @param {import('../../..').TimelineConfig} viewConfig
	 * @param {import('./event-row-view').TimelineEvent} event
	 * @param {import('../../..').appDispatch} dispatch
	 */
	renderEventBody(viewConfig, props, event, dispatch, viewStartMS, viewEndMS) {
		if(viewConfig.templates.eventBody.value.length === 0)
			return (<span>{event.rawEvent.title}</span>);
		const options = {
			viewConfig: viewConfig,
			calendarProperties: props,
			event: event.rawEvent.rawEvent
		};
		return this.renderCustomTemplate(viewConfig.templates.eventBody, options);
	}
}

export class TimelineDayTemplateRenderer extends TimelineTemplateRenderer {
	constructor() {
		super();
	}
}

export class TimelineWeekTemplateRenderer extends TimelineTemplateRenderer {
	constructor() {
		super();
	}
}

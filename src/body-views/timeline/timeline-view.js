/// @ts-check
import { TimelineUtils, DEFAULT_SECTION_KEY, DEFAULT_HEADER_HEIGHT, TEMPLATE_NAMES } from './utils';
import { TimelineHeaderView, TimelineHeaderDayWeekView } from './header-view';
import { EventSection, EventRow, TimelineEvent, EventLine } from './event-row-view';
import { DIRECTION, ACTIONS, VIEWS, EVENT_TYPES, KEYS, TEMPLATE_TYPE } from '../../constants';
import { calculateDateRange } from '../column/util';
import { Rectangle } from './rectangle';
import { setCellFocusOnLoad } from './timeline-keyboard-handlers';
import { TimelineTemplateRenderer } from './template-renderer';
import moment from 'moment-timezone';
import { t } from 'sn-translate';
import {
	clearTemporaryEvent,
	dispatchEventMove,
	getCurrentViewTemplateRenderer,
	getDirProperty,
	getGradientBackground,
	getMarkSpanById,
	getProcessedMarkSpans,
	Log,
	updateContainerHeight,
	updateTooltip,
	dispatchDragNewEventEnd
} from '../../util';
import { CalendarEvent } from '../../util/calendarEvent';
import { isValidKeyEvent } from "../../util/keyboardAccessibility";

const scrollDirection = {
	topLeft: 1,
	top: 2,
	topRight: 3,
	right: 4,
	bottomRight: 5,
	bottom: 6,
	bottomLeft: 7,
	left: 8
};
export class TimelineViewBase {
	constructor() {
		this.prevRangeStartMS = -1;
		this.prevRangeEndMS = -1;
		this.timelineEl = /** @type {HTMLDivElement}*/(null);
		/**
         * @type {TimelineHeaderView}
         */
		this.headerView = null;
		this.scrollLeft = 0;
		this.scrollTop = 0;
		this.titleSectionScrollEL = /**@type {HTMLDivElement} */(null);
		this.timeScaleHost = /**@type {HTMLDivElement} */(null);
		/**
		 * @type {Map<string, Array<TimelineEvent>>}
		 */
		this.eventGroupMap = new Map();
		/**
         * @type{Map<string, EventRow>}
         */
		this.rowMap = new Map();
		/**
         * @type {Map<string, TimelineEvent>}
         */
		this.eventMap = new Map();
		/**
         * @type {Map<string, EventSection>}
         */
		this.sectionMap = new Map();
		/**
		 * @type {Map<string, EventSection>}
		 */
		this.rawSectionMap = new Map();
		this.isInitialScrolling = false;
		this.isNegativeScrolling = false;
		this.layoutVersion = -1;
		this.needsPartialLayout = false;
		this.isFullLayoutScheduled = false;
		this.newLayoutVersion = 0;
		/**
		 * @type {Array<EventSection>}
		 */
		this.eventSections = /**@type {Array<EventSection>}*/([]);
		/**
         * @type {Function}
         */
		this.scrollDebounce = null;
		/**
         * @type {Function}
         */
		this.resizeDebounce = null;
		this.viewPort = /**@type {Rectangle} */(null);
		this.scrollBarWidth = 0;
		this.scrollBarHeight = 0;

		this.eventAreaClientWidth = 0;
		this.eventAreaClientHeight = 0;
		this.eventAreaScrollHeight = 0;
		this.eventAreaScrollWidth = 0;
		this.sectionHeight = 0;
		this.timescaleHeight = 0;
		this.scroller = /**@type {HTMLDivElement} */(null);
		this.scrolee = /**@type {HTMLDivElement} */(null);
		this.dispatch = /**@type {import('../../..').appDispatch} */(null);
		this.state = /** @type {import('../../..').CalendarState}*/(null);
		this.viewConfig = /** @type {import('../../..').TimelineConfig} */(null);
		this.previousDir = '';
        /**
         * @type  { ReturnType<typeof EventRow.prototype.handleMouseDownAction>}
        */
		this.currentTransactionHandler = null;
        /**
         * @type  { ReturnType<typeof EventRow.prototype.handleMouseDownAction>}
        */
		this.pendingTransactionHandler = null;
		this.templateRenderer = new TimelineTemplateRenderer();
        /**
         * @type {Map<String, boolean>}
         */
		this.layoutPropMap = new Map();
		const properties = ['events', 'sections', 'contextDate', 'timezone', 'currentView'];
		properties.forEach((name) => {
			this.layoutPropMap.set(name, true);
		});
		/**
         * @type {ReturnType<typeof EventSection.prototype.scheduleLayout>}
         */
		this.layoutScheduler = null;
		this.eventMouseHoverTimerId = -1;
		this.layoutDebouncer = TimelineUtils.debounce(() => {
			this.initiateLayout();
		}, 0, false);

		this.isActiveView = true;
        /**
         * @type {TimelineEvent}
         */
		this.activeTimelineEvent = null;
        /**
         * @type {string}
         */
		this.selectedRowId = '';
		this.scrollTimerId = -1;
		this.currentScrollDirection = -1;
		this.titleAreaWidth = -1;
		this.isSectionTitleFocusInProgress = false;
		/**
		 * @type {Array<import('../../..').StepRange>}
		 */
		this.gridStepRanges = [];
		this.agendaViewUpdateDebouncer = TimelineUtils.debounce( /**
                * @param {string} currentRowId
                */
			(currentRowId) => {
				if (!this.isActiveView)
					return;
				if (!currentRowId)
					for (let i = 0; i < this.eventSections.length; i++) {
						for (let j = 0; j < this.eventSections[i].collection.length; j++) {
							let item = this.eventSections[i].collection[j];
							if (item instanceof EventRow) {
								currentRowId = item.id;
								break;
							}
						}
						if (currentRowId)
							break;
					}
				if (this.state.agendaViewSectionEvents && Array.isArray(this.state.agendaViewSectionEvents.events))
					this.state.agendaViewSectionEvents.events.forEach((e) => {
						e.uninitializeMoment();
					});
				let currentRow = this.rowMap.get(currentRowId);
				if (!currentRow)
					return;
				this.selectedRowId = currentRowId;
				const contextMomentStart = moment(this.state.contextMoment).startOf('day');
				const contextMomentEnd = moment(this.state.contextMoment).endOf('day');
				const filterStartMS = contextMomentStart.tzValueOf();
				const filterEndMS = contextMomentEnd.tzValueOf();

				let thisRowEvents = [];
				for (let i = 0; i < currentRow.events.length; i++) {
					let thisEvent = currentRow.events[i];
					if (thisEvent.rawEvent.endMS + thisEvent.rawEvent.endUTCOffsetMS < filterStartMS)
						continue;
					if (thisEvent.rawEvent.startMS + thisEvent.rawEvent.startUTCOffsetMS > filterEndMS)
						continue;
					thisRowEvents.push(thisEvent.rawEvent);
				}
				this.dispatch(ACTIONS.INTERNAL_STATE_SET, {
					agendaViewSectionEvents: {
						events: thisRowEvents,
						section: currentRow.title
					}
				});
			}, 100, false);
		this.visiblityObserverTimerId = -1;
		this.coreDivHeight = -1;
	}
	initiateLayout() {
		this.isFullLayoutScheduled = false;
		if (!this.isActiveView)
				return;
		if (!this.needsPartialLayout) {
			this.newLayoutVersion++;
			this.onNewSectionsSet();
		}
		if(this.viewPort)
			this.dispatch.updateState({timelineViewPort: this.viewPort.clone()});
	}
    /**
     *
     * @param {TimelineEvent} timelineEvent
     */
	setCurrentEvent(timelineEvent) {
		this.activeTimelineEvent = timelineEvent;
	}
    /**
     *
     * @param {ReturnType<typeof EventRow.prototype.handleMouseDownAction>} value
     */
	setCurrentTransaction(value) {
		this.currentTransactionHandler = value;
	}
	/**
     *
     * @param {ReturnType<typeof EventRow.prototype.handleMouseDownAction>} value
     */
	setPendingTransaction(value) {
		this.pendingTransactionHandler = value;
	}
	isDirtyLayout() {
		return this.layoutVersion !== this.newLayoutVersion || this.needsPartialLayout || this.isFullLayoutScheduled;
	}
	getViewPort() {
		if (!this.scroller || !this.viewConfig || !this.state)
			return new Rectangle(0, 0, 0, 0);
		let left = this.scroller.scrollLeft;
		if (this.state.properties.dir === DIRECTION.RTL) {
			// Firefox will do reverse scrolling in RTL Mode
			if (this.viewConfig.noScrolling) {
				this.isInitialScrolling = true;
			} else {
				if (!this.isInitialScrolling && this.scroller.scrollWidth !== this.scroller.clientWidth) {
					const prevScrollLeft = this.scroller.scrollLeft;
					if (prevScrollLeft > 0) {
						this.scroller.scrollLeft = -1;
						this.isNegativeScrolling = this.scroller.scrollLeft < 0;
						this.scroller.scrollLeft = prevScrollLeft;
					} else {
						this.isNegativeScrolling = prevScrollLeft < 0;
					}
					this.isInitialScrolling = true;
				}
			}
		}
		const top = this.scroller.scrollTop;
		return new Rectangle(Math.abs(left), top, this.eventAreaClientWidth, this.eventAreaClientHeight);
	}

	adjustMarkSpanTitles() {
		const scrollerTop = this.scroller.getBoundingClientRect().top;
		const scroleeTop = this.scrolee.getBoundingClientRect().top;
		const eventRowEls = this.scrolee.querySelectorAll('.event-row');
		for (let eventRowEl of eventRowEls) {
			let posX = eventRowEl.getBoundingClientRect().top - scrollerTop;
			if (posX > 0) {
				this.scroller.querySelectorAll('.mark-span').forEach((markSpanEl) => {
					(/**@type {HTMLElement} */(markSpanEl)).style.paddingTop = eventRowEl.getBoundingClientRect().top - scroleeTop + 'px';
				});
				break;
			}
		}
	}

	/**
	 * 
	 * @param {KeyboardEvent} e 
	 */
	onSectionTitleFocusChange(e) {
		if (this.eventSections.length === 0)
			return;
		if (this.viewConfig.titleWidth <= 0)
			return;
		if (this.isSectionTitleFocusInProgress)
			return;
		let focusEl = this.state.host.shadowRoot.activeElement && (this.state.host.shadowRoot.activeElement.closest('div.event-row-section') ||
					this.state.host.shadowRoot.activeElement.closest("div.event-row-section-head"));
		/**
		 * @type {EventSection | EventRow}
		 */
		let currentFocusedArea = null;
		let id =  '';
		if (focusEl) {
			id = focusEl.getAttribute("row_id");
			if (id)
				currentFocusedArea = this.rowMap.get(id);
			else {
				id = focusEl.getAttribute("section_id");
				if (id)
					currentFocusedArea = this.sectionMap.get(id);
			}
		}
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow 
		 */
		function getNext(sectionOrRow) {
			if(!sectionOrRow)
				return null;
			if (sectionOrRow instanceof EventSection) {
				if (!sectionOrRow.isCollapsed)
					return sectionOrRow.collection[0];
			}
			if(sectionOrRow.next)
				return sectionOrRow.next;
			let nextSectionOrRow = null;
			let parentSection = /**@type {EventSection} */(sectionOrRow.parent);
			while (parentSection || nextSectionOrRow) {
				nextSectionOrRow = parentSection.next;
				if(nextSectionOrRow)
					break;
				parentSection = /**@type {EventSection} */(parentSection.parent);
			}
			return nextSectionOrRow;
		}
		
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow 
		 */
		function getNextFocusableInSectionTitleArea(sectionOrRow) {
			if (sectionOrRow instanceof EventSection) {
				if (sectionOrRow.showHeader)
					return sectionOrRow;
				return getNextFocusableInSectionTitleArea(sectionOrRow.collection[0]);
			} else if (sectionOrRow instanceof EventRow) {
				return sectionOrRow;
			}
			return null;
		}
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow 
		 */
		function getPrev(sectionOrRow) {
			if (!sectionOrRow)
				return null;
			let prev = sectionOrRow.prev;
			if(prev instanceof EventRow || prev instanceof EventSection)
				return prev;
			const parentSection = /** @type {EventSection}*/(sectionOrRow.parent);
			if (parentSection) {
				if (parentSection.showHeader)
					return parentSection;
				if(parentSection.prev)
					return getPrev(parentSection);
			}
			return null;
			//return getParentOrPrev(sectionOrRow);
		}
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow 
		 */
		function getLast(sectionOrRow) {
			if(!sectionOrRow)
				return null;
			if (sectionOrRow instanceof EventRow)
				return sectionOrRow;
			if (sectionOrRow instanceof EventSection)
				return getLast(sectionOrRow.collection[sectionOrRow.collection.length - 1]);
			return null;
		}
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow
		 */
		/**
		 * 
		 * @param {EventSection | EventRow} sectionOrRow 
		 */
		function getPrevFocusableInSectionTitleArea(sectionOrRow) {
			if (!sectionOrRow || sectionOrRow instanceof EventRow)
				return sectionOrRow;
			if (sectionOrRow instanceof EventSection) {
				if (sectionOrRow.showHeader && sectionOrRow.isCollapsed)
					return sectionOrRow;
				return getPrevFocusableInSectionTitleArea(sectionOrRow.collection[sectionOrRow.collection.length - 1]);
			}
			return null;
		}

		let elmId = '';
		let prevFocusArea = currentFocusedArea;
		if (e.shiftKey) {
			if (currentFocusedArea) {
				currentFocusedArea = /** @type {EventSection | EventRow} */(getPrev(currentFocusedArea));
				if(!prevFocusArea || prevFocusArea.parent !== currentFocusedArea)
					currentFocusedArea = getPrevFocusableInSectionTitleArea(currentFocusedArea);
			} else {
				currentFocusedArea = getLast(this.eventSections[this.eventSections.length - 1]);
			}
		} else {
			currentFocusedArea = /**@type {EventSection | EventRow} */(getNext(currentFocusedArea));
			if (prevFocusArea)
				currentFocusedArea = getNextFocusableInSectionTitleArea(currentFocusedArea);
			else
				currentFocusedArea = getNextFocusableInSectionTitleArea(this.eventSections[0]);
		}
		if (!currentFocusedArea)
			return;
		const focusedBoundingRect = currentFocusedArea.getBoundingRect();
		const targetBoundingRect = new Rectangle(this.viewPort.x, focusedBoundingRect.y, 0, focusedBoundingRect.height);
		if (currentFocusedArea instanceof EventSection) {
			elmId = TimelineUtils.getSectionTitleId(currentFocusedArea.id);
			targetBoundingRect.height = this.viewConfig.sectionHeaderHeight;
		} else {
			elmId = TimelineUtils.getRowTitleId(currentFocusedArea.id);
		}

		//const point = { x: this.viewPort.x, y: targetBoundingRect.y };
		if (this.viewPort.contains(targetBoundingRect)) {
			let el = /**@type {HTMLDivElement} */(this.timelineEl.querySelector('#' + elmId));
			if (el)
				el.focus();
		} else {
			this.scroller.scrollTo(this.scroller.scrollLeft, targetBoundingRect.y);
			this.isSectionTitleFocusInProgress = true;
			setTimeout( () => {
				this.isSectionTitleFocusInProgress = false;
				if (!this.isActiveView)
					return;
				let el = /**@type {HTMLDivElement} */(this.timelineEl.querySelector('#' + elmId));
				if (el)
					el.focus();
			}, this.viewConfig.scrollDebounceTime * 4);
		}
	}

	onResize() {
		if (!this.isActiveView)
			return;

		if (!this.scrolee)
			return;

		const scrolee = this.scrolee;
		const scroller = /** @type {HTMLDivElement} */(scrolee.parentNode);
		const previousTimescaleHeight = this.timescaleHeight;
		let previousClientWidth = this.eventAreaClientWidth;
		let previousClientHeight = this.eventAreaClientHeight;
		let previousSectionHeight = this.sectionHeight;
		const scrollerBoundingRect = scroller.getBoundingClientRect();
		this.scrollBarWidth = Math.abs(scrollerBoundingRect.width - scroller.clientWidth);
		this.scrollBarHeight = Math.abs(scrollerBoundingRect.height - scroller.clientHeight);
		this.eventAreaClientWidth = scroller.clientWidth - this.viewConfig.titleWidth;
		const previousTitleAreaWidth = this.titleAreaWidth;
		this.titleAreaWidth = this.viewConfig.titleWidth;
		if (this.viewConfig.noScrolling) {
			this.viewConfig.eventAreaClientWidth = this.eventAreaClientWidth;
			const actualEventsAreaWidth = TimelineUtils.getEventLineWidth(this.viewConfig);
			this.eventAreaClientWidth = actualEventsAreaWidth;
			this.viewConfig.eventAreaClientWidth = actualEventsAreaWidth;
		}
		if(previousClientWidth !== this.eventAreaClientWidth || previousTitleAreaWidth !== this.viewConfig.titleWidth) {
			this.eventMap.forEach( (timelineEvent) => {
				timelineEvent.layout(this.viewConfig, this.state.startMoment, this.state.endMoment);
			});
		}
		if (this.timeScaleHost)
			this.timescaleHeight = this.timeScaleHost.clientHeight;
		this.eventAreaClientHeight = scroller.clientHeight;
		this.eventAreaScrollHeight = Math.max(this.eventAreaScrollHeight, this.eventAreaClientHeight);
		this.scrollLeft = scroller.scrollLeft;
		this.scrollTop = scroller.scrollTop;
		let isViewportNull = !this.viewPort;
		this.viewPort = this.getViewPort();
		/**
		 * @type {HTMLElement}
		 */
		const sectionEl = this.scroller.closest('section.sn-calendar-core');
		this.sectionHeight = sectionEl.clientHeight;
		if (previousSectionHeight !== this.sectionHeight ||
			previousClientWidth !== this.eventAreaClientWidth ||
			isViewportNull ||
			previousClientHeight != this.eventAreaClientHeight ||
			this.titleAreaWidth !== previousTitleAreaWidth ||
			this.timescaleHeight !== previousTimescaleHeight) {
			this.setViewPort(this.viewPort);
		}
		this.adjustMarkSpanTitles();
	}
    /**
     *
     * @param {Rectangle} newViewPort
     */
	setViewPort(newViewPort) {
		if ((newViewPort.y + newViewPort.height) > this.eventAreaScrollHeight)
			newViewPort.y = Math.max(0, (this.eventAreaScrollHeight - this.eventAreaClientHeight));
		this.viewPort = newViewPort;
		this.dispatch.updateState({ timelineViewPort: this.viewPort });
	}
	setupVisibilityTimer(host, dispatch) {
		if (this.visiblityObserverTimerId)
			clearTimeout(this.visiblityObserverTimerId);
		this.visiblityObserverTimerId = 0;
		this.coreDivHeight = -1;
		this.visiblityObserverTimerId = window.setTimeout( () => {
			this.checkForSizeZero(host, dispatch);
		}, 250);
	}
	/**
	 * 
	 * @param {HTMLDivElement} host 
	 * @param {import('../../..').appDispatch} dispatch 
	 */
	checkForSizeZero(host, dispatch) {
		if (this.visiblityObserverTimerId)
			clearTimeout(this.visiblityObserverTimerId);
		this.visiblityObserverTimerId = 0;
		if (!host)
			return;
		const coreDiv = host.shadowRoot.querySelector('.sn-calendar-core');
		if (!coreDiv)
			return;
		if (getComputedStyle(coreDiv).visibility === 'hidden') {
			this.setupVisibilityTimer(host, dispatch);
			return;
		}
		const height = Math.floor(coreDiv.getBoundingClientRect().height);
		if ( height === 0) {
			this.setupVisibilityTimer(host, dispatch);
			return;
		}
		if (this.coreDivHeight == height)
			return;
		this.coreDivHeight = height;
		dispatch.updateState({sizeInvalidationTime: Date.now() });
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderHeaderView(viewConfig, state, dispatch) {
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderTitleSectionView(viewConfig, state, dispatch) {
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderEventSectionView(viewConfig, state, dispatch) {
	}
	/**
     *
     * @param {number} left
     * @param {number} top
     */
	onEventAreaScroll(left, top) {
		this.scrollLeft = left;
		this.scrollTop = top;
		if (this.headerView)
			this.headerView.onEventAreaScroll(left, top);
		if (this.titleSectionScrollEL)
			this.titleSectionScrollEL.style.top = -top + 'px';
		if (this.currentTransactionHandler)
			this.currentTransactionHandler.onScroll();
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
	 * @param {number} sectionIndex
	 * @param {Array<import('../../..').RawSectionItem>} rawSections
	 * @param {Array<CalendarEvent>} rawEvents
     */
	parseSectionData(viewConfig, state, sectionIndex = 0,
		rawSections, rawEvents) {
		if (!Array.isArray(rawSections))
			throw new Error('Not a valid sections');
		const groupBy = this.viewConfig.groupBy || DEFAULT_SECTION_KEY;
        /**
         * @type {Map<string, Array<TimelineEvent>>}
         */
		this.eventGroupMap = this.eventGroupMap || new Map();
        /**
         * @type {Map<string, EventRow>}
         */
		this.rowMap = this.rowMap || new Map();
        /**
         * @type {Map<string, TimelineEvent>}
         */
		this.eventMap = this.eventMap || new Map();

		rawEvents.forEach((thisEvent) => {
			const key = thisEvent[groupBy] || DEFAULT_SECTION_KEY;
			if (!this.eventGroupMap.has(key))
				this.eventGroupMap.set(key, []);
			const eventStartMS = thisEvent.startMS + thisEvent.startUTCOffsetMS;
			if (eventStartMS > state.tzViewEndMS)
				return;
			const eventEndMS = thisEvent.endMS + thisEvent.endUTCOffsetMS;
			if (eventEndMS < state.tzViewStartMS)
				return;
			if(Math.abs(eventEndMS - eventStartMS) < viewConfig.minimumEventSpan)
				return;
			if(Math.abs(state.tzViewStartMS - eventEndMS) < viewConfig.minimumEventSpan)
				return;
			const timelineEvent = new TimelineEvent(thisEvent.id,
				thisEvent.title,
				eventStartMS < state.tzViewStartMS,
				eventEndMS > state.tzViewEndMS,
				thisEvent[groupBy], thisEvent);
			this.eventMap.set(String(thisEvent.id), timelineEvent);
			this.eventGroupMap.get(key).push(timelineEvent);
		});
        /**
         * @type {Map<string, EventSection>}
         */
		this.sectionMap = this.sectionMap || new Map();
		/**
		 * @type {Map<string, EventSection>}
		 */
		this.rawSectionMap = this.rawSectionMap || new Map();
        /**
         *
         * @param {import('../../..').RawSectionItem} rawSection
         * @param {number} level
		 */
		const createEventSection = (rawSection, level) => {
			const isCollapsed = typeof rawSection.isCollapsed === 'boolean' ? rawSection.isCollapsed : false;
			const showHeader = typeof rawSection.showHeader === 'boolean' ? rawSection.showHeader : true;
			const strSectionId = rawSection.id? rawSection.id: String(sectionIndex++);
			const currentSection = new EventSection(strSectionId, rawSection.title, level++, isCollapsed, showHeader, rawSection.bgColor, rawSection.textColor);
			currentSection.rawSection = rawSection;
			this.rawSectionMap.set(rawSection.id, currentSection);
			this.sectionMap.set(strSectionId, currentSection);
			if (Array.isArray(rawSection.children)) {
				rawSection.children.forEach((thisSection) => {
					if (Array.isArray(thisSection.children)) {
						currentSection.addRow(createEventSection(thisSection, level++));
						level--;
						return;
					}
					const row = new EventRow(thisSection.title, String(thisSection.id),
						viewConfig.xSize, level, this.eventGroupMap.get(String(thisSection.id)),
						viewConfig.eventHeight, thisSection.bgColor, thisSection.textColor);
					this.rowMap.set(row.id, row);
					currentSection.addRow(row);
				});
			} else {
				if (this.eventGroupMap.has(rawSection.id)) {
					const row = new EventRow(rawSection.title, String(rawSection.id),
						viewConfig.xSize, level, this.eventGroupMap.get(String(rawSection.id)),
						viewConfig.eventHeight, rawSection.bgColor, rawSection.textColor);
					this.rowMap.set(row.id, row);
					currentSection.addRow(row);
				}
			}
			return currentSection;
		}
		let newRawSections = [...rawSections];
		if (this.eventGroupMap.has(DEFAULT_SECTION_KEY)) {
			let defaultSection = {
				id: DEFAULT_SECTION_KEY,
				title: t('Other'),
				children: [{ id: DEFAULT_SECTION_KEY, title: '' }]
			};
			newRawSections.push(defaultSection);
		}
		/**
		 * @param {EventSection} section
		 */
		const fillEmptySection = (section) => {
			section.collection.forEach((item) => {
				if (item instanceof EventSection)
					fillEmptySection(item);
			});
			if (section.collection.length === 0) {
				const row = new EventRow(section.title, section.rawSection.id, viewConfig.xSize);
				this.rowMap.set(row.id, row);
				section.addRow(row);
			}
		}
        /**
         * @type {EventSection}
         */
		let prevSection = null;
		if (Array.isArray(this.eventSections) && this.eventSections.length > 0)
			prevSection = this.eventSections[this.eventSections.length - 1];
		const newSections = newRawSections.map((thisSection) => {
			let newSection = createEventSection(thisSection, 0);
			fillEmptySection(newSection);
			this.rawSectionMap.set(thisSection.id, newSection);
			newSection.prev = prevSection;
			if (prevSection)
				prevSection.next = newSection;
			prevSection = newSection;
			return newSection;
		});
		this.eventSections = this.eventSections.concat(newSections);
	}

	/**
	 *
	 * @param {import('../../..').PropertyChangePayload<"sections">} payload
	 */
	onSectionPropChanged(payload) {
		/**
		 * @param {EventSection | EventRow} eventSection
		 * @param {import('../../..').RawSectionItem} rawSection
		*/
		let amendChanges = (eventSection, rawSection) => {
			if (eventSection instanceof EventRow)
				return;
			if (eventSection.isCollapsed !== rawSection.isCollapsed ||
				eventSection.showHeader !== rawSection.showHeader ||
				eventSection.title !== rawSection.title) {
				eventSection.isCollapsed = rawSection.isCollapsed;
				eventSection.showHeader = rawSection.showHeader;
				eventSection.invalidateLayout();
			}
			if (!Array.isArray(rawSection.children))
				return;
			for (let i = 0; i < eventSection.collection.length; i++)
				amendChanges(eventSection.collection[i], rawSection.children[i]);
		}

		if (!Array.isArray(payload) && !Array.isArray(payload.value)) {
			let newSectionsData = payload.value;
			if (newSectionsData.operation === 'set') {
				this.onNewSectionsSet();
			}
			let deltaChanges = newSectionsData.changes;
			if (Array.isArray(deltaChanges)) {
				if (newSectionsData.operation === 'set')
					this.onNewSectionsSet();
				else if (newSectionsData.operation === 'add') {
					this.parseSectionData(this.viewConfig, this.state, this.eventSections.length, deltaChanges, []);
					if (!this.isFullLayoutScheduled)
						this.needsPartialLayout = true;
				}

				for (let i = 0; i < deltaChanges.length; i++) {
					switch (newSectionsData.operation) {
						case 'modify': {
							if (!this.isFullLayoutScheduled)
								this.needsPartialLayout = true;
							if (deltaChanges[i]) {
								const eventSection = this.rawSectionMap.get(deltaChanges[i].id);
								if (eventSection)
									amendChanges(eventSection, deltaChanges[i]);
							}
						}
							break;
						case 'set':
							// Default handler will take care this.
							break;
						case 'remove': {
							if (!this.isFullLayoutScheduled)
								this.needsPartialLayout = true;
							if (!deltaChanges[i])
								break;
							const eventSection = this.rawSectionMap.get(deltaChanges[i].id);
							if (eventSection) {
								if (eventSection.next)
									eventSection.next.prev = eventSection.prev;
								if (eventSection.prev)
									eventSection.prev.next = eventSection.next;
								const index = this.eventSections.findIndex((item) => {
									return item === eventSection;
								});
								if (index !== -1)
									this.eventSections.splice(index, 1);
								let parent = /**@type {EventSection} */(eventSection.parent);
								if (parent != null) {
									let sectionIndex = parent.collection.findIndex((item) => {
										if (item instanceof EventSection)
											return item.id === eventSection.id;
										return false;
									});
									if (sectionIndex !== -1)
										parent.collection.splice(sectionIndex, 1);
								}
							}
						}
							break;
					}
				}
			}
		} else {
			if (Array.isArray(payload)) {
				this.onNewSectionsSet();
			} else {
				let newSections = payload.value;
				if (Array.isArray(newSections)) {
					this.onNewSectionsSet();
				}

			}
		}
	}
	cancelAllTranscations() {
		this.setCurrentEvent(null);
		this.setPendingTransaction(null);
		if (this.scrolee) {
			this.scrolee.querySelectorAll(`.temp-event`).forEach((el) => {
				el.remove();
			});
		}
	}
	onNewSectionsSet() {
		this.cancelAllTranscations();
		this.needsPartialLayout = false;
		this.eventGroupMap = new Map();
		this.rawSectionMap = new Map();
		this.sectionMap = new Map();
		this.eventSections = [];
		this.eventMap = new Map();
		this.rowMap = new Map();
		this.eventAreaScrollHeight = this.eventAreaClientHeight;
	}
	/**
	 *
	 * @param {import('../../..').PropertyChangePayload<"events">} payload
	 */
	onEventsPropChanged(payload) {
		this.cancelAllTranscations();
		if (!Array.isArray(payload) && !Array.isArray(payload.value)) {
			const newEvents = payload.value;
			/**
			 * @type {Array<import('../../..').RawCalendarEvent>}
			 */
			const deltaChanges = newEvents.changes;
			if (Array.isArray(deltaChanges)) {
				for (var i = 0; i < deltaChanges.length; i++) {
					switch (newEvents.operation) {
						case 'set':
							this.onNewSectionsSet();
							break;
						case 'add': {
							if (!this.isFullLayoutScheduled)
								this.needsPartialLayout = true;
							if (!deltaChanges[i])
								continue;
							if (!this.eventGroupMap.get(deltaChanges[i].id))
								this.eventGroupMap.set(deltaChanges[i].id, []);
							let eventGroupArray = this.eventGroupMap.get(deltaChanges[i].id);
							let row = this.rowMap.get(deltaChanges[i][this.viewConfig.groupBy]);
							let newEvent = new CalendarEvent(deltaChanges[i]);
							newEvent.setTimezone(this.state.properties.timezone);
							const tzEventStartMS = newEvent.startMS + newEvent.startUTCOffsetMS;
							const tzEventEndMS = newEvent.endMS + newEvent.endUTCOffsetMS;
							if (this.state.tzViewEndMS < tzEventStartMS)
								break;
							if (this.state.tzViewStartMS > tzEventEndMS)
								break;
							let newTimelineEvent = new TimelineEvent(newEvent.id,
								newEvent.title,
								tzEventStartMS < this.state.tzViewStartMS,
								tzEventEndMS > this.state.tzViewEndMS,
								newEvent[this.viewConfig.groupBy],
								newEvent);
							eventGroupArray.push(newTimelineEvent);
							if (row) {
								row.EventCollection.push(newTimelineEvent);
								row.eventMap.set(newTimelineEvent.id, newTimelineEvent);
								this.eventMap.set(newTimelineEvent.id, newTimelineEvent);
								row.invalidateLayout();
							}
						}
							break;
						case 'remove': {
							if (!this.isFullLayoutScheduled)
								this.needsPartialLayout = true;
							if (!deltaChanges[i])
								break;
							let existingEvent = this.eventMap.get(deltaChanges[i].id);
							if (existingEvent) {
								let row = /**@type {EventRow} */(existingEvent.parent);
								if (row instanceof EventLine)
									row = /**@type {EventRow} */(row.parent);
								row.removeEvent(existingEvent);
							}
						}
							break;
						case 'modify':
							if (!this.isFullLayoutScheduled)
								this.needsPartialLayout = true;
							if (!deltaChanges[i])
								break;
							let existingEvent = this.eventMap.get(deltaChanges[i].id);
							let newEvent = new CalendarEvent(deltaChanges[i]);
							newEvent.setTimezone(this.state.properties.timezone);
							if (existingEvent) {
								if (existingEvent.rawEvent[this.viewConfig.groupBy] !== deltaChanges[i][this.viewConfig.groupBy]) {
									existingEvent.rawEvent = newEvent;
									let oldRow = /**@type {EventRow} */(existingEvent.parent);
									if (oldRow instanceof EventLine)
										oldRow = /**@type {EventRow} */(oldRow.parent);
									oldRow.removeEvent(existingEvent);
									let newRow = this.rowMap.get(existingEvent.rawEvent[this.viewConfig.groupBy]);
									if (newRow) {
										newRow.add(existingEvent);
										newRow.invalidateLayout();
									}
								} else {
									existingEvent.rawEvent = newEvent;
									const row = (/**@type {EventRow} */(existingEvent.parent.parent));
									row.invalidateLayout();
								}
							}
							break;
					}
				}
			}
		}
	}

	getEventScrollPosition(timelineEvent) {
		let parentLine =/** @type {EventLine} */ (timelineEvent.parent);
		let boundingRect = parentLine.getBoundingRect();
		boundingRect.translate(timelineEvent.x, timelineEvent.y);
		boundingRect.resize(timelineEvent.width, timelineEvent.height);
		let scrollX = boundingRect.x;
		let scrollY = boundingRect.y;
		scrollX = Math.min(scrollX, this.eventAreaScrollWidth - this.eventAreaClientWidth);
		scrollX = Math.max(0, scrollX);

		scrollY = Math.min(scrollY, this.eventAreaScrollHeight - this.eventAreaClientHeight);
		scrollY = Math.max(0, scrollY);
		if (!this.viewPort.contains(boundingRect))
			return {scrollX, scrollY}
		else return {scrollX: this.scrollLeft, scrollY: this.scrollTop};
	}
	/**
	 *
	 * @param {import('../../..').Moment} focusDate
	 */
	onFocusChange(focusDate) {
		if (!this.state || !this.scroller)
			return;

		const {startMoment, endMoment, todayMoment, contextMoment, timelineView} = this.state;
		const todayMS = todayMoment.valueOf();
		const startMS = startMoment.valueOf();
		const endMS = endMoment.valueOf();

		if (this.viewConfig.viewName === VIEWS.TIMELINE_WEEK) {
			focusDate = focusDate ? focusDate : contextMoment;
			const cellWidth = TimelineUtils.getCellWidth(this.viewConfig);
			let daysDiff = focusDate.diff(this.state.startMoment, 'days');
			daysDiff = daysDiff % this.viewConfig.xSize;
			if (daysDiff < 0)
				daysDiff += this.viewConfig.xSize;
			let scrollX = cellWidth * daysDiff;
			let tempViewPort = this.viewPort.clone();

			/* Moving to the other edge of the date cell on below condition */
			if (scrollX > tempViewPort.x)
				scrollX += 2 * cellWidth;

			if (scrollX < tempViewPort.x)
				tempViewPort.x = scrollX;
			else
				tempViewPort.x = scrollX - this.eventAreaClientWidth;
			this.scroller.scroll(tempViewPort.x, this.scrollTop);
		} else if (this.viewConfig.viewName === VIEWS.TIMELINE_DAY) {
			// Check if today is in the current date range, then scroll to the current time
			if (startMS <= todayMS &&  todayMS <= endMS){
				const posX = (todayMS - startMS) * 100 / (endMS - startMS);
				let todayScrollPosx = this.eventAreaScrollWidth * posX / 100;
				if (todayScrollPosx > this.eventAreaClientWidth / 2) {
					todayScrollPosx -= this.eventAreaClientWidth / 2;
					this.scroller.scroll(todayScrollPosx, 0);
				} else this.scroller.scroll(0, 0);
				return;
			}

			let timelineEvent;
			for (let i = 0; timelineView && i < timelineView.eventSections.length; i++) {
				timelineEvent = timelineView.eventSections[i].getFirstEvent();
				if (timelineEvent)
					break;
			}

			if (!timelineEvent) return;
			let {scrollX, scrollY} = this.getEventScrollPosition(timelineEvent);
			this.scroller.scroll(scrollX, scrollY);
		}

	}

    /**
     *
     * @param {import('../../..').PropertyChangePayload} payload
     */
	onPropertyChange(payload) {
		if (payload.name === 'currentView') {
			this.gridStepRanges = [];
			this.isActiveView = (payload.value === VIEWS.TIMELINE_DAY || payload.value === VIEWS.TIMELINE_WEEK);
			if (payload.previousValue != payload.value)
				if (this.isActiveView)
					this.agendaViewUpdateDebouncer(this.selectedRowId);
			this.onNewSectionsSet();
			if (!this.isActiveView) {
				this.scrolee = null;
				this.scroller = null;
				this.viewPort = null;
				this.scrollTop = 0;
				this.scrollLeft = 0;
				this.activeTimelineEvent = null;
				this.setCurrentTransaction(null);
				this.setPendingTransaction(null);
				return;
			}
		}
		if (payload.name === 'events' || payload.name === 'sections') {
			if (payload.name === 'events')
				this.onEventsPropChanged(payload);
			else {
				this.onSectionPropChanged(payload);
				if (this.viewPort)
					this.setViewPort(this.viewPort.clone());
			}

			this.setCurrentEvent(null);
			this.setPendingTransaction(null);
		}
		if (!(this.state && this.state.timelineView))
			return;
		let skipLayout = false;
		if (payload.name === 'contextDate') {
			if (this.state.timelineView.isActiveView && (payload.previousValue.valueOf() != payload.value.valueOf())) {
				if (payload.value.isBetween(this.state.startMoment, this.state.endMoment, null, '[]'))
					skipLayout = true;
				else
					this.needsPartialLayout = false;
			} else {
				skipLayout = true;
			}
		}

		if ((payload.name === 'contextDate' || payload.name === 'events') && this.state.timelineView.isActiveView) {
			if ((payload.previousValue != payload.value) && this.viewPort)
				this.agendaViewUpdateDebouncer(this.selectedRowId);
		}

		if (payload.name === 'timezone' && this.state.timelineView.isActiveView) {
			const events = this.state.dataProvider.getAllEvents();
			for(let event of events)
				event.setTimezone(payload.value);
			this.needsPartialLayout = false;
		}

		if (this.layoutPropMap.has(payload.name) && !skipLayout) {
			if (this.layoutScheduler) {
				this.layoutScheduler.cancel();
				this.layoutScheduler = null;
			}
			if (!this.needsPartialLayout) {
				this.isFullLayoutScheduled = true;
				this.layoutDebouncer();
			}
		}
	}
    /**
     * @param {import('../../..').TimelineConfig} viewConfig
     */
	appendViewSpecificData(viewConfig) {
		if(!Number.isInteger(viewConfig.rowHeightBottomPaddingInLines) || viewConfig.rowHeightBottomPaddingInLines < 1)
			viewConfig.rowHeightBottomPaddingInLines = 1;
		if (!Number.isInteger(viewConfig.splitRow) || viewConfig.splitRow < 1)
			viewConfig.splitRow = 1;
		if(!Number.isInteger(viewConfig.sectionHeaderHeight) || viewConfig.sectionHeaderHeight < 0)
			viewConfig.sectionHeaderHeight = DEFAULT_HEADER_HEIGHT;
		if(!Number.isInteger(viewConfig.minimumEventSpan) || viewConfig.minimumEventSpan < 1)
			viewConfig.minimumEventSpan = 1;
		if(!Number.isInteger(viewConfig.titleWidth) || viewConfig.titleWidth < 1)
			viewConfig.titleWidth = 0;
		viewConfig.eventAreaClientHeight = this.eventAreaClientHeight;
		viewConfig.eventAreaScrollHeight = this.eventAreaScrollHeight;
		const emptyTemplate = {
			value: '',
			component: ''
		}

		const templates = viewConfig.templates || {};
		TEMPLATE_NAMES.forEach( (templateName) => {
			/**
			 * @type {import('../../..').CalendarTemplateItem}
			 */
			const currentTemplate = templates[templateName];
			const isValidTemplate =  currentTemplate &&
			typeof currentTemplate.value === 'string' &&
			currentTemplate.value.length > 0;
			if (isValidTemplate)
				return;
			templates[templateName] = {...emptyTemplate};
		});
		viewConfig.templates = templates;
		if (!this.viewPort)
			return;
		viewConfig.eventAreaClientWidth = this.eventAreaClientWidth;
		viewConfig.xStep = viewConfig.timeRowSpan || viewConfig.xStep;
		const cellWidth = TimelineUtils.getCellWidth(viewConfig);
		const xStepInMinutes = TimelineUtils.getXStepInMinutes(viewConfig);
		viewConfig.splitRow = Math.min(Math.floor(cellWidth/ 4), viewConfig.splitRow);
		if (xStepInMinutes % viewConfig.splitRow !== 0)
			viewConfig.splitRow = 1;
	}
    /**
     * @param {TimelineEvent} timelineEvent
     */
	dispatchMouseHover(timelineEvent) {
		if (this.eventMouseHoverTimerId != -1)
			window.clearTimeout(this.eventMouseHoverTimerId);
		this.eventMouseHoverTimerId = -1;
		if (!(timelineEvent instanceof TimelineEvent))
			return;
		this.eventMouseHoverTimerId = window.setTimeout(() => {
			this.eventMouseHoverTimerId = -1;
			if (!this.isActiveView)
				return;
			timelineEvent.rawEvent.initializeMoment(this.state.properties.timezone);
			let content = t('{0} - {1} ', timelineEvent.rawEvent.startMoment.format(this.state.properties.timeFormat), timelineEvent.rawEvent.endMoment.format(this.state.properties.timeFormat)) + timelineEvent.rawEvent.title;
			let target = this.scrolee.querySelector(`#event_${timelineEvent.id}`);
			if (!target)
				return;

			updateTooltip(this.dispatch, target, timelineEvent.id, content);
		}, 250);
	}
	/**
	 * @param {HTMLDivElement} timelineEl
	 */
	setTimelineHost(timelineEl) {
		this.timelineEl = timelineEl;
	}
	clearTempDOM() {
		if (!this.timelineEl)
			return;
		this.timelineEl.querySelectorAll('.temp-event').forEach((tempEl) => {
			try {
				tempEl.remove();
			} catch (e) {
			}
		});
	}
	onDisconnected() {
		if (this.visiblityObserverTimerId)
			clearTimeout(this.visiblityObserverTimerId);
	}
	/**
	 * 
	 * @param {import('moment').Moment} newStartMoment 
	 * @param {import('moment').Moment} newEndMoment 
	 * @param {import('../../..').appDispatch} dispatch
	 */
	triggerRangeUpdated(newStartMoment, newEndMoment, dispatch) {
		if (newStartMoment.valueOf() === this.prevRangeStartMS &&
			newEndMoment.valueOf() === this.prevRangeEndMS)
			return;
		this.prevRangeStartMS = newStartMoment.valueOf();
		this.prevRangeEndMS = newEndMoment.valueOf();
		dispatch.updateState({startMoment: newStartMoment, endMoment: newEndMoment});
		dispatch(ACTIONS.RANGE_UPDATED, {startMoment: newStartMoment.clone(), endMoment: newEndMoment.clone(), startMS: newStartMoment.valueOf(), endMS: newEndMoment.valueOf()});
	}
}

export class TimelineDayWeekView extends TimelineViewBase {
	constructor() {
		super();
		this.headerView = new TimelineHeaderDayWeekView();
		this.currentTransactionRow = /**@type {EventRow} */(null);
		this.prevKeydownTimestamp = -1;
		this.registeredGlobalDocEvents = {
			'mousedown': this.onGlobalMouseDown.bind(this),
			'mousemove': this.onGlobalMouseMove.bind(this),
			'mouseup': this.onGlobalMouseUp.bind(this),
			'mouseleave': this.onGlobalMouseLeave.bind(this),
			'keydown': this.onGlobalKeyDown.bind(this),
			'dragend': this.onDragEnd.bind(this)
		};
		this.registeredGlobalWindowEvents = {
			'resize': TimelineUtils.debounce(this.onResize.bind(this), 250, false)
		};
		this.registerGlobalEventHandlers();
	}
	onDragEnd() {
		if (this.dispatch && this.dispatch.updateState)
			this.dispatch.updateState({externalEventSettings: null});
	}
	registerGlobalEventHandlers() {
		for (let eventKey in this.registeredGlobalDocEvents)
			document.addEventListener(eventKey, this.registeredGlobalDocEvents[eventKey]);
		for (let eventKey in this.registeredGlobalWindowEvents)
			window.addEventListener(eventKey, this.registeredGlobalWindowEvents[eventKey])
	}
	unregisterGlobalEventHandlers() {
		for (let eventKey in this.registeredGlobalDocEvents)
			document.removeEventListener(eventKey, this.registeredGlobalDocEvents[eventKey]);
		for (let eventKey in this.registeredGlobalWindowEvents)
			window.removeEventListener(eventKey, this.registeredGlobalWindowEvents[eventKey]);
	}
	onDisconnected() {
		super.onDisconnected();
		this.unregisterGlobalEventHandlers();
		this.isActiveView = false;
	}

	/**
     *
     * @param {number} left
     * @param {number} top
     */
	onEventAreaScroll(left, top) {
		super.onEventAreaScroll(left, top);
	}
	/**
	 * 
	 * @param {DragEvent} dragEvent 
	 */
	onExternalEventDragOver(dragEvent) {

		const targetEl = /** @type {HTMLDivElement}*/(dragEvent.target);
		const rowEl = /**@type {HTMLElement} */(targetEl.closest('.event-row'));
		if(!rowEl)
			return;
		const state = this.state;
		const props = this.state.properties;
		const externalEvent = this.state.properties.externalEvent;
		if(!externalEvent)
			return;
		const rowId = rowEl.getAttribute('row_id');
		const rowRect = rowEl.getBoundingClientRect();
		const isRTL = props.dir === DIRECTION.RTL;
		let mousePosX = dragEvent.clientX - rowRect.left;
		if (isRTL)
			mousePosX = rowRect.width - mousePosX;
		mousePosX = mousePosX - externalEvent.startPositionDifference;
		const snapCellWidth = TimelineUtils.getSnapCellWidth(this.viewConfig);
		let projectionPosX = mousePosX - (mousePosX % snapCellWidth);
		if(isRTL)
			projectionPosX = rowRect.width - projectionPosX;

		const eventMinWidth = this.viewConfig.eventMinWidthMS;
		let duration = Math.max(externalEvent.duration, eventMinWidth);

		const posWidth = TimelineUtils.getPosXFromMouseX(state, this.viewConfig, projectionPosX, duration);
		const externalDragSettings = {...posWidth, rowId};
		if(!state.externalEventSettings || rowId !== state.externalEventSettings.rowId) {
			this.dispatch.updateState({externalEventSettings: externalDragSettings});
			return;
		}

		let projectionEl = /**@type {HTMLDivElement} */(rowEl.querySelector('.event-projection'));
		if(!projectionEl)
			return;
		// need to handle better way.
		projectionEl.classList.add('show');
		const projectionWidth = TimelineUtils.isValidSnapGranularity(this.viewConfig)? posWidth.width: TimelineUtils.getCellWidthInPercentage(this.viewConfig);
		projectionEl.style.left = (isRTL? posWidth.x - projectionWidth: posWidth.x) + '%';
		projectionEl.style.width = projectionWidth + '%';
		dragEvent.preventDefault();
		this.onMouseMove(dragEvent, false, false, false);
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
		this.viewConfig = viewConfig;
		this.dispatch = dispatch;
		this.state = state;
		this.isActiveView = true;
		if (this.currentTransactionHandler) {
			this.currentTransactionHandler.onRefresh();
			this.clearTempDOM();
		}
		state.properties.timelineTemplateRenderer = getCurrentViewTemplateRenderer(state);
		state.properties.timelineTemplateRenderer.setViewStartAndEnd(state.utcViewStartMS, state.utcViewEndMS);
		const { properties: props } = state;
		if (this.viewPort && this.previousDir != props.dir) {
			this.viewPort = null;
			this.previousDir = props.dir;
		}
		if (!this.scrollDebounce) {
			this.scrollDebounce = TimelineUtils.debounce(() => {
				if (!this.isActiveView)
					return;
				this.setViewPort(this.viewPort.clone());
			}, viewConfig.scrollDebounceTime, false);
		}
		viewConfig.scrollbarWidth = this.scrollBarWidth;
		viewConfig.scrollbarHeight = this.scrollBarHeight;
		this.eventAreaScrollWidth = TimelineUtils.getEventLineWidth(viewConfig);
		viewConfig.eventAreaClientWidth = this.eventAreaClientWidth;
		if (this.isDirtyLayout() && this.viewPort) {
			this.layoutVersion = this.newLayoutVersion;
			if (this.layoutScheduler) {
				this.layoutScheduler.cancel();
				Log.info('Timeline - cancelling scheduler');
			}
			if (!this.sectionMap || this.sectionMap.size == 0) {
				this.parseSectionData(viewConfig, state, 0, state.dataProvider.getSections(), state.dataProvider.getAllEvents());
			}
			if (!this.selectedRowId)
				this.agendaViewUpdateDebouncer();
			let dirtySection = this.eventSections[0];
			for (let i = 0; i < this.eventSections.length; i++) {
				if (this.layoutVersion !== this.eventSections[i].layoutVersion) {
					dirtySection = this.eventSections[i];
					break;
				}
			}
			viewConfig.layoutVersion = this.newLayoutVersion;
			let isRenderingDoneOnce = false;
			if (this.eventSections.length > 0) {
				let isDone = false;
				try {
					dirtySection.scheduleLayout(viewConfig, state.startMoment, state.endMoment,
						Date.now(), (done, newHeight, cancellableObj) => {
							this.layoutScheduler = cancellableObj;
							// browser auto-focus scrolling the container. so give some extra space
							newHeight = newHeight + 1;
							this.eventAreaScrollHeight = Math.max(newHeight, this.eventAreaClientHeight);
							if (this.scrolee)
								this.scrolee.style.height = `${newHeight}px`;
							isDone = done;
							if (!isDone) {
								if (newHeight < this.viewPort.y)
									return;
								if (newHeight > (this.viewPort.y + this.viewPort.height)) {
									if (isRenderingDoneOnce)
										return;
								}
							} else {
								this.layoutScheduler = null;
								this.needsPartialLayout = false;
							}
							isRenderingDoneOnce = true;
							if (!this.needsPartialLayout) {
								setTimeout(() => {
									this.setViewPort(this.viewPort.clone());
								});
							}
						});
				} catch (e) {
					Log.error(e);
				}
				if (isDone) {
					this.needsPartialLayout = false;
					this.layoutScheduler = null;
				}

			}
		}
		let eventDataWrapperStyle = {
			padding: `0px 0px 0px ${viewConfig.titleWidth}px`,
			overflow: 'scroll'
		};
		if (viewConfig.noScrolling) {
			eventDataWrapperStyle.overflow = 'auto';
		}
		if (props.dir === DIRECTION.RTL)
			eventDataWrapperStyle.padding = `0px ${viewConfig.titleWidth}px 0px 0px`;
		const eventDataStyle = {
			height: this.eventAreaScrollHeight + 'px',
			width: TimelineUtils.getEventLineWidth(viewConfig) + 'px'
		};

		const eventJSX = this.renderEventSectionView(viewConfig, state, dispatch);
		const wrapperCls = ['timeline-container-wrapper'];
		if (viewConfig.viewName === VIEWS.TIMELINE_WEEK)
			wrapperCls.push('week');
        /**
         *
         * @param {MouseEvent | KeyboardEvent} e
         */
		const toggleSection = (e) => {
			if (this.layoutScheduler)
				return;
			if (e instanceof MouseEvent) {
				if (e.button !== 0)
					return;
			}
			const evt = /**@type {MouseEvent} */(e);
			let el = /** @type {HTMLDivElement} */(evt.target);
			if (!el.closest('.section-collapser'))
				return;
			let sectionHeadEl = el.closest('[section_id]');
			if (!sectionHeadEl)
				return;

			const sectionId = sectionHeadEl.getAttribute('section_id');
			if (!sectionId)
				return;
			const section = this.sectionMap.get(sectionId);
			if (!section)
				return;

			let modifiedSection = { ...section.rawSection };
			modifiedSection.isCollapsed = !section.isCollapsed;
			section.onToggle();
			this.needsPartialLayout = true;
			this.setViewPort(this.viewPort.clone());

			setTimeout(() => {
				if (this.isActiveView)
					dispatch(ACTIONS.TIMELINE_SECTION_TOGGLED, { section: modifiedSection });
			});
		};
		const eventDateAreaStyle = {
			height: `calc(100% - ${this.timeScaleHost ? this.timeScaleHost.clientHeight: 0}px)`
		};
		if(this.gridStepRanges.length === 0) {
			const stepRanges = TimelineUtils.getRenderViewDates(state.startMoment, viewConfig).map( (item) => {
				return {
					startMS: item.start.valueOf(),
					endMS: item.end.valueOf()
				}
			});
			this.gridStepRanges = stepRanges;
		}
		/**
		 * @type {import('../../..').GridTemplateConfig}
		 */
		const mainGridConfig = {
			cellWidth: TimelineUtils.getCellWidth(viewConfig),
			viewConfig,
			calendarProperties: state.properties,
			stepRanges: this.gridStepRanges
		}
		const thisObj = this;
		return (
			<div className={wrapperCls.join(' ')}>
				<div hook={ {
						insert({elm}) {
							thisObj.timeScaleHost = elm;
						},
						update({elm}) {
							thisObj.timeScaleHost = elm;
						},
						destroy() {
							thisObj.timeScaleHost = null;
						}
				}}>
					{this.renderHeaderView(viewConfig, state, dispatch)}
				</div>
				<div className="event-data-area"
					style={eventDateAreaStyle}
					on-click={(e) => toggleSection(e)}
					on-keydown={(/** @type{KeyboardEvent} */e) => (e.which === KEYS.ENTER) ? toggleSection(e) : null}
					on-dragover={

                        /**
                        * @param {DragEvent} e
                         */
						(e) => {
							if(state.properties.externalEvent) {
								thisObj.onExternalEventDragOver(e);
								e.preventDefault();
								return;
							}
						}} on-drop={
							/**
							*   @param {DragEvent} e
							 */
							(e) => {
								e.stopImmediatePropagation();
								e.stopPropagation();
								e.preventDefault();
								this.stopScrolling();
								const scrolee = /** @type {HTMLDivElement}*/(this.scrolee);
								const projectionEl = scrolee.querySelector('.event-projection.show');
								if (projectionEl) {
									const group = projectionEl.closest('.event-row').getAttribute('row_id');
									const scrollerBoundingRect = scrolee.getBoundingClientRect();
									let mousePosX = (e.clientX - scrollerBoundingRect.left);
									if (props.dir === DIRECTION.RTL)
										mousePosX = scrollerBoundingRect.width - mousePosX;

									if (state.properties.externalEvent && state.properties.externalEvent.startPositionDifference)
										mousePosX = mousePosX - state.properties.externalEvent.startPositionDifference;
									const snapCellWidth = TimelineUtils.getSnapCellWidth(viewConfig);
									const projectionPosX = mousePosX - (mousePosX % snapCellWidth);
									let dropEventStartDate = TimelineUtils.posXToMomentTime(projectionPosX, TimelineUtils.getEventLineWidth(viewConfig), state.startMoment, state.endMoment);

									let originalEvent;
									if (state.temporaryEventSettings) {
										if (state.temporaryEventSettings.eventType === EVENT_TYPES.AGENDA_DRAG) {
											originalEvent = state.temporaryEventSettings.originalEvent;
										} else originalEvent = state.temporaryEventSettings.event.rawEvent;
									} else if (state.properties.externalEvent) {
										originalEvent = state.dataProvider.getEventById(state.properties.externalEvent.id);
									}

									if (originalEvent) {
										originalEvent = originalEvent.clone();
										originalEvent.initializeMoment(props.timezone);									// On week view only update date, retain time
										let eventDuration = originalEvent.endMoment.diff(originalEvent.startMoment);
										let dropEventEndDate = dropEventStartDate.clone().add(eventDuration, 'milliseconds');
										let difference = dropEventStartDate.diff(originalEvent.startMoment);
										let oldGroup = originalEvent[viewConfig.groupBy];
										if (difference !== 0 || group !== oldGroup)
											dispatchEventMove(state, dispatch, originalEvent, difference, dropEventStartDate, dropEventEndDate, group);
										else
											clearTemporaryEvent(state, dispatch);
									} else {
										let dropEventEndDate = dropEventStartDate.clone().add(state.properties.externalEvent.duration,'ms');
										dispatchDragNewEventEnd(state, dispatch, dropEventStartDate, dropEventEndDate, group);
									} 
									if (state.externalEventSettings)
										this.dispatch.updateState({externalEventSettings: null});
									if(state.properties.externalEvent && state.properties.externalEvent.originatedFromInternal)
										dispatch.updateProperties({externalEvent: null});
								}
							}}>
					<div className="event-data-wrapper" style={eventDataWrapperStyle}
						ref={(elm) => {
							this.scroller = /**@type {HTMLDivElement} */(elm);
						}}
						on-scroll={() => {
							//closePopover(state, dispatch);
							this.viewPort = this.getViewPort();
							this.onEventAreaScroll(this.viewPort.x, this.viewPort.y);
							this.scrollDebounce();
						}}>
						<div ref={(elm) => {
							this.scrolee = elm;
						}}
							className="event-data" style={eventDataStyle}
							hook-update={(vNode) => {
								this.scrolee = vNode.elm;
							}}>
							{this.renderMarkSpans(viewConfig, state, dispatch)}
							{eventJSX}
							{this.renderLines(viewConfig, state)}
							{state.properties.timelineTemplateRenderer.renderMainGrid(mainGridConfig)}
						</div>
					</div>
					{this.renderTitleSectionView(viewConfig, state, dispatch)}
				</div>
			</div>
		);
	}

	getParentEventStyles(markSpan) {
		let style = {};
		style.color = markSpan.textColor;
		if (markSpan.bgColor)
			style.backgroundColor = markSpan.bgColor;
		else if (markSpan.gradientColor1 && markSpan.gradientColor2)
			style.background = getGradientBackground(markSpan.gradientColor1, markSpan.gradientColor2, markSpan.gradientWidth);
		return style;
	}


	renderMarkSpans(viewConfig, state, dispatch) {
		return <div className="mark-spans-container">
			{

				state.markSpanChunks.map((chunkEvent) => {
					const cls = ['mark-span'];
					let markSpan = getMarkSpanById(state, chunkEvent.$$mid);
					if (markSpan.block)
						cls.push('block');
					let chuckStyles = this.getParentEventStyles(markSpan);
					let totalWidth = Math.max(1, (state.endMoment.valueOf() - state.startMoment.valueOf()));
					let posX = (chunkEvent.startMoment.valueOf() - state.startMoment.valueOf()) * 100 / totalWidth;
					let width = (chunkEvent.endMoment.valueOf() - chunkEvent.startMoment.valueOf()) * 100 / totalWidth;
					chuckStyles[getDirProperty('start', state)] = posX + '%';
					chuckStyles['width'] = width + '%';

					return (<div className={cls.join(' ')}
						style={chuckStyles}
						attrs={{ mid: chunkEvent.$$mid, chunkidx: chunkEvent.chunkId, tabindex: "-1" }}>
						<div className="mark-span-container">
							<div className="mark-span-title">
								{markSpan.title}
							</div>
						</div>
					</div>);
				})
			}</div>;
	}

	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     */
	renderLines(viewConfig, state) {
		if (!this.viewPort)
			return [];
		const { properties: props } = state;
		const todayMoment = state.todayMoment;
		const lines = [...props.timelineVerticalLines];
		const viewStart = state.startMoment;
		const viewEnd = state.endMoment;
		let jsxElements = [];
		const isRTL = props.dir === DIRECTION.RTL;
		lines.push({
			meta: {},
			inlineStyle: null,
			utcMS: todayMoment.valueOf(),
			momentTime: todayMoment.clone()
		});
		let lineCls = 'line user-line';
		lines.forEach((thisLine, index, src) => {
			const thisTime = moment.utc(thisLine.utcMS).tz(props.timezone);
			if (!thisTime.isValid())
				return;
			if (!thisTime.isBetween(viewStart, viewEnd))
				return;
			/**
             * @type {{left?: string, right?: string}}
             */
			const style = {
				...thisLine.inlineStyle
			};
			const posX = (thisTime.valueOf() - state.utcViewStartMS) * 100 / (state.utcViewEndMS - state.utcViewStartMS);
			if (isRTL)
				style.right = posX + '%';
			else
				style.left = posX + '%';
			if (index === src.length - 1)
				lineCls = 'line today-highlighter';
			const thisJSX = (<div className={lineCls}
				style={style}>
				{props.timelineTemplateRenderer.renderVerticalLineBody(thisLine, state.properties)}
			</div>);
			jsxElements.push(thisJSX);
		});
		return jsxElements;
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */

	renderTitleSectionView(viewConfig, state, dispatch) {
		if (!this.viewPort)
			return [];
		const titleSectionStyle = {
			width: (viewConfig.titleWidth) + 'px',
			height: `calc(100% - ${this.scrollBarWidth}px)`
		};
		const wrapperStyle = {
			height: this.eventAreaScrollHeight + 'px',
			top: `-${this.scrollTop}px`
		};
		let bodyJSX = /**@type {Array<any>} */ ([]);
		for (let i = 0; i < this.eventSections.length; i++) {
			if (this.eventSections[i].layoutVersion != this.layoutVersion)
				return [];
			if (this.viewPort.isCompletelyAbove(this.eventSections[i].boundingRect))
				continue;
			if (this.viewPort.isComletelyBelow(this.eventSections[i].boundingRect))
				break;
			bodyJSX.push(this.eventSections[i].renderTitleSection(viewConfig, state, dispatch));
		}
		return (<div className="title-section" style={titleSectionStyle}>
			<div style={wrapperStyle} className="wrapper" ref={(ref) => {
				/// @ts-ignore
				this.titleSectionScrollEL = /** @type {HTMLDivElement}*/(ref);
			}} hook-update={(newVNode) => {
				this.titleSectionScrollEL = newVNode.elm;
			}} on-wheel={
                /**
                 * @param {WheelEvent} e
                 */
				(e) => {
					e.preventDefault();
					let finalY = Math.min(this.scrollTop + e.deltaY, this.eventAreaScrollHeight);
					finalY = Math.max(0, finalY);
					let finalX = Math.min(this.scrollLeft + e.deltaX, this.eventAreaScrollWidth);
					finalX = Math.max(0, finalX);
					if (state.properties.dir === DIRECTION.RTL) {
						finalX = this.scroller.scrollLeft + e.deltaX;
						finalY = this.scroller.scrollTop + e.deltaY;
					}
					this.scroller.scroll(finalX, finalY);
				}}>
				{bodyJSX}
			</div>
		</div>);
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderHeaderView(viewConfig, state, dispatch) {
		if (!this.viewPort)
			return [];
		return this.headerView.render(viewConfig, state, dispatch);
	}
	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderEventSectionView(viewConfig, state, dispatch) {
		if (!this.viewPort)
			return [];
		viewConfig.offsetX = 0;
		viewConfig.offsetY = 0;
		viewConfig.left = 0;
		viewConfig.top = 0;
		const jsxElements = [];
		for (let i = 0; i < this.eventSections.length; i++) {
			if (this.eventSections[i].layoutVersion != this.layoutVersion)
				return [];
			const thisEventSection = this.eventSections[i];
			if (this.viewPort.isCompletelyAbove(thisEventSection.boundingRect))
				continue;
			if (this.viewPort.isComletelyBelow(thisEventSection.boundingRect))
				break;
			const thisJSX = thisEventSection.render(viewConfig, state, dispatch);
			jsxElements.push(thisJSX);
		}
		return jsxElements;
	}
    /**
     *
     * @param {TimelineEvent=} event
     *
     */
	getPrevEvent(event) {
        /**
         * @type {TimelineEvent}
         */
		let finalEvent = null;
		if (event instanceof TimelineEvent) {
			if (event.prev instanceof TimelineEvent)
				return event.prev;
		} else {
			if (this.eventSections.length == 0)
				return finalEvent;
			for (let i = this.eventSections.length - 1; i >= 0; i--) {
				finalEvent = this.eventSections[i].getLastEvent();
				if (finalEvent)
					return finalEvent;
			}
		}
		if (!event || !event.parent)
			return null;
		let parentRow = /** @type {EventRow}*/(event.parent.parent);
		let parentSection = /**@type {EventSection} */(parentRow.parent);
		do {
			parentRow = /** @type {EventRow}*/(parentRow.prev);
			if (!parentRow)
				break;
			finalEvent = parentRow.getLastEvent();
			if (finalEvent)
				return finalEvent;
		} while (true);

		do {
			parentSection = /**@type {EventSection} */(parentSection.prev);
			if (!parentSection)
				break;
			finalEvent = parentSection.getLastEvent();
			if (finalEvent)
				return finalEvent;
		} while (true);

		return finalEvent;
	}
    /**
     *
     * @param {TimelineEvent=} event
     */
	getNextEvent(event) {
        /**
        * @type {TimelineEvent}
        */
		let finalEvent = null;
		if (event instanceof TimelineEvent) {
			if (event.next instanceof TimelineEvent)
				return event.next;
		} else {
			if (this.eventSections.length == 0)
				return finalEvent;
			for (var i = 0; i < this.eventSections.length; i++) {
				finalEvent = this.eventSections[i].getFirstEvent();
				if (finalEvent)
					return finalEvent;
			}
		}
		if (!event || !event.parent)
			return;

		let currentContainer = /** @type {EventRow | EventSection}*/(event.parent.parent);
		do {
			let nextSibling = /**@type {EventRow | EventSection} */(currentContainer.next);
			if (!nextSibling) {
				while (currentContainer.parent) {
					nextSibling = /**@type {EventRow | EventSection} */(currentContainer.parent.next);
					if (nextSibling)
						break;
					currentContainer = /**@type {EventRow | EventSection} */(currentContainer.parent);
					if (!currentContainer)
						break;
				}
				if (!nextSibling)
					return null;
			}
			currentContainer = nextSibling;
			finalEvent = currentContainer.getFirstEvent();
			if (finalEvent)
				return finalEvent;
		} while (true);
	}
    /**
     *
     *
     * @param {KeyboardEvent} e
     * @param {TimelineEvent=} timelineEvent
     * @memberof TimelineDayWeekView
     */

	onKeyDown(e, timelineEvent) {
		if (!isValidKeyEvent(e))
			return;
		if (e.keyCode === KEYS.ESC || e.keyCode !== KEYS.E) {
			if (this.activeTimelineEvent)
				this.activeTimelineEvent.isFocused = false;
			this.setCurrentEvent(null);
			return;
		}
		if (!this.isActiveView)
			return;
		if (e.currentTarget instanceof HTMLDocument)
			return;
		let curreltTargetEl = /**@type {HTMLElement} */(e.currentTarget);
		if (!curreltTargetEl.classList.contains('timeline-container'))
			return;
		let shouldStop = false;
		let isFirstNode = false;
		if (!timelineEvent) {
			if (e.keyCode === KEYS.TAB)
				shouldStop = true;
			let targetEl = /**@type {Element} */(e.target);
			let eventEl = /**@type {HTMLDivElement} */(targetEl.closest('.event'));
			if (eventEl) {
				let eventId = eventEl.getAttribute('event-id');
				if (!eventId)
					return;
				timelineEvent = this.eventMap.get(eventId);
			} else {
				isFirstNode = true;
				for (var i = 0; i < this.eventSections.length; i++) {
					timelineEvent = this.eventSections[i].getFirstEvent();
					if (timelineEvent)
						break;
				}
			}
		}

		if (!timelineEvent)
			return;
		let nextFocusTimelineEvent = /**@type {TimelineEvent} */(null);
		if (!isFirstNode) {
			timelineEvent.isFocused = false;
			if (e.shiftKey) {
				nextFocusTimelineEvent = this.getPrevEvent(timelineEvent);
				if (!nextFocusTimelineEvent)
					nextFocusTimelineEvent = this.getPrevEvent();
			}
			else {
				nextFocusTimelineEvent = this.getNextEvent(timelineEvent);
				if (!nextFocusTimelineEvent)
					nextFocusTimelineEvent = this.getNextEvent();
			}
		} else {
			nextFocusTimelineEvent = timelineEvent;
		}
		if (!nextFocusTimelineEvent) {
			return;
		}
		if (shouldStop) {
			e.stopImmediatePropagation();
			e.stopPropagation();
			e.preventDefault();
		}
		let {scrollX, scrollY} = this.getEventScrollPosition(nextFocusTimelineEvent);
		this.scroller.scroll(scrollX, scrollY);
		nextFocusTimelineEvent.isFocused = true;
		this.setCurrentEvent(nextFocusTimelineEvent);
		let el = /** @type {HTMLDivElement}*/(this.scrolee.querySelector(`.event[event-id="${nextFocusTimelineEvent.id}"]`));
		if (el) {
			el.focus();
			return;
		}
		this.layoutVersion++;
	}
	stopScrolling() {
		this.currentScrollDirection = -1;
		if (this.scrollTimerId === -1)
			return;
		window.clearTimeout(this.scrollTimerId);
		this.scrollTimerId = -1;
	}

	startScrolling(keepScrolling = false, lockX = false, lockY = false, isTimerCall = false) {
		if (this.currentScrollDirection === -1) {
			this.stopScrolling();
			return;
		}
		if (!isTimerCall) {
			if (this.scrollTimerId !== -1)
				return;
		}
		let deltaX = 0;
		let deltaY = 0;
		const SCROLL_VALUE = 5;
		switch (this.currentScrollDirection) {
			case scrollDirection.topLeft:
				deltaX = -SCROLL_VALUE;
				deltaY = -SCROLL_VALUE;
				break;
			case scrollDirection.top:
				deltaY = - SCROLL_VALUE;
				break;
			case scrollDirection.topRight:
				deltaX = SCROLL_VALUE;
				deltaY = -SCROLL_VALUE;
				break;
			case scrollDirection.right:
				deltaX = SCROLL_VALUE;
				break;
			case scrollDirection.bottomRight:
				deltaX = SCROLL_VALUE;
				deltaY = SCROLL_VALUE;
				break;
			case scrollDirection.bottom:
				deltaY = SCROLL_VALUE;
				break;
			case scrollDirection.bottomLeft:
				deltaX = -SCROLL_VALUE;
				deltaY = SCROLL_VALUE;
				break;
			case scrollDirection.left:
				deltaX = -SCROLL_VALUE;
				break;
		}
		if (lockX)
			deltaX = 0;
		if (lockY)
			deltaY = 0;
		this.scroller.scroll(this.scroller.scrollLeft + deltaX, this.scroller.scrollTop + deltaY);
		if (keepScrolling) {
			//WARN: Do not use RequestAnimationFrame - Firefox has async mode
			this.scrollTimerId = window.setTimeout(this.startScrolling.bind(this, keepScrolling, lockX, lockY, true), 30);
		}
	}
    /**
     *
     *
     * @param {MouseEvent} e
     * @param {boolean} keepScrolling
     * @memberof TimelineDayWeekView
     */
	onMouseMove(e, keepScrolling = false, lockX = false, lockY = false) {
		this.currentScrollDirection = -1;
		if (!this.isActiveView)
			return;
		const isRTL = this.state.properties.dir === DIRECTION.RTL;
		const scrollerRect = this.scroller.getBoundingClientRect();
		const boundingRect = new Rectangle(
			scrollerRect.left + this.viewConfig.titleWidth,
			scrollerRect.top,
			scrollerRect.width - this.viewConfig.titleWidth,
			scrollerRect.height);
		if (isRTL)
			boundingRect.x = scrollerRect.left;

		const point = { x: e.clientX, y: e.clientY };
		const noScrollRegion = boundingRect.clone();
		let MARGIN_UNITS = 100;
		noScrollRegion.x = Math.max(0, boundingRect.x + MARGIN_UNITS);
		noScrollRegion.y = Math.max(0, boundingRect.y + MARGIN_UNITS);
		noScrollRegion.width = Math.max(0, boundingRect.width - 2 * MARGIN_UNITS);
		noScrollRegion.height = Math.max(0, boundingRect.height - 2 * MARGIN_UNITS);
		if (noScrollRegion.isPointInside(point)) {
			this.stopScrolling();
			return;
		}
		let bodyRect = (document.documentElement || document.body).getBoundingClientRect();
		let leftMargin = noScrollRegion.x;
		let topMargin = noScrollRegion.y;
		let rightMargin = bodyRect.right - scrollerRect.right + MARGIN_UNITS;
		let bottomMargin = bodyRect.bottom - scrollerRect.bottom + MARGIN_UNITS;


		// case#1: top-left
		const scrollRegion = new Rectangle(0, 0, leftMargin, topMargin);
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.topLeft;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case #2: top - right
		scrollRegion.x = bodyRect.right - rightMargin;
		scrollRegion.y = 0;
		scrollRegion.resize(rightMargin, topMargin);
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.topRight;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case #3 top area
		scrollRegion.x = 0;
		scrollRegion.y = 0;
		scrollRegion.width = bodyRect.width
		scrollRegion.height = topMargin;
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.top;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case #4 left-bottom
		scrollRegion.x = 0;
		scrollRegion.y = bodyRect.bottom - bottomMargin;
		scrollRegion.width = leftMargin;
		scrollRegion.height = bottomMargin;
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.bottomLeft;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case #5 left scroll
		scrollRegion.x = 0;
		scrollRegion.y = 0;
		scrollRegion.width = leftMargin;
		scrollRegion.height = bodyRect.height;
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.left;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case 6 bottom-right side
		scrollRegion.x = bodyRect.right - rightMargin;
		scrollRegion.y = bodyRect.bottom - bottomMargin;
		scrollRegion.width = rightMargin;
		scrollRegion.height = bottomMargin;
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.bottomRight;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case 7 - bottom scroll
		scrollRegion.x = 0
		scrollRegion.y = bodyRect.bottom - bottomMargin;
		scrollRegion.width = bodyRect.width
		scrollRegion.height = bottomMargin;
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.bottom;
			this.startScrolling(keepScrolling, lockX, lockY);
			return;
		}
		// case 8: - right scroll
		scrollRegion.x = bodyRect.right - rightMargin;
		scrollRegion.y = 0;
		scrollRegion.width = rightMargin
		scrollRegion.height = bodyRect.height
		if (scrollRegion.isPointInside(point)) {
			this.currentScrollDirection = scrollDirection.right;
			this.startScrolling(keepScrolling, lockX, lockY);
		}
	}

	onMouseActionDone() {
		this.currentTransactionRow = null;
		this.setCurrentTransaction(null);
		this.prevMouseEventTimeStamp = 0;
	}
	/**
	 *
	 * @param {MouseEvent} e
	 */
	onGlobalMouseDown(e) {
		if (this.prevMouseEventTimeStamp === e.timeStamp)
			return;
		if (this.activeTimelineEvent)
			this.activeTimelineEvent.isFocused = false;
		const targetEL = /** @type {Element}*/(e.target);
		if (this.currentTransactionHandler) {
			this.currentTransactionHandler.handleMouseUp(e, this.state);
			this.onMouseActionDone();
			return;
		}
		this.setCurrentTransaction(null);
		this.currentTransactionRow = null;

		const rowEl = /** @type {HTMLDivElement} */(targetEL.closest('.event-row'));
		if (!rowEl)
			return;
		let rowId = rowEl.getAttribute('row_id');
		this.currentTransactionRow = this.rowMap.get(rowId);
		if (!this.currentTransactionRow)
			return;
		this.prevMouseEventTimeStamp = e.timeStamp;
		this.currentTransactionHandler = this.currentTransactionRow.handleMouseDownAction(e, rowEl,
			this.viewConfig, this.state, this.dispatch);
		if (this.currentTransactionHandler)
			this.setCurrentEvent(this.currentTransactionHandler.getCurrentEvent());
	}
	/**
	 *
	 * @param {MouseEvent} e
	 */
	onGlobalMouseMove(e) {
		if (!this.isActiveView) {
			this.setCurrentTransaction(null);
			return;
		}
		if (this.currentTransactionHandler) {
			this.currentTransactionHandler.handleMouseMove(e);
			this.onMouseMove(e, true, false, true);
		} else this.stopScrolling();
	}
	/**
	 * @param {MouseEvent} e
	 */
	onGlobalMouseUp(e) {
		this.stopScrolling();
		if (!this.isActiveView) {
			this.setCurrentTransaction(null);
			return;
		}
		if (this.currentTransactionHandler) {
			this.setPendingTransaction(this.currentTransactionHandler);
			this.currentTransactionHandler.handleMouseUp(e, this.state);
			if (this.pendingTransactionHandler && !this.pendingTransactionHandler.isValidHandler())
				this.setPendingTransaction(null);
		}
		this.onMouseActionDone();
	}
	/**
	 *
	 * @param {MouseEvent} e
	 */
	onGlobalMouseLeave(e) {
		this.stopScrolling();
		if (this.currentTransactionHandler) {
			this.setPendingTransaction(null);
			this.currentTransactionHandler.handleMouseLeave(e);
		}
		this.setPendingTransaction(null);
		this.onMouseActionDone();
	}
	/**
	 *
	 * @param {KeyboardEvent} e
	 */
	onGlobalKeyDown(e) {
		if (this.prevKeydownTimestamp === e.timeStamp)
			return;
		this.prevKeydownTimestamp = e.timeStamp;
		this.onKeyDown(e);
	}
}

export function TimelineFactory() {
	return new TimelineDayWeekView();
}

export default function () {
	/**
     *
     * @param {import('../../..').TimelineConfig} viewSettings
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	function renderer(viewSettings, state, dispatch) {
		let view = /**@type {TimelineDayWeekView} */(state.timelineView);
		if (!view) {
			view = TimelineFactory();
			dispatch(ACTIONS.INTERNAL_STATE_SET, { timelineView: view });
			return;
		}
		if (view.viewPort && view.currentTransactionHandler) {
			if (!view.viewPort.intersects(view.currentTransactionHandler.getBoundingRect())) {
				view.setCurrentTransaction(null);
				view.setCurrentEvent(null);
				view.onMouseActionDone();
			}
		} else {
			view.onMouseActionDone();
		}
		view.appendViewSpecificData(viewSettings);
		let currentViewSettings = viewSettings;
		let currentState = state;
		let appDispatch = dispatch;

		view.state = currentState;
		view.viewConfig = currentViewSettings;
		view.dispatch = appDispatch;

		let { properties: props } = { ...state };
		const contextDate = state.contextMoment.clone();
		let viewStartTime = TimelineUtils.getViewStartTime(contextDate, currentViewSettings);
		let viewEndTime = TimelineUtils.getViewEndTime(contextDate, currentViewSettings);
		if (viewSettings.viewName === VIEWS.TIMELINE_WEEK) {
			const { startMoment, endMoment } = calculateDateRange(contextDate, viewSettings.xSize, props.firstDayOfWeek);
			viewStartTime = startMoment;
			viewEndTime = endMoment;
		}

		currentState.timelineViewPort = currentState.timelineViewPort || view.viewPort;
		currentState.startMoment = viewStartTime;
		currentState.endMoment = viewEndTime;
		currentState.utcViewStartMS = viewStartTime.valueOf();
		currentState.utcViewEndMS = viewEndTime.valueOf();
		currentState.tzViewStartMS = viewStartTime.tzValueOf();
		currentState.tzViewEndMS = viewEndTime.tzValueOf();
		currentState.markSpanChunks = getProcessedMarkSpans(state, viewEndTime.diff(viewStartTime, 'days') + 1);

		const templateRenderer = getCurrentViewTemplateRenderer(state);
		let styleTag = null;
		if (templateRenderer instanceof TimelineTemplateRenderer) {
			const cssStyle = templateRenderer.getTemplateStyle();
			if(typeof cssStyle === 'string' &&  cssStyle.length > 0)
				styleTag = (<style key={state.properties.timelineTemplateRenderer + ''}>{cssStyle}</style>);
		}
		return (<div className="timeline-container-parent" ref={(el) => {
			currentState.timelineView.setTimelineHost(el);
		}} hook-update={(newVnode) => {
			updateContainerHeight(state, dispatch, newVnode.elm);
		}
		}>
			{styleTag}
			<div key="timeline-container" className="timeline-container"
				on-mousedown={(e) => {
					view.onGlobalMouseDown(e)
				}} on-keydown={(e) => {
					view.onGlobalKeyDown(e);
				}}
				hook-update={(newVnode) => setTimeout(() => setCellFocusOnLoad(currentState, dispatch, newVnode.elm), 500)}
				hook-insert={({elm}) => {dispatch(ACTIONS.INTERNAL_STATE_SET, {popoverContainerEl: elm});}}
				on-scroll={(e) => {
					const currentTarget = e.currentTarget;
					setTimeout(() => {
						currentTarget.scrollTop = 0;
					}, 100);
				}}>
				{view.render(currentViewSettings, currentState, appDispatch)}
			</div>
		</div>);
	}
	return renderer;
}

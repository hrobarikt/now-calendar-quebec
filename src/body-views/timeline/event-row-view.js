/// @ts-check
import {
	NO_EVENT_ROW_HEIGHT,
	MINIMUM_EVENT_HEIGHT, TimelineUtils,
	DEFAULT_SECTION_KEY,
	DEFAULT_HEADER_HEIGHT,
	MINIMUM_EVENT_WIDTH,
	TEMP_EVENT_Z_INDEX,
	CURRENT_TRANSCATION_EVENT_OPACITY
} from './utils';
import { Rectangle } from './rectangle';
import moment from 'moment-timezone';
import { t } from 'sn-translate';
import { isCreateAllowed, isResizeAllowed, isMoveAllowed, dispatchEventClick, getEventPopoverClassName } from '../../util/eventsUtil';
import { ACTIONS, DIRECTION, POPOVERS, KEYS, INTERNAL_FORMAT, VIEWS, RESIZABLE_HANDLE_HEIGHT } from '../../constants';
import { dispatchEventResize, dispatchDragNewEventEnd, getEventAriaLabel } from '../../util/eventsUtil';
import {
	Log,
	getDirProperty,
	isNDSColor,
	getTextColor,
	getBorderColor,
	getBgColor,
	isCustomColor
} from '../../util';
import { CalendarEvent } from '../../util/calendarEvent';
import { setFocus } from '../../agenda-view/agenda-view';
import { createRef } from '@servicenow/ui-renderer-snabbdom';

/**
 * @typedef {import('../../..').TimelineConfig} TimelineConfig
 * @typedef {import('../../..').CalendarState} CalendarState
 * @typedef {import('../../..').CalendarProperties} CalendarProperties
 * @typedef {import('../../..').appDispatch} appDispatch
 * @typedef {import('../../..').RawSectionItem} RawSectionItem
 * @typedef {import('../../..').StepConfig} StepConfig
 */
export class UIElement extends Rectangle {
	/**
     *
     * @param {number=} x
     * @param {number=} y
     * @param {number=} width
     * @param {number=} height
     */
	constructor(x, y, width, height) {
		super(x, y, width, height);
		//this.boundingRect = new Rectangle(0, 0, width, height);
		this.parent = /**@type {UIElement}*/(null);
		this.prev = /**@type {UIElement} */(null);
		this.next = /**@type {UIElement} */(null);
		this.layoutVersion = -1;
	}
	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {Readonly<moment.Moment>} viewStart
     * @param {Readonly<moment.Moment>} viewEnd
     */
	layout(viewConfig, viewStart, viewEnd) {
	}
	invalidateLayout() {
		this.layoutVersion = -1;
	}
}

class UIElementWithBoundRect extends UIElement {
	/**
     *
     * @param {number=} x
     * @param {number=} y
     * @param {number=} width
     * @param {number=} height
     */
	constructor(x, y, width, height) {
		super(x, y, width, height);
		this.boundingRect = new Rectangle(this.x, this.y, this.width, this.height);
	}
	getBoundingRect() {
		return this.boundingRect.clone();
	}
	translate(deltaX = 0, deltaY = 0) {
		super.translate(deltaX, deltaY);
		this.boundingRect.translate(deltaX, deltaY);
	}
	resize(newWidth = 0, newHeight = 0) {
		super.resize(newWidth, newHeight);
		this.boundingRect.width = newWidth;
		this.boundingRect.height = newHeight;
	}
}

export class TimelineEvent extends UIElement {
	/**
     *
     * @param {string} id
     * @param {string} title
     * @param {CalendarEvent} rawEvent
     */
	constructor(id, title,
		startNotInView = false, isEndOverflown = false,
		sectionId = DEFAULT_SECTION_KEY, rawEvent = null) {
		super(0, 0, 0, 0);
		this.sectionId = sectionId;
		this.id = String(id);
		this.title = title;
		this.startNotInView = startNotInView;
		this.endNotInView = isEndOverflown;
		this.level = this.level;
		this.rawEvent = rawEvent;
		this.isFocused = false;
		this.isShortEvent = false;
	}
	get RawEvent() {
		return this.rawEvent;
	}
	/**
     * @param {CalendarEvent} value
     */
	set RawEvent(value) {
		this.rawEvent = value;
	}
	/**
	 * 
	 * @param {TimelineEvent} target 
	 */
	intersects(target) {
		/**
		 * 24 hours shift is configured with below 3 shifts
		 *  00:00:00 - 08:00:00
		 *  08:00:00 - 16:00:00
		 *  16:00:00- next day 00:00:00
		 *  Technically they are overlaping events. But real world applications will configure like this.
		 *  removing 1 MS will solve the problem.
		 */
		const srcDuration = this.rawEvent.endMS - this.rawEvent.startMS - 1;
		const targetDuration = target.rawEvent.endMS - target.rawEvent.startMS - 1;
		return !(target.rawEvent.startMS > this.rawEvent.startMS + srcDuration || this.rawEvent.startMS > target.rawEvent.startMS + targetDuration);
	}
	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {Readonly<moment.Moment>} viewStart
     * @param {Readonly<moment.Moment>} viewEnd
     */
	layout(viewConfig, viewStart, viewEnd) {
		const tzViewStartMS = viewStart.tzValueOf();
		const tzViewEndMS = viewEnd.tzValueOf();
		const availableWidth = TimelineUtils.getEventLineWidth(viewConfig);
		const tzEventStartMS = this.rawEvent.startMS + this.rawEvent.startUTCOffsetMS;
		const tzEventEndMS = this.rawEvent.endMS + this.rawEvent.endUTCOffsetMS;
		this.startNotInView = tzEventStartMS < tzViewStartMS;
		/**
		 * event spans 00:00:00 to next day 00:00:00
		 * Technically this event is spanned to next day. But real world applications will configure like this.
		 * Always check viewEndMS by adding 1ms
		 * this allows resize eventhandlers in UI
		 */
		this.endNotInView = tzEventEndMS > (tzViewEndMS + 1);
		let posX = (tzEventStartMS - tzViewStartMS) * availableWidth / (tzViewEndMS - tzViewStartMS);
		let width = (tzEventEndMS - tzEventStartMS) * availableWidth / (tzViewEndMS - tzViewStartMS);
		this.isShortEvent = false;
		const eventMinWidth = viewConfig.eventMinWidthMS
		
		if (tzEventEndMS - tzEventStartMS < eventMinWidth) {
			this.isShortEvent = true;
			
			const cellWidth = TimelineUtils.getCellWidth(viewConfig);
			const cellStart = Math.floor(posX / cellWidth);
			const cellLeftBoundary = cellStart * cellWidth;
			const cellRightBoundary = cellLeftBoundary + cellWidth;
			let changePosX = Math.floor(posX + width) <= cellRightBoundary ? true :  false;

			width = (eventMinWidth) * availableWidth / (tzViewEndMS - tzViewStartMS);

			if (changePosX && posX + width > cellRightBoundary)
				posX = (tzEventEndMS - eventMinWidth - tzViewStartMS) * availableWidth / (tzViewEndMS - tzViewStartMS);
		}

		this.x = Math.round(posX);
		this.y = 0;
		this.width = Math.round(width);
		this.height = viewConfig.eventHeight;
	}
	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
		let thisEvent = /**@type {TimelineEvent} */(this);
		let isPendingEvent = false;
		let isNewEvent = false;
		let isClickEvent = false;
		const isCustomRenderer = viewConfig.templates.eventBody.value.length > 0;
		let mouseEventHandler = state.timelineView.pendingTransactionHandler || state.timelineView.currentTransactionHandler;
		if (mouseEventHandler) {
			if (mouseEventHandler.getId() === thisEvent.id) {
				thisEvent = mouseEventHandler.getCurrentEvent();
				isPendingEvent = true;
				isNewEvent = mouseEventHandler.isNewEvent();
				isClickEvent = mouseEventHandler.isClickEvent();
			}
		}
		const { properties: props } = state;
		const eventKey = `event_${this.id}`;
		const attrs = {
			'event-id': this.id,
			id: 'event_' + this.id,
			key: eventKey,
			'aria-label': getEventAriaLabel(state , this.rawEvent)
		};
		let { posX, width } = this.getPercentageValuesFromPx(viewConfig);
		const eventStyleObj = {
			width: width + '%',
			height: viewConfig.eventHeight + 'px',
			backgroundColor: '',
			top: `${thisEvent.y}px`
		};
		this.rawEvent.textColor = getTextColor(this.rawEvent.textColor, this.rawEvent.bgColor);
		this.rawEvent.borderColor = getBorderColor(this.rawEvent.borderColor, this.rawEvent.bgColor);

		if (this.rawEvent.textColor)
			eventStyleObj.color = this.rawEvent.textColor;
		if (this.rawEvent.borderColor)
			eventStyleObj.borderColor = this.rawEvent.borderColor;

		if (isPendingEvent && !isClickEvent || isNewEvent) {
			eventStyleObj['z-index'] = TEMP_EVENT_Z_INDEX + '';
			eventStyleObj['opacity'] = CURRENT_TRANSCATION_EVENT_OPACITY;
		}

		const bg = getBgColor(thisEvent.rawEvent.bgColor, thisEvent.rawEvent.gradientColor1, thisEvent.rawEvent.gradientColor2)
		if (thisEvent.rawEvent.gradientColor1 && thisEvent.rawEvent.gradientColor2)
			eventStyleObj.background = bg;
		else eventStyleObj.backgroundColor = bg;

		if (thisEvent.rawEvent.textColor)
			eventStyleObj.color = thisEvent.rawEvent.textColor;
		if (props.dir === DIRECTION.LTR)
			eventStyleObj.left = `${posX}%`;
		else
			eventStyleObj.right = `${posX}%`;

		const applyAnimation = (vNode) => {
			if (!viewConfig.animation) return;
			const el = /**@type {HTMLDivElement} */(vNode.elm);
			if (!el)
				return;
			if (this.isFocused)
				el.focus();
			const animatedCls = 'animated-event';
			el.classList.add(animatedCls);
			setTimeout(() => {
				el.classList.remove(animatedCls);
			}, 1000);
		};
		let eventCls = ['event', getEventPopoverClassName(state, this.rawEvent.rawEvent.id)];
		if (isPendingEvent && isNewEvent)
			eventCls.push('pending-event');

		if (isNDSColor(thisEvent.rawEvent.bgColor))
			eventCls.push(thisEvent.rawEvent.bgColor);
		else if (isCustomColor(thisEvent.rawEvent.bgColor, thisEvent.rawEvent.gradientColor1, thisEvent.rawEvent.gradientColor2))
			eventCls.push('default', 'custom-color');
		else
			eventCls.push('default');
		let allowResize = isResizeAllowed(state, thisEvent.rawEvent) && !isPendingEvent;
		let allowMove = isMoveAllowed(state, thisEvent.rawEvent) && !isPendingEvent;
		if (allowResize)
			eventCls.push('resizable-event');
		let resizeJSXGenerator = () => {
			if (!allowResize)
				return;
			let resizeArray = [];
			let startStyle = {
				left: '0',
				top: `${viewConfig.eventHeight/2 - RESIZABLE_HANDLE_HEIGHT/2}px`
			};
			let endStyle = {
				top: `${viewConfig.eventHeight/2 - RESIZABLE_HANDLE_HEIGHT/2}px`,
				right: '0'
			};
			if (props.dir === DIRECTION.RTL) {
				let tempStyle = endStyle;
				endStyle = /** @type {any} */(startStyle);
				startStyle = /** @type {any} */(tempStyle);
			}
			if (!this.startNotInView)
				resizeArray.push(<div className="event-resize event-resize-start" style={startStyle} />);
			if (!this.endNotInView)
				resizeArray.push(<div className="event-resize event-resize-end" style={endStyle} />);
			return resizeArray;
		};
		if(isCustomRenderer) {
			eventStyleObj.padding = "0px";
			eventStyleObj.border = "0px solid transparent";
			eventStyleObj.backgroundColor = 'transparent';
		}
		return (
			<div key={eventKey}
				hook-insert={applyAnimation}
				hook-update={(vNode) => {
					if (!thisEvent.isFocused)
						return;
					setTimeout(() => {
						if (thisEvent.isFocused)
							vNode.elm.focus();
					}, 50);
				}}
				on-blur={
                    /**
                     * @param {FocusEvent} e
                     */
					(e) => {
						if (thisEvent.isFocused) {
							e.stopImmediatePropagation();
							e.stopPropagation();
							e.preventDefault();
							return;
						}
						thisEvent.isFocused = false;
					}}
				on-keydown={
					/** @param {KeyboardEvent} e*/
					(e) => {
						if (e.keyCode === KEYS.E)
							thisEvent.isFocused = false;

						if (e.keyCode === KEYS.ENTER) {
							const { timelineView } = state;
							const { viewConfig } = timelineView;
							this.rawEvent.initializeMoment(props.timezone);
							const eventRect = (/**@type {HTMLElement} */(e.currentTarget)).getBoundingClientRect();
							const start = Math.max(viewConfig.titleWidth, eventRect.left);
							const end = Math.min(eventRect.right, viewConfig.titleWidth + state.timelineViewPort.width);
							dispatch(ACTIONS.TOGGLE_POPOVER,
								{
									popOver: POPOVERS.EVENT,
									event: this.rawEvent,
									eventEl: e.currentTarget,
									pos: {
										left: start + (end - start) / 2,
										top: eventRect.top + eventRect.height / 2
									}
								}
							);
						}
					}}
				className={eventCls.join(' ')}
				style={eventStyleObj}
				attrs={attrs}
				tabindex="-1"
				on-dragstart={(e) => {
					let dragEvent = /**@type {DragEvent} */(e);
					if (!isMoveAllowed(state, thisEvent.rawEvent))
						return;
					let target = /**@type {HTMLDivElement} */(dragEvent.currentTarget);
					const tempEvent = thisEvent.clone();
					tempEvent.rawEvent.initializeMoment(props.timezone);
					let left = (dragEvent.clientX - target.getBoundingClientRect().left);
					if (state.properties.dir === DIRECTION.RTL)
						left = target.getBoundingClientRect().right - dragEvent.clientX;

					const externalEvent = {
						id: tempEvent.id,
						duration: tempEvent.rawEvent.endMS - tempEvent.rawEvent.startMS,
						startPositionDifference: left,
						originatedFromInternal: true
					}
					dragEvent.dataTransfer.setData('text/plain', thisEvent.id); // work around for firefox
					dispatch('PROPERTIES_SET', { externalEvent });
				}}
				///@ts-ignore
				draggable={allowMove + ''}
				on-mouseenter={
					/**
                        @param {MouseEvent} e
                     */
					(e) => {
						state.timelineView.dispatchMouseHover(thisEvent.clone());
					}}
				on-click={(e) => {
					let mouseEventHandler = state.timelineView.pendingTransactionHandler || state.timelineView.currentTransactionHandler;
					if (mouseEventHandler && !mouseEventHandler.isClickEvent())
						return;
					let tempEvent = thisEvent.clone();
					tempEvent.rawEvent.initializeMoment(props.timezone);
					tempEvent.onClick(e, state, dispatch);
				}}
			>
				{this.isShortEvent && !(isPendingEvent || isNewEvent) ? <div className='short-event event-border'></div> : null}
				{state.properties.timelineTemplateRenderer.renderEventBody(viewConfig, state.properties, this, dispatch, state.tzViewStartMS, state.tzViewEndMS)}
				{resizeJSXGenerator()}
			</div>);
	}
    /**
     *
     *
     * @param {MouseEvent} mouseClickEvent
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     * @memberof TimelineEvent
     */
	onClick(mouseClickEvent, state, dispatch) {
		mouseClickEvent.stopPropagation();
		dispatch(ACTIONS.TOGGLE_POPOVER,
			{
				popOver: POPOVERS.EVENT,
				event: this.rawEvent,
				eventEl: mouseClickEvent.currentTarget,
				pos: {
					left: mouseClickEvent.clientX - document.querySelector('body').getBoundingClientRect().left,
					top: mouseClickEvent.clientY - document.querySelector('body').getBoundingClientRect().top
				}
			}
		);
		dispatchEventClick(state, dispatch, this.rawEvent, this.rawEvent.startMoment, this.rawEvent.endMoment);
	}

	clone() {
		const newTimelineEvent = new TimelineEvent(this.id, this.title,
			this.startNotInView,
			this.endNotInView, this.sectionId, this.rawEvent.clone());
		newTimelineEvent.x = this.x;
		newTimelineEvent.y = this.y;
		newTimelineEvent.width = this.width;
		newTimelineEvent.height = this.height;
		newTimelineEvent.parent = this.parent;
		return newTimelineEvent;
	}
    /**
     *
     * @param {number} viewStartMS
     * @param {number} viewEndMS
     */
	onUserActionDone(viewStartMS, viewEndMS) {
		if (this.rawEvent.startMS > this.rawEvent.endMS) {
			const endMS = this.rawEvent.endMS;
			this.rawEvent.endMS = this.rawEvent.startMS;
			this.rawEvent.startMS = endMS;
		}
		let newStartTime = this.rawEvent.startMS;
		let newEndTime = this.rawEvent.endMS;
		let diff = 0;
		if (this.rawEvent.endMS < viewStartMS) {
			diff = this.rawEvent.endMS - viewStartMS;
			newStartTime += diff;
			newEndTime = viewStartMS;
		}
		if (this.rawEvent.startMS > viewEndMS) {
			diff = this.rawEvent.startMS - viewEndMS;
			newStartTime = viewEndMS;
			newEndTime = this.rawEvent.endMS - diff;
		}
		this.rawEvent.startMS = newStartTime;
		this.rawEvent.endMS = newEndTime;
	}
    /**
     *
     * @param {number | import('../../..').Moment} newStartMS
     */
	setStartTime(newStartMS) {
		if(typeof newStartMS === 'number')
			this.rawEvent.startMS = newStartMS;
		else
			this.rawEvent.startMS = newStartMS.valueOf();
	}

	/**
     * @param {number | import('../../..').Moment} newEndTimeMS
     */
	setEndTime(newEndTimeMS) {
		if(typeof newEndTimeMS === 'number')
			this.rawEvent.endMS = newEndTimeMS;
		else
			this.rawEvent.endMS = newEndTimeMS.valueOf();
	}

	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     */
	getPercentageValuesFromPx(viewConfig) {
		const obj = {};
		const lineWidth = TimelineUtils.getEventLineWidth(viewConfig);
		obj.width = (this.width * 100) / lineWidth;
		obj.posX = (this.x * 100) / lineWidth;

		if (obj.posX < 0) {
			obj.width = obj.width + obj.posX;
			obj.posX = 0;
		}
		obj.width = Math.min(obj.width, 100 - obj.posX);
		return obj;
	}
}

export class EventLine extends UIElement {
	/**
     *
     * @param {number} noOfSlots
     * @param {number=} y
     * @param {number=} width
     * @param {number=} height
	 * @param {string} id
     */
	constructor(noOfSlots, y, width, height, id) {
		super(0, y, width, height);
		this.noOfSlots = noOfSlots;
		this.collection = /**@type {Array<TimelineEvent>} */([]);
        /**
         * @type {Array<Array<Rectangle>>}
         */
		this.collisionRects = new Array(noOfSlots);
		this.id = id;
	}
	get Collection() {
		return this.collection;
	}
    /**
     * @param {TimelineEvent} event
     */
	add(event) {
		event.parent = this;
		const slotWidth = this.Width / Math.max(1, this.noOfSlots);
		const lowerSlotIndex = Math.max(0, Math.floor(event.X / slotWidth));
		const higherSlotIndex = Math.min(this.noOfSlots, Math.ceil((event.X + event.width) / slotWidth));
		let index = 0;
		for (; index < this.collection.length; index++) {
			if (this.collection[index].rawEvent.startMS > event.rawEvent.startMS) {
				event.prev = index > 0 ? this.collection[index - 1] : null;
				if (event.prev)
					event.prev.next = event;
				event.next = this.collection[index];
				this.collection.splice(index, 0, event);
				break;
			}
		}
		if (index >= this.collection.length) {
			event.prev = this.collection.length > 0 ? this.collection[this.collection.length - 1] : null;
			if (event.prev)
				event.prev.next = event;
			this.collection.push(event);
		}
		this.fillCollisionRects(event, lowerSlotIndex, higherSlotIndex);
	}

    /**
     *
     * @param {TimelineEvent} event
     * @param {number} lowerSlot
     * @param {number} higherSlot
     */
	fillCollisionRects(event, lowerSlot, higherSlot) {
		for (let i = lowerSlot; i < higherSlot; i++) {
			const collisionRects = this.collisionRects[i] = this.collisionRects[i] || [];
			let index = 0;
			for (; index < collisionRects.length; index++) {
				if (collisionRects[index].x > event.x) {
					collisionRects.splice(index, 0, event);
					break;
				}
			}
			if (index >= collisionRects.length)
				collisionRects.push(event);
		}
	}
    /**
     *
     * @param {Rectangle} rect
     */
	canFit(rect) {
		const slotWidth = this.Width / this.noOfSlots + 1;
		const lowerSlotIndex = Math.max(0, Math.floor(rect.X / slotWidth));
		const upperSlotIndex = Math.min(this.noOfSlots, Math.ceil((rect.x + rect.width) / slotWidth));
		for (let i = lowerSlotIndex; i < upperSlotIndex; i++) {
			const coll = this.collisionRects[i];
			if (!coll)
				continue;
			for (let j = 0; j < coll.length; j++) {
				if (coll[j].intersects(rect))
					return false;
			}
		}
		return true;
	}
	getBoundingRect() {
		const rect = (/**@type {UIElementWithBoundRect} */(this.parent)).boundingRect.clone();
		rect.translate(this.x, this.y);
		rect.resize(this.width, this.height);
		return rect;
	}
    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {moment.Moment} viewStart
     * @param {moment.Moment} viewEnd
     */
	layout(viewConfig, viewStart, viewEnd) {
		for (let i = 0; i < this.collection.length; i++) {
			this.collection[i].layout(viewConfig, viewStart, viewEnd);
		}
	}
    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */

	render(viewConfig, state, dispatch) {
		const style = { top: this.y + 'px', height: this.height + 'px' };
		const jsx = [];
		const boundingRect = this.getBoundingRect();
		const eventHandler = state.timelineView.currentTransactionHandler || state.timelineView.pendingTransactionHandler;
		/**
		 * @type {TimelineEvent}
		 */
		let editingEvent = null;
		if (eventHandler)
			editingEvent = eventHandler.getCurrentEvent();

		for (let i = 0; i < this.collection.length; i++) {
			let thisItem = this.collection[i];
			if (editingEvent) {
				if (editingEvent.id === thisItem.id)
					thisItem = editingEvent;
			}
			boundingRect.translate(thisItem.x, thisItem.y);
			boundingRect.resize(thisItem.width, this.height);
			if (state.timelineViewPort.isCompletelyLeft(boundingRect)) {
				boundingRect.translate(-thisItem.x, -thisItem.y);
				continue;
			}
			if (state.timelineViewPort.isCompletelyRight(boundingRect))
				break;
			boundingRect.translate(-thisItem.x, -thisItem.y);
			jsx.push(thisItem.render(viewConfig, state, dispatch));
		}
		const eventLineKey = `event_line_${this.id}`;
		return (<div key={eventLineKey}
			attrs={{ id: 'event_line_' + this.id }}
			className="event-line" style={style}>
			{jsx}
		</div>);
	}
}

export class EventRow extends UIElementWithBoundRect {
	/**
     * @param {string} title
     * @param {string} id
     * @param {number} level
     * @param {number} noOfSlots
     * @param {number} eventHeight
     * @param {Array<TimelineEvent>} events
     */
	constructor(title, id, noOfSlots, level = 0,
		events = [], eventHeight = MINIMUM_EVENT_HEIGHT, bgColor = '', color = '') {
		super(0, 0, 0, NO_EVENT_ROW_HEIGHT);
		this.title = title;
		/**
		 * @type {Array<TimelineEvent>}
		 */
		this.events = events;
		if (!Array.isArray(this.events))
			this.events = /** @type {Array<TimelineEvent>} */([]);
		this.eventHeight = eventHeight;
		this.noOfSlots = noOfSlots;
		this.noOfSlots = Math.max(1, this.noOfSlots);
		this.level = level;
        /**
         * @type {Array<EventLine>}
         */
		this.lines = [];
		this.id = id;
        /**
         * @type{Map<string, TimelineEvent>}
         */
		this.eventMap = new Map();
		this.events.forEach((thisEvent) => {
			this.eventMap.set(thisEvent.id, thisEvent);
		});
		this.bgColor = bgColor;
		this.color = color;
		this.activeCell = 0;
		this.isCellFocus = false;
		this.isTitleFocus = false;
		this.localViewPort = Object.freeze(new Rectangle(0, 0, 0, 0).toObjectFormat());
		/**
		 * @type {Array<StepConfig>}
		 */
		this.stepConfigs = [];
	}
	get LineCollection() {
		return this.lines;
	}
	get EventCollection() {
		return this.events;
	}
	get Height() {
		return this.height;
	}
	/**
	 *
	 * @param {TimelineEvent} timelineEvent
	 */
	removeEvent(timelineEvent) {
		const index = this.events.findIndex((thisEvent) => {
			return thisEvent.id === timelineEvent.id;
		});
		if (index === -1)
			return;
		this.events.splice(index, 1);
		this.eventMap.delete(timelineEvent.id);
		this.invalidateLayout();
	}
	invalidateLayout() {
		this.layoutVersion = -1;
		this.parent.invalidateLayout();
	}
	getNextRow() {
		let ptr = this.next;
		if (!ptr || (ptr instanceof EventSection && ptr.isCollapsed)) {
			// Last row of current section reached, go to immediate parent
			if (!ptr)
				ptr = this.parent;

			// Find closest parent with existing next section which is not collapsed
			while (ptr && (!ptr.next || (ptr.next instanceof EventSection && ptr.next.isCollapsed)))
				ptr = ptr.parent;

			// Move to the next section found
			if (ptr)
				ptr = ptr.next;
		}
		// Traverse down until first row of first section found
		while (ptr && (ptr instanceof EventSection)) {
			if (ptr.collection)
				ptr = ptr.collection[0];
		}
		if (ptr instanceof EventRow)
			return ptr;

		return null;
	}
	getPreviousRow() {
		let ptr = this.prev;

		if (!ptr) {
			// First row of current section reached, go to previous sibling of immediate parent
			if (this.parent)
				ptr = this.parent.prev;
		}
		// Traverse down until last row of last section found
		while (ptr && (ptr instanceof EventSection)) {
			if (ptr.isCollapsed)
				ptr = ptr.prev;
			else {
				if (ptr.collection && ptr.collection.length > 0)
					ptr = ptr.collection[ptr.collection.length - 1];
			}
		}

		if (ptr instanceof EventRow)
			return ptr;

		return null;
	}
	getActiveCell() {
		return this.activeCell;
	}
	setActiveCell(cell) {
		this.activeCell = cell;
	}
	setCellFocus(val) {
		this.isCellFocus = !!val;
	}
	getAriaLabel(state, viewConfig) {
		const {properties:props} = state;
		const cellPosX = this.getActiveCell() * TimelineUtils.getCellWidth(viewConfig);
		const startMoment = TimelineUtils.posXToMomentTime(cellPosX, TimelineUtils.getEventLineWidth(viewConfig), state.startMoment, state.endMoment);
		if (props.currentView === VIEWS.TIMELINE_DAY)
			return this.title + ', ' + startMoment.format(INTERNAL_FORMAT.ARIA_DATE_TIME_FORMAT); //Day View
		else if (props.currentView === VIEWS.TIMELINE_WEEK)
			return this.title + ', ' + startMoment.format(INTERNAL_FORMAT.ARIA_DATE_FORMAT); //Week View
	}
	/**
	 *
	 * @param {Readonly<string>} direction
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	updateActiveCell(direction, viewConfig) {
		if (direction === DIRECTION.LEFT && this.activeCell > 0)
			this.activeCell--;

		if (direction === DIRECTION.RIGHT && this.activeCell < viewConfig.xSize)
			this.activeCell++;
	}
	/**
	 *
	 * @param {Readonly<string>} direction
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	getNextActiveCell(direction, viewConfig) {
		if ((direction === DIRECTION.LEFT && this.activeCell === 0) || (direction === DIRECTION.RIGHT && this.activeCell === viewConfig.xSize - 1))
			return -1;

		this.updateActiveCell(direction, viewConfig);
		return this.getActiveCell();
	}
	/**
	 *
	 * @param {import('../../..').CalendarState} state
	 * @param {number} cellNumber
	 */
	getCellStyle(state, cellNumber) {
		if (!state.timelineView || !state.timelineView.viewConfig)
			return {};

		return {
			height: this.Height + 'px',
			top: "0px",
			[getDirProperty('start', state)]: cellNumber * TimelineUtils.getCellWidth(state.timelineView.viewConfig) + 'px',
			width: TimelineUtils.getCellWidth(state.timelineView.viewConfig) + 'px'
		};
	}
	/**
	 * @param {import('../../..').CalendarState} state
	 * @param {HTMLElement} cellEl
	 * @param {number} cellPos
	 */
	setCurrentCellFocus(state, cellEl, cellPos) {
		let styleObj = this.getCellStyle(state, cellPos);
		for (var prop in styleObj)
			cellEl.style[prop] = styleObj[prop];
		cellEl.style.visibility = 'visible';
		cellEl.focus();
		this.isCellFocus = true;
	}
	/**
	 * @param {import('../../..').appDispatch} dispatch
	 * @param {HTMLElement} cellEl
	 */
	updateActiveCellFromState(state, dispatch, cellEl) {
		if (!this.isCellFocus)
			return;
		if (state.activeRow && (this.id === state.activeRow.id)) {
			this.setCurrentCellFocus(state, cellEl, state.activeRow.cellPos);
			this.setActiveCell(state.activeRow.cellPos);
			dispatch(ACTIONS.INTERNAL_STATE_SET, { activeRow: null });
		}
	}
	/**
     * @param {number} newHeight
     */
	set Height(newHeight) {
		this.height = Math.max(NO_EVENT_ROW_HEIGHT, newHeight);
	}
	/**
     *
     * @param {TimelineEvent} event
     */
	add(event) {
		this.eventMap.set(event.id, event);
		this.events.push(event);
		event.parent = this;
		this.invalidateLayout();
	}
    /**
     * @returns {TimelineEvent}
     */
	getFirstEvent() {
		if (this.lines.length == 0)
			return null;
		return this.lines[0].collection[0];
	}
    /**
     * @returns {TimelineEvent}
     */
	getLastEvent() {
		if (this.lines.length === 0)
			return null;
		const lastLine = this.lines[this.lines.length - 1];
		return lastLine.collection[lastLine.collection.length - 1];
	}
    /**
     *
     * @param {TimelineEvent=} event
     * @returns {TimelineEvent}
     */
	getNextEvent(event) {
		if (!(event instanceof TimelineEvent))
			return this.getFirstEvent();
		if (event.next instanceof TimelineEvent)
			return /**@type {TimelineEvent} */(event.next);
		if (event.parent.next instanceof EventLine)
			return (/**@type {EventLine} */(event.parent.next)).collection[0];
		return null;
	}
	sortEvents() {
		this.events = this.events.sort((a, b) => {
			return a.rawEvent.startMS - b.rawEvent.startMS
		});
	}

    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {Readonly<moment.Moment>} viewStartTime
     * @param {Readonly<moment.Moment>} viewEndTime
     */
	layout(viewConfig, viewStartTime, viewEndTime) {
		this.x = viewConfig.left;
		this.y = viewConfig.top;

		const MARGIN_TOP_BOTTOM = 4;
		const availableWidth = TimelineUtils.getEventLineWidth(viewConfig);
		this.width = availableWidth;
		const lineHeight = this.eventHeight + MARGIN_TOP_BOTTOM; // top and bottom pixels
		this.boundingRect.x = viewConfig.offsetX;
		this.boundingRect.y = viewConfig.offsetY;

		if (this.layoutVersion != viewConfig.layoutVersion) {
			this.sortEvents();
			this.layoutVersion = viewConfig.layoutVersion;
			this.lines = [];
			this.events.forEach((thisEvent) => {
				thisEvent.layout(viewConfig, viewStartTime, viewEndTime);
				for (let i = 0; i < this.lines.length; i++) {
					if (this.lines[i].canFit(thisEvent)) {
						this.lines[i].add(thisEvent);
						return;
					}
				}
				const posY = this.lines.length * lineHeight + MARGIN_TOP_BOTTOM;
				const lineId = `${this.id}_${this.lines.length}`;
				const newEventLine = new EventLine(this.noOfSlots,
					posY,
					this.width, this.eventHeight, lineId);
				newEventLine.parent = this;
				newEventLine.add(thisEvent);
				newEventLine.prev = this.lines.length > 0 ? this.lines[this.lines.length - 1] : null;
				this.lines.push(newEventLine);
				if (newEventLine.prev)
					newEventLine.prev.next = newEventLine;
				//WARN: Do not assign to "height". we will loose MIN_HEIGHT property
				this.Height = this.lines.length * lineHeight + MARGIN_TOP_BOTTOM;
			});
			if (this.lines.length > 0) {
				let line = this.lines[0];
                /**
                 * @type {TimelineEvent}
                 */
				let prevLastEvent = null;
				while (line) {
					let firstElement = line.collection[0];
					let lastElement = line.collection[line.collection.length - 1];
					firstElement.prev = prevLastEvent;
					if (prevLastEvent)
						prevLastEvent.next = firstElement;
					prevLastEvent = lastElement;
					line = /**@type {EventLine} */(line.next);
				}
			}
		} else {
			this.Height = this.lines.length * lineHeight + MARGIN_TOP_BOTTOM;
		}
		const rowHeightBottomPaddingInLines = viewConfig.rowHeightBottomPaddingInLines?viewConfig.rowHeightBottomPaddingInLines:1;
		if (this.height < (this.lines.length * lineHeight + MARGIN_TOP_BOTTOM + rowHeightBottomPaddingInLines * MINIMUM_EVENT_HEIGHT))
			this.Height = this.lines.length * lineHeight + MARGIN_TOP_BOTTOM + rowHeightBottomPaddingInLines * MINIMUM_EVENT_HEIGHT;
		this.boundingRect.width = this.width;
		this.boundingRect.height = this.height;
	}
    /**
     *
     * @param {MouseEvent} downEvent
     * @param {HTMLDivElement} rowEl
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	handleMouseDownAction(downEvent, rowEl, viewConfig, state, dispatch) {
		if (downEvent.button != 0)
			return null;
		const { properties: props } = state;
		const viewStartTime = state.startMoment;
		const viewEndTime = state.endMoment;
		let isMoved = false;
		let thisRow = this;
		let isModifyingStart = false;
		let isModifyingEnd = false;
		const isRTL = props.dir === DIRECTION.RTL;
        /**
         * @type {HTMLDivElement}
         */
		let targetEventEl = null;
        /**
         * @type {TimelineEvent}
         */
		let timelineEvent = null;
		/**
		 * @type {TimelineEvent}
		 */
		let originalTimelineEvent = null;
		let rowRect = rowEl.getBoundingClientRect();
		isModifyingEnd = isModifyingStart = false;
		let posY = 0;
		const targetEl = /**@type {HTMLElement} */(downEvent.target);
		if (targetEl.classList.contains('event-resize')) {
			if (targetEl.classList.contains('event-resize-start'))
				isModifyingStart = true;
			else
				isModifyingEnd = true;
		}
		targetEventEl = /** @type {HTMLDivElement} */(targetEl.closest('.event'));
		let isCreationMode = isCreateAllowed(state);
		if (targetEventEl) {
			isCreationMode = false;
			originalTimelineEvent = timelineEvent = thisRow.eventMap.get(targetEventEl.getAttribute('event-id'));
			if ((isModifyingStart || isModifyingEnd)) {
				downEvent.preventDefault(); // stops event drag operation, while resize
				if (!isResizeAllowed(state, timelineEvent.rawEvent))
					return null;
			} else {
				// while event move don't handle mouse down event
				return null;
			}
			// make a copy of event so reverting is easy in case of cancel the current operation
			timelineEvent = timelineEvent.clone();
			timelineEvent.rawEvent.initializeMoment(props.timezone);
		} else {
			if (!isCreationMode)
				return null;
		}
        /**
         *
         * @param {MouseEvent} e
         */
		var getStartAndEndMomentFromPos = (e) => {
			let mousePosX = e.clientX - rowRect.left;
			if (isRTL)
				mousePosX = rowRect.width - mousePosX;
			mousePosX = Math.min(mousePosX, rowRect.width);
			mousePosX = Math.max(mousePosX, 0);
			const snapCellWidth = TimelineUtils.getSnapCellWidth(viewConfig);
			let posX = mousePosX - (mousePosX % snapCellWidth) + (isModifyingEnd || isCreationMode ? snapCellWidth: 0);
			const cellWidth = rowRect.width / viewConfig.xSize;
			let slotIndex = Math.floor(mousePosX / cellWidth);
			if (slotIndex === viewConfig.xSize)
				slotIndex--;
			let startM = state.startMoment.clone();
			startM.add(slotIndex * viewConfig.xStep, viewConfig.xUnitName);
			let endM = startM.clone().add(viewConfig.xStep, viewConfig.xUnitName).subtract(1, 'ms');
			let posM = TimelineUtils.posXToMomentTime(posX, rowRect.width, state.startMoment, state.endMoment);
			if (!TimelineUtils.isValidSnapGranularity(viewConfig))
				posM = endM.clone();
			let currentM = TimelineUtils.posXToMomentTime(mousePosX, rowRect.width, viewStartTime, viewEndTime);
			return {
				startM: startM,
				endM: endM,
				currentM: currentM,
				posX: mousePosX,
				posM
			};
		};
		let startPosSlotDates = getStartAndEndMomentFromPos(downEvent);
		let originalDates = {
			startM: startPosSlotDates.startM,
			endM: startPosSlotDates.endM,
			currentM: startPosSlotDates.currentM,
			posX: startPosSlotDates.posX
		};
		if (isCreationMode) {
			if (TimelineUtils.isValidSnapGranularity(viewConfig)) {
				originalDates.startM = startPosSlotDates.posM.clone().subtract(viewConfig.snapGranularity, 'minute');
				originalDates.endM = startPosSlotDates.posM.clone();
			}
			posY = downEvent.clientY - rowRect.top;
			if (rowRect.height < (posY + viewConfig.eventHeight + 2))
				posY = rowRect.height - (viewConfig.eventHeight + 2);
			const calendarEvent = new CalendarEvent({
				start: originalDates.startM.valueOf(),
				end: originalDates.endM.valueOf(),
				startMS: originalDates.startM.valueOf(),
				endMS: originalDates.endM.valueOf(),
				id: 'new_event',
				title: t('New event'),
			});
			calendarEvent.setTimezone(props.timezone);
			calendarEvent.initializeMoment(props.timezone);
			timelineEvent = new TimelineEvent(calendarEvent.id, calendarEvent.title, false, false, 'new_event', calendarEvent);
			timelineEvent.layout(viewConfig, viewStartTime, viewEndTime);
		} else {
			let deltaX = 0;
			if (isModifyingStart)
				deltaX = timelineEvent.x - originalDates.posX;
			else
				deltaX = timelineEvent.x + timelineEvent.width - originalDates.posX;

			originalDates.startM = timelineEvent.rawEvent.startMoment.clone();
			originalDates.endM = timelineEvent.rawEvent.endMoment.clone();
			originalDates.currentM = TimelineUtils.posXToMomentTime(originalDates.posX + deltaX, this.width, state.startMoment, state.endMoment);
		}
		/**
		 * @type {MouseEvent}
		 */
		let lastMoveEvent = downEvent;
		function adjustTimelineEventStyle() {
			timelineEvent.layout(viewConfig, viewStartTime, viewEndTime);
			let eventWidth = Math.max(10, Math.abs(timelineEvent.width));
			let eventPosX = timelineEvent.x;
			if (timelineEvent.width < 0)
				eventPosX -= eventWidth;
			if ((eventPosX + eventWidth) > thisRow.width)
				eventWidth = (thisRow.width - eventPosX);
			if (!isRTL)
				targetEventEl.style.left = `${eventPosX}px`;
			else
				targetEventEl.style.right = `${eventPosX}px`;

			targetEventEl.style.width = `${eventWidth}px`;
		}
		return {
			originalTimelineEvent: originalTimelineEvent,
			getOriginalEvent: function () {
				return originalTimelineEvent;
			},
			isNewEvent: function () {
				return isCreationMode;
			},
			getId: function () {
				return timelineEvent.id;
			},
			getPosY: function () {
				return posY;
			},
			getBoundingRect: function () {
				return thisRow.boundingRect.clone();
			},
			getParentRow: function () {
				return thisRow;
			},
            /**
             *
             * @param {HTMLDivElement} newRowEl
             */
			setNewRowEl: function (newRowEl) {
				rowEl = newRowEl;
			},
			onRefresh: function () {
				rowEl = null;
				targetEventEl = null;
			},
			isValidHandler: function () {
				if (isCreationMode)
					return true;
				return !this.isClickEvent() && (isModifyingStart || isModifyingEnd)
			},
			/**
             *
             * @param {HTMLDivElement} newEventEl
             */
			setEventEl: function (newEventEl) {
				targetEventEl = newEventEl;
			},
			isClickEvent: function () {
				return !isMoved;
			},
			getCurrentEvent: function () {
				return timelineEvent;
			},
			onScroll: function () {
				this.handleMouseMove(lastMoveEvent);
			},
			/**
			 *
			 * @param {MouseEvent} mouseLeaveEvent
			 */
			handleMouseLeave: function (mouseLeaveEvent) {
				if (!originalTimelineEvent)
					return;
				if (!rowEl) {
					const rowSelector = `#event_row_${thisRow.id}`;
					rowEl = state.timelineView.scrolee.querySelector(rowSelector);
					if (!rowEl)
						return;
					rowRect = rowEl.getBoundingClientRect();
				}
				targetEventEl = rowEl.querySelector(`#event_${originalTimelineEvent.id}`);
				if (!targetEventEl)
					return;
				const { posX, width } = timelineEvent.getPercentageValuesFromPx(viewConfig);
				targetEventEl.style.width = `${width}%`;
				targetEventEl.style.height = `${viewConfig.eventHeight}px`;
				if (isRTL)
					targetEventEl.style.right = `${posX}%`;
				else
					targetEventEl.style.left = `${posX}%`;
			},
            /**
             *
             * @param {MouseEvent} moveEvent
             */
			handleMouseMove: function (moveEvent) {
				if (!timelineEvent)
					return;
				lastMoveEvent = moveEvent;
				isMoved = true;
				const isValidSnapGranularity = TimelineUtils.isValidSnapGranularity(viewConfig);
				if (!rowEl) {
					const rowSelector = `#event_row_${thisRow.id}`;
					rowEl = state.timelineView.scrolee.querySelector(rowSelector)
					if (!rowEl)
						return;
				}
				rowRect = rowEl.getBoundingClientRect();
				if (!targetEventEl)
					targetEventEl = rowEl.querySelector(`#event_${timelineEvent.id}`);
				if (!isCreationMode) {
					if (!targetEventEl)
						return;
				}
				rowRect = rowEl.getBoundingClientRect();
				if (!targetEventEl && isCreationMode) {
					targetEventEl = document.createElement('div');
					targetEventEl.id = `#event_${timelineEvent.id}`;
					targetEventEl.classList.add('temp-event');
					let posY = downEvent.clientY - rowRect.top;
					if (rowRect.height < (posY + viewConfig.eventHeight + 2))
						posY = rowRect.height - (viewConfig.eventHeight + 2);
					targetEventEl.style.top = `${posY}px`;
					targetEventEl.style.height = `${viewConfig.eventHeight}px`;
					targetEventEl.innerHTML = `<span>${timelineEvent.rawEvent.title}</span>`;
					rowEl.appendChild(targetEventEl);
					adjustTimelineEventStyle();
				}
				targetEventEl.style.zIndex = TEMP_EVENT_Z_INDEX + '';
				targetEventEl.style.opacity = CURRENT_TRANSCATION_EVENT_OPACITY;
				const currentPosDates = getStartAndEndMomentFromPos(moveEvent);
				if (isCreationMode) {
					if (currentPosDates.currentM.isBetween(originalDates.startM, originalDates.endM)) {
						timelineEvent.setStartTime(originalDates.startM);
						timelineEvent.setEndTime(originalDates.endM);
					} else {
						if (currentPosDates.currentM.isBefore(originalDates.startM)) {
							if (isValidSnapGranularity)
								timelineEvent.setStartTime(currentPosDates.posM.clone().subtract(viewConfig.snapGranularity, 'minute'));
							else
								timelineEvent.setStartTime(currentPosDates.startM);
							timelineEvent.setEndTime(originalDates.endM);
						} else if (currentPosDates.currentM.isAfter(originalDates.endM)) {
							timelineEvent.setStartTime(originalDates.startM);
							timelineEvent.setEndTime(currentPosDates.posM);
						}
					}
					adjustTimelineEventStyle();
					return;
				}
				if (!(isModifyingStart || isModifyingEnd))
					return;
				if (isModifyingStart && currentPosDates.currentM.isSameOrAfter(originalDates.endM))
					return;
				if (isModifyingEnd && currentPosDates.currentM.isSameOrBefore(originalDates.startM))
					return;

				if (isModifyingStart) {
					timelineEvent.setStartTime(isValidSnapGranularity? currentPosDates.posM: currentPosDates.startM);
					timelineEvent.setEndTime(originalDates.endM);
				} else {
					timelineEvent.setStartTime(originalDates.startM);
					timelineEvent.setEndTime(isValidSnapGranularity? currentPosDates.posM: currentPosDates.endM);
				}
				adjustTimelineEventStyle();
			},
            /**
             *
             * @param {MouseEvent} upEvent
             * @param {import('../../..').CalendarState} thisState
             */
			handleMouseUp: function (upEvent, thisState) {
				if (!isCreationMode) {
					if (this.isClickEvent() && (isModifyingStart || isModifyingEnd)) {
						isModifyingStart = false;
						isModifyingEnd = false;
						return;
					}
				}
				setTimeout(() => {
					if (!isCreationMode) {
						const payload = {
							event: timelineEvent.rawEvent,
							difference: originalTimelineEvent.rawEvent.startMS - timelineEvent.rawEvent.startMS,
							startMoment: moment.utc(timelineEvent.rawEvent.startMS).tz(state.properties.timezone),
							endMoment: moment.utc(timelineEvent.rawEvent.endMS).tz(state.properties.timezone)
						};
						dispatchEventResize(thisState, dispatch, timelineEvent.rawEvent, payload.startMoment, payload.endMoment);
					} else {
						if (this.isClickEvent()) {
							dispatchDragNewEventEnd(state, dispatch, originalDates.startM, originalDates.endM, thisRow.id);
							return;
						}
						// newEvent creation
						const payload = {
							event: timelineEvent.rawEvent,
							startMoment: moment.utc(timelineEvent.rawEvent.startMS).tz(state.properties.timezone),
							endMoment: moment.utc(timelineEvent.rawEvent.endMS).tz(state.properties.timezone)
						};
						dispatchDragNewEventEnd(thisState, dispatch, payload.startMoment, payload.endMoment, thisRow.id);
					}
				});
			}
		};
	}
    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
		let cls = ['event-row']
		const rowStyle = {
			height: this.Height + 'px',
			top: this.y + 'px',
			left: this.x + 'px',
		};
		const eventRowkey = TimelineUtils.getRowId(this.id);
		const rowAttrs = { id: 'event_row_' + this.id, row_id: this.id, key: eventRowkey };
		let jsx = [];
		const timelineViewPort = state.timelineViewPort;
		const lineBoundingRect = this.boundingRect.clone();
		lineBoundingRect.height = viewConfig.eventHeight;

		for (let i = 0; i < this.lines.length; i++) {
			lineBoundingRect.translate(this.lines[i].x, this.lines[i].y);
			if (timelineViewPort.isCompletelyAbove(lineBoundingRect)) {
				lineBoundingRect.translate(-this.lines[i].x, -this.lines[i].y);
				continue;
			}
			if (timelineViewPort.isComletelyBelow(lineBoundingRect))
				break;
			jsx.push(this.lines[i].render(viewConfig, state, dispatch));
			lineBoundingRect.translate(-this.lines[i].x, -this.lines[i].y);
		}
		const allowCreate = isCreateAllowed(state);
		if (allowCreate)
			cls.push('clickable');

		const cellRef = createRef();
		const rowRef = createRef();
		jsx.push(<div className='cell-focus'
			ref={cellRef}
			hook-update={({ elm }) => setTimeout(() => { this.updateActiveCellFromState(state, dispatch, elm) }, 500)}
			attrs={!allowCreate ? {} : { tabindex: '-1', pos: this.getActiveCell(), 'aria-label': this.getAriaLabel(state, viewConfig), key: Date.now()}}
			style={this.getCellStyle(state, this.activeCell)}
			on-focus={
				(e) => {
					this.isCellFocus = true;
				}}
			on-blur={
				(e) => {
					this.isCellFocus = false;
				}}
			on-keydown={
				/**
				* @param {KeyboardEvent} e
				 */
				(e) => {
					if (e.which === KEYS.ENTER && allowCreate) {
						const cellPosX = this.getActiveCell() * TimelineUtils.getCellWidth(viewConfig);
						let startM = TimelineUtils.posXToMomentTime(cellPosX, TimelineUtils.getEventLineWidth(viewConfig), state.startMoment, state.endMoment);
						const endM = startM.clone().add(viewConfig.xStep, viewConfig.xUnitName).subtract(1, 'ms');
						dispatchDragNewEventEnd(state, dispatch, startM, endM, this.id);
						this.isCellFocus = true;
						dispatch(ACTIONS.INTERNAL_STATE_SET, { activeRow: { id: this.id, cellPos: this.getActiveCell() } });
					}
				}} />);
		const mouseEventHandler = state.timelineView.pendingTransactionHandler || state.timelineView.currentTransactionHandler;
		if (mouseEventHandler) {
			if ((mouseEventHandler.getParentRow() === this) && mouseEventHandler.isNewEvent()) {
				let posY = mouseEventHandler.getPosY();
				let pendingEvent = mouseEventHandler.getCurrentEvent();
				pendingEvent.y = posY;
				let pendingEventJSX = pendingEvent.render(viewConfig, state, dispatch);
				jsx.push(pendingEventJSX);
			}
		}
		const cellWidth = TimelineUtils.getCellWidth(viewConfig);
		if(!state.timelineViewPort.equals(this.localViewPort)) {
			this.localViewPort = Object.freeze(state.timelineViewPort.toObjectFormat());
			const boundingRect = this.boundingRect.clone();
			this.stepConfigs = TimelineUtils.getRenderViewDates(state.startMoment, viewConfig).map((step, index) => {
				const cellBoundingRect = boundingRect.clone();
				cellBoundingRect.x = cellWidth * index;
				cellBoundingRect.width = cellWidth;
				return {
					startMS: step.start.valueOf(),
					endMS: step.end.valueOf(),
					isInView: state.timelineViewPort.intersects(cellBoundingRect),
					boundingRect: cellBoundingRect
				}
			});
		}
		/**
		 * @type {RawSectionItem}
		 */
		const section = TimelineUtils.findSection(/** @type {EventSection}*/(this.parent).rawSection, this.id);
		/**
		 * @type {import('../../..').RowBackgroundTemplateConfig}
		 */
		const rowBackgroundTemplateConfig = {
			cellWidth,
			viewPort: this.localViewPort,
			calendarProperties: state.properties,
			section,
			viewConfig,
			stepConfigs: this.stepConfigs,
			rowId: this.id
		};
		return (
			<div id={eventRowkey} key={eventRowkey} attrs={rowAttrs} className={cls.join(' ')} style={rowStyle}
				ref={rowRef}
				on-click={
					/**
					* @param {MouseEvent} e
					 */
					(e) => {
						const cellPos = TimelineUtils.getActiveCellPosFromX(state, rowRef.current, e.clientX);
						this.setActiveCell(cellPos);
						this.setCurrentCellFocus(state, cellRef.current, cellPos);
						dispatch(ACTIONS.INTERNAL_STATE_SET, { activeRow: { id: this.id, cellPos: cellPos } });
					}}
			>
				{state.properties.timelineTemplateRenderer.renderRowBackground(rowBackgroundTemplateConfig)}
				{jsx}
				{
					(state.externalEventSettings && state.externalEventSettings.rowId === rowAttrs.row_id) ? <div className="event-projection" /> : ''
				}
			</div>
		);
	}
    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderTitleSection(viewConfig, state, dispatch) {
		const { contextualPanelCurrentView } = state;
		const styleObj = {
			width: '100%',
			height: (this.height) + 'px',
			lineHeight: (this.height) + 'px',
			color: this.color,
			top: this.y + 'px'
		};
		const attrs = {
			key: `event-row-title-${this.id}`,
			row_id: this.id,
			'aria-label': this.title,
			tabindex: '-1'
		};
		let cls = ['event-row-section'];
		if (this.id === state.timelineView.selectedRowId)
			cls.push('selected');
		return (<div id={TimelineUtils.getRowTitleId(this.id)} key={attrs.key} className={cls.join(' ')} style={styleObj} attrs={attrs}
			hook-update={({ elm }) => setTimeout(() => { if (this.isTitleFocus) elm.focus() })}
			on-focus={
				(e) => {
					this.isTitleFocus = true;
				}}
			on-blur={
				(e) => {
					this.isTitleFocus = false;
				}}
			on-click={
				/**
				 * @param {MouseEvent} e
				 */
				(e) => {
					if (contextualPanelCurrentView !== 'agenda-view')
						dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView: 'agenda-view' });
					state.timelineView.agendaViewUpdateDebouncer(this.id);
					setTimeout(() => {
						if (state.timelineView.isActiveView)
							setFocus(e, state);
					}, 500);
				}}
			on-keydown={
				/**
				* @param {KeyboardEvent} e
				*/
				(e) => {
					if (e.which === KEYS.ENTER) {
						if (contextualPanelCurrentView !== 'agenda-view')
							dispatch(ACTIONS.INTERNAL_STATE_SET, { contextualPanelCurrentView: 'agenda-view' });
						state.timelineView.agendaViewUpdateDebouncer(this.id);
						setTimeout(() => {
							if (state.timelineView.isActiveView)
								setFocus(e, state);
						}, 500);
					}
				}}
		>
			{state.properties.timelineTemplateRenderer.renderRowTitle(viewConfig, state.properties, this)}
		</div>);
	}
}

export class EventSection extends UIElementWithBoundRect {
	/**
     *
     * @param {string} id
     * @param {string} title
     */
	constructor(id, title, level = 0, isCollapsed = false,
		showHeader = true, bgColor = '', color = '') {
		super(0, 0, 0, NO_EVENT_ROW_HEIGHT);
		this.id = id;
		this.title = title;
        /**
         * @type {boolean} - TODO: why intellisense is failing to recognize this as boolean without JSDoc?
         */
		this.isCollapsed = isCollapsed;
		this.level = level;
		this.showHeader = showHeader;
        /**
         * @type {Array<EventSection | EventRow>}
         */
		this.collection = [];
		this.bgColor = bgColor;
		this.color = color;
		this.rawSection = /** @type {import('../../..').RawSectionItem}*/(null);
	}

	invalidateLayout() {
		super.invalidateLayout();
		let parent = this.parent;
		while (parent) {
			parent.invalidateLayout();
			parent = parent.parent;
		}
	}
	/**
	 * @param {import('../../..').TimelineConfig} viewConfig
	 */
	fillEmptySection(viewConfig) {
		this.collection.forEach((item) => {
			if (item instanceof EventSection)
				item.fillEmptySection(viewConfig);
		});

		if (this.collection.length === 0) {
			this.addRow(new EventRow(this.title, this.id, viewConfig.xSize));
			return;
		}
	}
    /**
     *
     * @param {EventRow | EventSection} newRow
     */
	addRow(newRow) {
		let prev = null;
		if (this.collection.length > 0)
			prev = this.collection[this.collection.length - 1];
		this.collection.push(newRow);
		newRow.parent = this;
		newRow.prev = prev;
		if (prev) {
			prev.next = newRow;
		}
	}

	translate(x = 0, y = 0) {
		super.translate(x, y);
		this.collection.forEach((item) => {
			item.translate(x, y);
		});

	}
	onToggle() {
		this.isCollapsed = !this.isCollapsed;
		this.invalidateLayout();
	}

	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {Readonly<moment.Moment>} viewStart
     * @param {Readonly<moment.Moment>} viewEnd
     */
	layout(viewConfig, viewStart, viewEnd) {
		this.scheduleLayout(viewConfig, viewStart, viewEnd);
	}

	/**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {Readonly<moment.Moment>} viewStart
     * @param {Readonly<moment.Moment>} viewEnd
     * @param {(isCompleted: boolean, currentHeight: number, cancellableObj: {cancel: () => void}) => void} callback
     */
	scheduleLayout(viewConfig, viewStart, viewEnd, layoutStartTime = 0,
		callback = null, deltaTime = 0) {
		if (this.parent === null) {
			if (this.prev != null) {
				viewConfig.offsetY = this.prev.y + this.prev.height;
				viewConfig.top = viewConfig.offsetY;
				viewConfig.left = this.prev.x;
			} else {
				viewConfig.left = 0;
				viewConfig.top = 0;
				viewConfig.offsetX = 0;
				viewConfig.offsetY = 0;
			}
		}
		this.x = viewConfig.left;
		this.y = viewConfig.top;
		this.width = TimelineUtils.getEventLineWidth(viewConfig);
		this.height = this.getHeaderHeight(viewConfig);
		this.boundingRect.x = viewConfig.offsetX;
		this.boundingRect.y = viewConfig.offsetY;
		this.boundingRect.width = this.width;

		if (!this.isCollapsed) {
			viewConfig.top = this.height;
			viewConfig.offsetY += this.height;

			const offsetX = viewConfig.offsetX;
			const offsetY = viewConfig.offsetY;

			this.collection.forEach((thisItem) => {
				const previousOffsetY = viewConfig.offsetY;
				if (thisItem instanceof EventRow)
					thisItem.layout(viewConfig, viewStart, viewEnd);
				else {
					try {
						thisItem.scheduleLayout(viewConfig, viewStart, viewEnd, layoutStartTime, callback, deltaTime);
					} catch (e) {
					}
				}
				this.height += thisItem.Height;
				viewConfig.top = thisItem.y + thisItem.Height;
				viewConfig.offsetY = previousOffsetY + thisItem.Height;
			});
			viewConfig.offsetX = offsetX;
			viewConfig.offsetY = offsetY + this.height;
			this.boundingRect.height = this.height;
		} else {
			this.boundingRect.height = this.height;
		}
		this.layoutVersion = viewConfig.layoutVersion;
		if (this.parent === null) {
			if (this.next) {
				const nextSection = /**@type {EventSection} */(this.next);
				//TODO: How to identify call stack overflow?
				if (layoutStartTime > 0 && (Date.now() > (layoutStartTime + 5))) {
					let scheduledTimerId = window.requestAnimationFrame(() => {
						try {
							nextSection.scheduleLayout(viewConfig, viewStart, viewEnd, Date.now(), callback, deltaTime);
						} catch (e) {
							Log.error(e);
						}
					});
					deltaTime += (Date.now() - layoutStartTime);
					let cancellableObj = {
						cancel() {
							Log.info(`Timeline - Layout scheduler cancelled & time spent - ${deltaTime}`);
							window.cancelAnimationFrame(scheduledTimerId);
						}
					};
					if (typeof callback === 'function')
						callback(false, viewConfig.offsetY, cancellableObj);
					return cancellableObj;
				}
				if (typeof callback === 'function')
					callback(false, viewConfig.offsetY, null);
				try {
					return nextSection.scheduleLayout(viewConfig, viewStart, viewEnd, layoutStartTime, callback, deltaTime);
				} catch (e) {
					Log.error(e);
				}
			} else {
				Log.info(`Timeline - Layout time is - ${deltaTime}`);
			}
			if (typeof callback === 'function') {
				deltaTime += (Date.now() - layoutStartTime);
				callback(true, this.boundingRect.y + this.boundingRect.height, null);
			}
		}
	}
    /**
     *
     * @returns {TimelineEvent}
     */
	getFirstEvent() {
		if (this.isCollapsed)
			return null;
		for (let i = 0; i < this.collection.length; i++) {
			let thisItem = this.collection[i];
			if (thisItem instanceof EventSection) {
				let ev = thisItem.getFirstEvent();
				if (ev instanceof TimelineEvent)
					return ev;
			} else {
				let ev = thisItem.getFirstEvent();
				if (ev)
					return ev;
			}
		}
		return null;
	}
	getLastEvent() {
		if (this.isCollapsed)
			return null;
		for (let i = this.collection.length - 1; i >= 0; i--) {
			let thisItem = this.collection[i];
			if (thisItem instanceof EventSection) {
				let ev = thisItem.getLastEvent();
				if (ev instanceof TimelineEvent)
					return ev;
			} else {
				let ev = thisItem.getLastEvent();
				if (ev)
					return ev;
			}
		}
		return null;
	}
	/**
	 * 
	 * @param {import('../../..').TimelineConfig} viewConfig 
	 */
	getHeaderHeight(viewConfig) {
		if (!this.showHeader)
			return 0;
		return viewConfig.sectionHeaderHeight > 0 ?  viewConfig.sectionHeaderHeight:  DEFAULT_HEADER_HEIGHT;
	}
	/**
	 * 
	 * @param {import('../../..').TimelineConfig} viewConfig 
	 */
	getEventsHeight(viewConfig) {
		return this.height - this.getHeaderHeight(viewConfig);
	}
	getParentId() {
		return TimelineUtils.getId(this.id);
	}
    /**
     *
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderTitleSection(viewConfig, state, dispatch) {
		const { properties: props } = state;
		const headKey = `section_head_key_${this.getParentId()}`;
		const childContainerKey = `section_child_container_${this.getParentId()}`;
		const sectionHeadAttrs = {
			section_id: this.getParentId(),
			key: headKey,
			y: this.y,
			height: this.getHeaderHeight(viewConfig),
			tabindex: '-1'
		};

		const childContainerStyle = {
			height: this.height + 'px'
		};

		const childContainerAttrs = { ...sectionHeadAttrs };
		childContainerAttrs.key = childContainerKey;
		childContainerAttrs.height = this.getEventsHeight(viewConfig);
		let sectionHeadStyle = {
			backgroundColor: this.bgColor,
			color: this.color,
			height: this.getHeaderHeight(viewConfig) + 'px',
			lineHeight: this.getHeaderHeight(viewConfig) + 'px'
		};
		let titleHeadJSX = /**@type {JSX.Element} */(null);
		let titleBodyJSX = /** @type {JSX.Element}*/(null);
		let childBodyJSX = [];
		for (let i = 0; i < this.collection.length; i++) {
			if (state.timelineViewPort.isCompletelyAbove(this.collection[i].boundingRect))
				continue;
			if (state.timelineViewPort.isComletelyBelow(this.collection[i].boundingRect))
				break;
			childBodyJSX.push(this.collection[i].renderTitleSection(viewConfig, state, dispatch));
		}
		if (this.showHeader) {
			titleHeadJSX = (<div key={headKey}
				className="event-row-section-head clickable section-collapser"
				attrs={sectionHeadAttrs}
				id={TimelineUtils.getSectionTitleId(this.id)}
				style={sectionHeadStyle}>
				{props.timelineTemplateRenderer.renderSectionHeader(viewConfig, state.properties, this)}
			</div>);
		}
		if (!this.isCollapsed) {
			titleBodyJSX = (<div key={childContainerKey} className="child-section-container show"
				attrs={childContainerAttrs}
				style={childContainerStyle}>
				{childBodyJSX}
			</div>);
		}
		let containerStyle = {
			position: 'absolute',
			top: `${this.y}px`,
			width: `${viewConfig.titleWidth}px`,
			height: `${this.height}px`
		};
		const attrs = {
			key: `section_title_container_${this.getParentId()}`,
			title: this.title,
			section_id: `${this.getParentId()}`
		};
		return (
			<div className="section-title-container" style={containerStyle} key={attrs.key} attrs={attrs}>
				{titleHeadJSX}
				{titleBodyJSX}
			</div>
		);
	}

	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	renderEventSectionHead(viewConfig, state, dispatch) {
		if (!this.showHeader)
			return [];
		const key = 'event_section_head' + this.getParentId();
		const attrs = {
			section_id: this.id
		};
		const style = {
			height: this.getHeaderHeight(viewConfig) + 'px'
		}
		return (
			<div style={style} key={key} className="event-row-section-head clickable section-collapser" attrs={attrs}>
				{state.properties.timelineTemplateRenderer.renderEventSectionHeader(viewConfig, state.properties, this)}
			</div>
		);
	}

	/**
     * @param {import('../../..').TimelineConfig} viewConfig
     * @param {import('../../..').CalendarState} state
     * @param {import('../../..').appDispatch} dispatch
     */
	render(viewConfig, state, dispatch) {
		if (this.layoutVersion !== state.timelineView.layoutVersion)
			return;
		if (this.parent != null) {
			const parentSection = /** @type {EventSection}*/(this.parent);
			if (parentSection.isCollapsed)
				return;
		}
		const timelineViewPort = state.timelineViewPort;
		const sectionContaienrAttrs = { section_id: this.getParentId() };
		const parentContainerStyle = {
			position: 'absolute',
			left: this.x + 'px',
			top: this.y + 'px',
			width: '100%',
			height: this.height + 'px'
		};
		const containerHeight = !this.isCollapsed ? this.getEventsHeight(viewConfig) : (this.showHeader ? this.getHeaderHeight(viewConfig) : 0);
		const sectionContainerStyle = {
			position: 'absolute',
			top: '0px',
			height: `${containerHeight}px`
		};
		let jsx = [];
		if (!this.isCollapsed) {
			for (let i = 0; i < this.collection.length; i++) {
				const thisBoundingRect = this.collection[i].boundingRect;
				if (timelineViewPort.isCompletelyAbove(thisBoundingRect))
					continue;
				if (timelineViewPort.isComletelyBelow(thisBoundingRect))
					break;
				jsx.push(this.collection[i].render(viewConfig, state, dispatch));
			}
		}
		return (
			<div key={'event_section_' + this.id } style={parentContainerStyle} attrs={{ id: 'event_section_' + this.id }}>
				<div attrs={sectionContaienrAttrs} className="child-section-container show" style={sectionContainerStyle}>
					{jsx}
				</div>
				{this.renderEventSectionHead(viewConfig, state, dispatch)}
			</div>
		);
	}
}

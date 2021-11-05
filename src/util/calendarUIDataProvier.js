/// @ts-check
import { CalendarEvent } from "./calendarEvent";

export class CalendarUIDataProvider {

	constructor() {
		this.isEventsDirty = true;
		this.initializeSectionStore();
	}
	initializeSectionStore() {
		/**
		 * @type {Array<import("../..").RawSectionItem>}
		 */
		this.sections = [];
		/**
		 * @type {Map<string, import("../..").RawSectionItem>}
		 */
		this.sectionMap = new Map();
	}
	/**
	 * @param {import("../..").RawSectionItem} newSection
	 */
	addSection(newSection) {
		this.sections.push(newSection);
		this.sectionMap.set(newSection.id, newSection);
	}
	/**
	 * @param {import("../..").RawSectionItem} newSection
	 */
	modifySection(newSection) {
		let existingSection = this.sections.find( (thisSection) => {
			return thisSection.id === newSection.id;
		});
		if(existingSection)
			Object.assign(existingSection, newSection);
	}
	/**
	 * 
	 * @param {Array<import("../..").RawSectionItem>} newSections 
	 */
	addSections(newSections) {
		this.sections = this.sections.concat(newSections);
		for(let i = 0; i < newSections.length; i++)
			this.sectionMap.set(newSections[i].id, newSections[i]);
	}
	/**
	 * @param {string} id
	 */
	removeSectionById(id) {
		let index = this.sections.findIndex( (section) => {
			return section.id === id;
		});
		if(index !== -1) {
			this.sections.splice(index, 1);
			this.sectionMap.delete(id);
		}
	}
	getSections() {
		return this.sections;
	}
	initiateEventStore() {
		/**
		 * @type {Map<string, CalendarEvent>}
		 */
		this.eventStore = new Map();
		/**
		 * @type {Array<CalendarEvent>}
		 */
		this.allEvents = null;
		this.isEventsDirty = true;
	}

	/**
	 *
	 * @param {CalendarEvent} event
	 */
	addEvent(event) {
		if(!event)
			return;
		this.isEventsDirty = true;
		this.eventStore.set(event.id, event);
	}
	/**
	 * 
	 * @param {CalendarEvent} event 
	 */
	modifyEvent(event) {
		if(!event)
			return;
		this.eventStore.set(event.id, event);
	}

	/**
	 *
	 * @param {string} id
	 */
	removeEventById(id) {
		this.isEventsDirty = true;
		this.eventStore.delete(id);
	}

	/**
	 *
	 * @param {string} id
	 */
	getEventById(id) {
		return this.eventStore.get(id);
	}

	/**
	 *
	 * @return {Array<CalendarEvent>}
	 */
	getAllEvents() {
		if (!this.isEventsDirty)
			return this.allEvents;
		this.allEvents = [];
		this.eventStore.forEach((event) => {
			this.allEvents.push(event);
		});
		this.allEvents = this.allEvents.sort((a, b) => a.startMS - b.startMS);
		this.isEventsDirty = false;
		return this.allEvents;
	}

	/**
	 *
	 * @return {Array<CalendarEvent>}
	 * @param {number} startMS
	 * @param {number} endMS
	 */
	getEventsBetween(startMS, endMS) {
		return this.getAllEvents().filter((e) => {
			return !(e.startMS > endMS || e.endMS < startMS || e.endMS === startMS);
		});
	}
}

import { TYPES, VIEWS, KEYS } from '../constants';
import { getAvailableViewsList } from '../util';
import { t } from 'sn-translate';
import '../now-calendar.scss';

let shortCuts = [];
const SECTIONS = {
	GENERAL: 'General',
	CALENDAR: 'Calendar',
	VIEWS: 'Views'
};
const ARROW_LEFT = <now-icon icon='arrow-left-fill' size='sm'/>;
const ARROW_UP = <now-icon icon='arrow-up-fill' size='sm'/>;
const ARROW_RIGHT = <now-icon icon='arrow-right-fill' size='sm'/>;
const ARROW_DOWN = <now-icon icon='arrow-down-fill' size='sm'/>;

const KEYS_MAP = [
	{
		id: SECTIONS.GENERAL,
		name: t('General'),
		keys:
				[
					{name: t('/'), description: t('Toggle settings panel')},
					{name: t('F'), description: t('Put focus on Calendar')},
					{name: t('ESC'), description: t('Close popover')},
					{name: t('Enter'), description: t('Click')}
				]
	},
	{
		id: SECTIONS.CALENDAR,
		name: t('Calendar'),
		keys:
				[
					{name: t('T'), description: t('Move to today date')},
					{name: t('P'), description: t('Move to previous time range')},
					{name: t('N'), description: t('Move to next time range')},
					{ariaLabel: t("Use arrow keys to move within timeslot/calendar"), name: <span aria-label='Arrow keys'>{ARROW_LEFT} {ARROW_UP} {ARROW_DOWN} {ARROW_RIGHT}</span>, description: t('Move within timeslot/Calendar')},
					{name: t('E'), description: t('Select next event')},
					{name: t('Shift + E'), description: t('Select previous event')},
					{name: t('D'), description: t('Select next date')},
					{name: t('Shift + D'), description: t('Select previous date')}
				]
	}
];

export function addShortcut(eventName, selector, keyCode, view) {
	var shortCut = {};
	shortCut.focusCounter = -1;
	shortCut.eventName = eventName;
	shortCut.selector = selector;
	shortCut.keyCode = keyCode;
	shortCut.view = view;
	shortCuts.push(shortCut);
}

export function resetShortCutsFocusCounter() {
	shortCuts.forEach(function(shortCut) {
		shortCut.focusCounter = -1;
	});
}

export function getShortcutDefinition(event, calendarView) {
	var shortCut;
	for (var i = 0; i < shortCuts.length; i++) {
		var shortCutDefinition = shortCuts[i];
		if (shortCutDefinition.keyCode === event.which) {
			if (shortCutDefinition.view) {
				if (shortCutDefinition.view === calendarView) {
					shortCut = shortCutDefinition;
					break;
				}
			} else {
				shortCut = shortCutDefinition;
			}
		}
	}
	return shortCut;
}

export function processKeyDownEvent(event, calendarView, state, dispatch) {
	if(state.properties.currentView === VIEWS.TIMELINE_DAY || state.properties.currentView === VIEWS.TIMELINE_WEEK) {
		if(event.keyCode === KEYS.E)
			return;
	}
	var shortCut = getShortcutDefinition(event, calendarView);
	if (shortCut) {
		var selectorElements = event.currentTarget.querySelectorAll(shortCut.selector);
		if (event.shiftKey) {
			shortCut.focusCounter--;
			if (shortCut.focusCounter <= -1) {
				shortCut.focusCounter = selectorElements.length - 1;
			}
		} else {
			if (shortCut.focusCounter == -1 && event.target.classList.contains(shortCut.selector.substr(1))) {
				shortCut.focusCounter++;
			}
			shortCut.focusCounter++;
			if (shortCut.focusCounter === selectorElements.length) {
				shortCut.focusCounter = 0;
			}
		}
		const element = selectorElements[shortCut.focusCounter];
		if (element)
			element.focus();
	}
}

export function renderKeyboardShortcuts(state, dispatch) {
	if (!state.showKeyBoardShortCuts)
		return;
	const keyboardShortcutsRegion = t('Keyboard Shortcuts');
	return (<div className='shortcuts-container'>
		<div className='content' role="region" aria-label={keyboardShortcutsRegion}>
			<div className='title' role="heading" aria-level="3">{keyboardShortcutsRegion}</div>
			{renderSections(state, dispatch)}
		</div>
	</div>
	);
}

function renderSections(state, dispatch) {
	let keyShortcuts = KEYS_MAP;
	let sections = [];

	// Process view specific shortcuts
	if (!_.find(keyShortcuts, ['id', SECTIONS.VIEWS])) {
		const viewSection = getViewShortcuts(state);
		if (viewSection)
			keyShortcuts.push(viewSection);

		//Process user provided calendar shortcuts
		let customShortcuts = getHotKeyShortCuts(state);
		if (customShortcuts && customShortcuts.length > 0)
			_.find(keyShortcuts, ['id', SECTIONS.CALENDAR]).keys.push(...customShortcuts);

		const timelineViews = state.properties.availableViews;
		if (_.find(timelineViews, (v) => (v.view === VIEWS.TIMELINE_DAY || v.view === VIEWS.TIMELINE_WEEK))) {
			const timelineKeys = [
				{name: t('S'), description: t('Select next timeline section or row')},
				{name: t('Shift + S'), description: t('Select previous timeline section or row')}
			];
			_.find(keyShortcuts, ['id', SECTIONS.CALENDAR]).keys.push(...timelineKeys);
		}
	}
	keyShortcuts.forEach((section, index) => {
		const ariaLabel = t("{0} Keyboard shortcuts", section.name);
		sections.push(	<div className='section'>
			<div className='section-title keyboard-focus' aria-label={ariaLabel} role="heading" aria-level="4"> { section.name } </div>
			<div className='table' role="list" aria-label={ariaLabel}> {renderKeysInfo(section)} </div>
		</div>);
		if (index < KEYS_MAP.length - 1)
			sections.push(<hr/>);
	});
	return sections;
}

function renderKeysInfo(section) {
	if (!section.keys)
		return null;
	let keys = [];
	section.keys.forEach((k) => {
		let ariaLabel = '';
		if(section.id !== 'Views')
			ariaLabel = k.ariaLabel? k.ariaLabel: t("Press '{0}' key to , {1}", k.name, k.description);
		else
			ariaLabel = t("Press '{0}' to navigate to {1} view", k.name, k.description);
		keys.push(
			<div className='row keyboard-focus' aria-label={ariaLabel} role="listitem">
				<div className='key' role="presentation">
					{ k.name }
				</div>
				<div className='description' role="presentation">
					{ k.description }
				</div>
			</div>
		);
	});
	return keys;
}

export function getViewShortcuts(state) {
	let viewSection = {};
	viewSection.id = SECTIONS.VIEWS;
	viewSection.name = t('Views');
	viewSection.keys = [];
	let views = getAvailableViewsList(state);
	if (!views)
		return [];
	let k = 1;
	for (const view in views) {
		if (views[view].children)
			views[view].children.forEach((v) => {
				viewSection.keys.push({
					name: v.key ? v.key.toUpperCase() : k + '',
					description: v.label + (view === TYPES.TIMELINE ? ' (' + TYPES.TIMELINE + ')' : ''),
					view_id: v.id
				});
				k++;
			});
	}
	return viewSection;
}

export function getHotKeyShortCuts(state) {
	const {properties:props} = state;
	let shortcuts = [];
	if (props.hotkeys) {
		props.hotkeys.forEach((v) => {
			if (v.name && v.info) {
				if (v.info.next && v.info.next.keyName && v.info.next.description)
					shortcuts.push({name: v.info.next.keyName, description: v.info.next.description});

				if (v.info.previous && v.info.previous.keyName && v.info.previous.description)
					shortcuts.push({name: v.info.previous.keyName, description: v.info.previous.description});
			}
		});
	}
	return shortcuts;
}

export function isValidKeyEvent(event) {
	const nodeList = event.path || (event.composedPath && event.composedPath());
	if (Array.isArray(nodeList) && nodeList.length > 0) {
		const target = nodeList[0];
		if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
			if (target instanceof HTMLInputElement) {
				const type = target.getAttribute('type');
				return !(type === 'text' || type == 'password');
			}
			return false;
		}
	}
	const filterTags = ['INPUT', 'TEXTAREA'];
	return (filterTags.indexOf(event.target.tagName.toUpperCase()) == -1);
}

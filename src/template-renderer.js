export default class TemplateRenderer {
	constructor() {
	}

	eventContainer(event, props) {
		return <div className="event-container">
			<div className="event-text">{event.title}</div>
		</div>;
	}
}
const NOW_CALENDAR_NAMESPACE = Symbol.for("__NOW__CALENDAR_PRIVATE_NAMESPACE");

if(!window[NOW_CALENDAR_NAMESPACE]) {
	Object.defineProperty(window, NOW_CALENDAR_NAMESPACE, {
		configurable: true,
		enumerable: true,
		writable: false,
		value: {}
	});
}
const nowCalendar = window[NOW_CALENDAR_NAMESPACE];
/**
 * @type {Map<string, Map<string, TemplateRenderer | string>>}
 */
const templateRegistry = nowCalendar.templateRegistry = nowCalendar.templateRegistry || new Map();
/**
 * 
 * @param {string} viewName 
 * @param {string} templateName 
 * @param { TemplateRenderer | string } value 
 */
export function registerTemplateRenderer(viewName, templateName, value) {
	/**
	 * @type {Map<string, TemplateRenderer>}
	 */
	let templateRendererMap = templateRegistry.get(viewName);
	if(!templateRendererMap) {
		templateRendererMap = new Map();
		templateRegistry.set(viewName, templateRendererMap);
	}
	templateRendererMap.set(templateName, value);
}
/**
 * 
 * @param {string} viewName
 * @param {string} templateName
 */
export function getTemplateRenderer(viewName, templateName) {
	const templateRendermap = templateRegistry.get(viewName);
	if(!templateRendermap)
		return null;
	return templateRendermap.get(templateName) ;
}
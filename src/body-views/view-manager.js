import { addShortcut } from '../util/keyboardAccessibility';
import TemplateRenderer from '../template-renderer';
export const ViewActionHandlers = {};
export const ViewRenderers = {};
export const ViewStyles = [];

export function registerViewRenderer(viewName, viewLabel, {
	actionHandlers={},
	keyHandlers={},
	styles=[],
	viewRenderer: {renderer, fixedParams = {}, defaultParams = {}, templateRenderer = TemplateRenderer}
}, type) {
	ViewRenderers[viewName] = {
		renderer: renderer,
		viewLabel,
		fixedParams,
		defaultParams,
		templateRenderer,
		keyHandlers,
		type: type
	};
	ViewActionHandlers[viewName] = actionHandlers;
	styles.forEach(s => {
		if (ViewStyles.indexOf(s) < 0)
			ViewStyles.push(s);
	});
	registerKeys(keyHandlers, viewName);
}

export function registerKeys(keyHandlers, viewName) {
	if (typeof keyHandlers.getViewKeys == 'function') {
		const keys = keyHandlers.getViewKeys();
		keys.forEach((key) => {
			addShortcut(key.eventName, key.selector, key.keyCode, viewName);
		});
	}
}

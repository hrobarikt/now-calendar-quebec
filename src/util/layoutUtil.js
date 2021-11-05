import { DIRECTION } from '../constants';
import { Log } from './devUtil';
import { ACTIONS, KEYS, GRADIENT } from '../constants';
import unescape from 'lodash/unescape';

const styleMap = {
	[DIRECTION.RTL]: {
		'start': 'right',
		'nextSibling': 'previousSibling',
		'previousSibling': 'nextSibling',
		'firstChild': 'lastChild',
		'lastChild': 'firstChild',
		[DIRECTION.LEFT]: DIRECTION.RIGHT,
		[DIRECTION.RIGHT]: DIRECTION.LEFT,
		'startArrowIcon': 'chevron-right-fill',
		'endArrowIcon': 'chevron-left-fill',
		'prevNav': 'chevron-right-outline',
		'nextNav': 'chevron-left-outline'
	},
	[DIRECTION.LTR]: {
		'start': 'left',
		'nextSibling': 'nextSibling',
		'previousSibling': 'previousSibling',
		'firstChild': 'firstChild',
		'lastChild': 'lastChild',
		[DIRECTION.LEFT]: DIRECTION.LEFT,
		[DIRECTION.RIGHT]: DIRECTION.RIGHT,
		'startArrowIcon': 'chevron-left-fill',
		'endArrowIcon': 'chevron-right-fill',
		'prevNav': 'chevron-left-outline',
		'nextNav': 'chevron-right-outline'
	}
};

export function updateTooltip(dispatch, ref, id, content) {
	dispatch.updateState({
		tooltip: {
			ref,
			id,
			content
		}
	});
}

export function getDirProperty(styleProp, state) {
	let map = styleMap[state.properties.dir ? state.properties.dir : DIRECTION.LTR];
	return map[styleProp];
}

export function getRtlMap(state) {
	let rtlMap = {};
	for (const prop in styleMap[DIRECTION.LTR])
		rtlMap[prop] = getDirProperty(prop, state);

	return rtlMap;
}

function getInvertedColor(r, g, b) {
	r = 255 - r;
	g = 255 - g;
	b = 255 - b;

	let luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b)
	return luminance < 140 ? '#000000' : '#ffffff';
}

function getDarkenColor(r, g, b) {
	r = (r - 46).toString(16);
	g = (g - 24).toString(16);
	b = (b - 17).toString(16);
	// pad each with zeros and return
	return '#' + padZero(r) + padZero(g) + padZero(b);
}

function getRGBArray(bgColor) {
	let rgb = bgColor.replace(/[^\d,]/g, '').split(',');
	return rgb.map((c) => parseInt(c));
}

export function invertColor(hex) {
	if (hex.indexOf('#') === 0) {
		hex = hex.slice(1);
	}
	// convert 3-digit hex to 6-digits.
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	if (hex.length !== 6) {
		Log.error('Invalid HEX color.');
	}

	return getInvertedColor(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
}

export function darkerColor(hex) {
	if (hex.indexOf('#') === 0) {
		hex = hex.slice(1);
	}
	// convert 3-digit hex to 6-digits.
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	if (hex.length !== 6) {
		Log.error('Invalid HEX color.');
	}
	// invert color components
	var r = parseInt(hex.slice(0, 2), 16),
		g = parseInt(hex.slice(2, 4), 16),
		b = parseInt(hex.slice(4, 6), 16);
	// pad each with zeros and return
	return getDarkenColor(r, g, b);
}


function padZero(str, len) {
	len = len || 2;
	var zeros = new Array(len).join('0');
	return (zeros + str).slice(-len);
}

/** Create dummy hidden element for popover target */
export function createPopoverTarget(parent, position) {
	let el = document.createElement('div');
	el.setAttribute('id', 'popover_ref');
	el.style.visibility = 'hidden';
	el.style.position = 'fixed';
	el.style.left = position.left + 'px';
	el.style.top = position.top + 'px';
	parent.appendChild(el);

	return el;
}

/** Delete dummy element created for popover target if any */
export function deletePopoverTarget(state) {
	if (state.popOvers.event)
		if (state.popOvers.event.targetRef)
			if (state.popOvers.event.targetRef.parentNode)
				state.popOvers.event.targetRef.parentNode.removeChild(state.popOvers.event.targetRef);
}

export function updateContainerHeight(state, dispatch, $containerElm, $baseContainerElm) {
	const { calendarCoreRef } = state;
	let calendarCoreBounds = calendarCoreRef.current.getBoundingClientRect();
	let containerBounds = $containerElm.getBoundingClientRect();
	let remainingHeight = calendarCoreBounds.top + calendarCoreBounds.height - containerBounds.top;
	if ($baseContainerElm) { // remove bottom padding or margins
		let baseContainerBounds = $baseContainerElm.getBoundingClientRect();
		remainingHeight = remainingHeight - (baseContainerBounds.bottom - containerBounds.bottom);
	}
	$containerElm.style.height = remainingHeight + 'px';
}


export function getNodeIndex(el) {
	let i = 0;
	while ((el = el.previousSibling))
		i++;
	return i;
}

export function isModifierKeyPressed(event, filterKeys) {
	let keys = _.values(KEYS.MODIFIER);
	if (filterKeys && filterKeys.length > 0)
		keys = keys.filter((k) => filterKeys.indexOf(k) == -1);

	return keys.some((k) => event[k]);
}

function getScrollbarWidth() {

	// Creating invisible container
	const outer = document.createElement('div');
	outer.style.visibility = 'hidden';
	outer.style.overflow = 'scroll'; // forcing scrollbar to appear
	outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
	document.body.appendChild(outer);

	// Creating inner element and placing it in the container
	const inner = document.createElement('div');
	outer.appendChild(inner);

	// Calculating difference between container's full width and the child width
	const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

	// Removing temporary elements from the DOM
	outer.parentNode.removeChild(outer);

	return scrollbarWidth;

}

export const SCROLL_BAR_WIDTH = getScrollbarWidth();

export function getGradientBackground(gradientColor1 = '#ccc', gradientColor2 = '#fff', gradientWidth = 4) {
	return 'repeating-linear-gradient(' +
		'-55deg,\n' +
		gradientColor1 + ',' +
		gradientColor1 + ' ' + gradientWidth + 'px,' +
		gradientColor2 + ' ' + gradientWidth + 'px,' +
		gradientColor2 + ' ' + 2 * gradientWidth + 'px)';
}

export function getMarkSpanStyles(markSpan) {
	let style = {};
	style.color = markSpan.textColor;
	if (markSpan.bgColor)
		style.backgroundColor = markSpan.bgColor;
	else if (markSpan.gradientColor1 && markSpan.gradientColor2)
		style.background = getGradientBackground(markSpan.gradientColor1, markSpan.gradientColor2, markSpan.gradientWidth);
	return style;
}

export function isNotToolTipEvent(event) {
	const path = event.path || (event.composedPath && event.composedPath());
	return path[0].closest('.now-tooltip') === null;
}
export function isNDSColor(color) {
	if (color && color.indexOf('nds') > -1 && color.indexOf('#') === -1)
		return true;
	return false;
}

const subtractLight = function (color, amount) {
	let cc = parseInt(color, 16) - amount;
	let c = (cc < 0) ? 0 : (cc);
	c = (c.toString(16).length > 1) ? c.toString(16) : `0${c.toString(16)}`;
	return c;
}

export const darken = (color, amount) => {
	color = (color.indexOf("#") >= 0) ? color.substring(1, color.length) : color;
	amount = parseInt((255 * amount) / 100);
	return color = `#${subtractLight(color.substring(0, 2), amount)}${subtractLight(color.substring(2, 4), amount)}${subtractLight(color.substring(4, 6), amount)}`;
}

const addLight = function(color, amount){
	let cc = parseInt(color,16) + amount;
	let c = (cc > 255) ? 255 : (cc);
	c = (c.toString(16).length > 1 ) ? c.toString(16) : `0${c.toString(16)}`;
	return c;
}

export const lighten = (color, amount)=> {
	if (color && colourNameToHex(color))
		color = colourNameToHex(color);
	let r, g, b;
	if (!isValidHexColor(color) && !isValidRgbColor(color))
		return '';

	if(isValidHexColor(color)) {
		color = (color.indexOf("#")>=0) ? color.substring(1,color.length) : color;
		r = color.substring(0, 2);
		g = color.substring(2, 4);
		b = color.substring(4, 6);
	} else {
		let rgb = getRGBArray(color);
		r = rgb[0];
		g = rgb[1];
		b = rgb[2];
	}

	amount = parseInt((255*amount)/100);
	color = `#${addLight(r, amount)}${addLight(g, amount)}${addLight(b, amount)}`
	return color;
  }

export function isValidHexColor(bgColor) {
	let regex = /^#([0-9A-F]{3}){1,2}$/i
	return bgColor.indexOf('#') !== -1 && regex.test(bgColor)
}

export function isValidRgbColor (bgColor) {
	bgColor = bgColor.replace(/ /g, '');
	let regex = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/;
	return regex.test(bgColor);
}

export function colourNameToHex(colour)
{
    var colours = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
    "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
    "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
    "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
    "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
    "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
    "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
    "honeydew":"#f0fff0","hotpink":"#ff69b4",
    "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
    "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
    "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
    "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
    "navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
    "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
    "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
    "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
    "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
    "violet":"#ee82ee",
    "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
    "yellow":"#ffff00","yellowgreen":"#9acd32"};

    if (typeof colours[colour.toLowerCase()] != 'undefined')
        return colours[colour.toLowerCase()];

    return false;
}

export function getTextColor (textColor, bgColor) {
	if (!textColor && bgColor && !isNDSColor(bgColor)) {
		if (colourNameToHex(bgColor))
			return invertColor(colourNameToHex(bgColor));
		else if (isValidHexColor(bgColor))
			return invertColor(bgColor);
		else if(isValidRgbColor(bgColor)) {
			let rgb = getRGBArray(bgColor);
			return getInvertedColor(rgb[0], rgb[1], rgb[2]);
		}
	}
	else if (textColor)
		return textColor;
}

export function getBorderColor (borderColor, bgColor) {
	if (!borderColor && bgColor && !isNDSColor(bgColor)) {
		if (colourNameToHex(bgColor))
			return darkerColor(colourNameToHex(bgColor));
		else if (isValidHexColor(bgColor))
			return darkerColor(bgColor);
		else if (isValidRgbColor(bgColor)) {
			let rgb = getRGBArray(bgColor);
			return getDarkenColor(rgb[0], rgb[1], rgb[2]);
		}
	}
	else if (borderColor)
		return borderColor;
}

export function getBgColor (bgColor, gradientColor1, gradientColor2) {
	if (gradientColor1 && gradientColor2) {
		return 'repeating-linear-gradient(' + parseInt(GRADIENT.ANGLE) + 'deg, '
		+ gradientColor1 + ', '
		+ gradientColor1 + ' ' + parseInt(GRADIENT.LINE_WIDTH) + 'px, '
		+ gradientColor2 + ' ' + parseInt(GRADIENT.LINE_WIDTH) + 'px, '
		+ gradientColor1 + ' ' + 2*parseInt(GRADIENT.LINE_WIDTH) + 'px)';
	} else if (bgColor && !isNDSColor(bgColor))
		if (colourNameToHex(bgColor))
			return colourNameToHex(bgColor);
		else return bgColor;
}

export function isCustomColor (bgColor, gradientColor1, gradientColor2) {
	if (bgColor && (isValidHexColor(bgColor) || colourNameToHex(bgColor) || isValidRgbColor(bgColor)))
		return true;
	if (gradientColor1 && gradientColor2)
		return true;
	return false;
}

export function getArrowHTML(state, position) {
	if ((state.properties.dir === DIRECTION.LTR && position === 'start')
		|| (state.properties.dir === DIRECTION.RTL && position === 'end'))
		return <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" attrs={{viewBox: "0 0 16 16"}}
					style={{width: '1rem', height: '1rem'}}>
			<g attrs={{stroke: "none", fill: "none"}}>
				<path attrs={{
					d: "M5.954 8.004l5.147 5.147-.707.707L4.54 8.004l5.854-5.853.707.707z",
					fill: "currentColor"
				}}/>
			</g>
		</svg>;
	else
		return <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" attrs={{viewBox: "0 0 16 16"}}
					style={{width: '1rem', height: '1rem'}}>
			<g attrs={{stroke: "none", fill: "none"}}>
				<path attrs={{
					d: "M10.046 8.004L4.899 2.857l.707-.707 5.854 5.854-5.854 5.853-.707-.707z",
					fill: "currentColor"
				}}/>
			</g>
		</svg>

}

export function sanitizeHTML(str) {
    if (!str || typeof str !== 'string')
        return '';
    return unescape(str);
};

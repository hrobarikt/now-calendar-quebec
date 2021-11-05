import {COL_EVENT_CONSTANTS} from './util';
import { KEYS } from '../../constants';
import {isCreateAllowed} from '../../util';

export function getColumn(state, extraClassName, clsAndStyleObj, onClickGridCell, ariaLabel) {
	const cls = ['item'];
	if (clsAndStyleObj)
		cls.push(clsAndStyleObj.className);
	return <div style={clsAndStyleObj.style} className={cls.join(' ')} on-click={(e) => { if (onClickGridCell) onClickGridCell(e);}}
		attrs={!isCreateAllowed(state) ? {} : { tabindex: '-1' }}
		on-keypress={(e) => { e.which === KEYS.ENTER && onClickGridCell ? onClickGridCell(e) : null; }}
		aria-label={ariaLabel}
	>
		<span className={extraClassName}/>
	</div>;
}

export function getColumns(state, totalDayCols, getExtraClassName, getExtraClassName2 /*optional*/, getOnClickGridCell /*optional*/, getAriaLabelValue) {
	const cols = [];
	let clsAndStyleObj = {className: '', style: {}}, extraClassName;
	let onClickGridCell, onClickGridCellText;
	let ariaLabel = '';
	for (let c = 0; c < totalDayCols; c++) {
		if (getExtraClassName2)
			clsAndStyleObj = getExtraClassName2(c);
		if (getOnClickGridCell)
			onClickGridCell = getOnClickGridCell(c);
		if (getExtraClassName)
			extraClassName = getExtraClassName(c);
		if (getAriaLabelValue) {
			ariaLabel = getAriaLabelValue(c);
		}
		cols.push(getColumn(state, extraClassName, clsAndStyleObj, onClickGridCell, ariaLabel));
	}
	return cols;
}

export function onViewRender(columnViewEl) {
	if (columnViewEl) {
		columnViewEl.querySelectorAll('.' + COL_EVENT_CONSTANTS.TEMPORARY_EVENT).forEach(el => el.remove());
	}
}

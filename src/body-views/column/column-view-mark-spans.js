import _ from 'lodash';
import {getDirProperty, getMarkSpanStyles, getMarkSpanById, getTimeFromStartOfDay} from '../../util';
import moment from 'moment-timezone';


function getSpanStyles(markSpan, chunkEvent, state) {
	let style = getMarkSpanStyles(markSpan);
	style[getDirProperty('start', state)] = chunkEvent.style.xPos;
	style.top = chunkEvent.style.top;
	style.width = chunkEvent.style.width;
	style.height = chunkEvent.style.height;
	return style;
}


function getMarkSpanHtml(state, dispatch, chunkEvent) {
	const cls = ['mark-span'];
	if (chunkEvent.chunkId)
		cls.push('chunked');
	let markSpan = getMarkSpanById(state, chunkEvent.$$mid);
	if (markSpan.block)
		cls.push('block');

	const chuckStyles = getSpanStyles(markSpan, chunkEvent, state);

	return (<div className={cls.join(' ')}
				 style={chuckStyles}
				 attrs={{mid: chunkEvent.$$mid, chunkidx: chunkEvent.chunkId, tabindex: '-1'}}>
		<div className="mark-span-container">
			<div className="mark-span-title">
				{markSpan.title}
			</div>
		</div>
	</div>);
}

export function renderMarkSpanChunk(state, dispatch, markSpanChunk, viewSettings) {
	const {startMoment} = state;
	const {numberOfDays, scaleSizeInSecs} = viewSettings;

	const startSecs = getTimeFromStartOfDay(markSpanChunk.startMoment);
	const endSecs = getTimeFromStartOfDay(markSpanChunk.endMoment);
	const pos = moment(markSpanChunk.startMoment).startOf('day').diff(startMoment, 'days');
	markSpanChunk.style = {
		width: (100 / numberOfDays) + '%',
		top: (startSecs / scaleSizeInSecs * 100) + '%',
		height: ((endSecs - startSecs) / scaleSizeInSecs * 100) + '%',
		xPos: (pos / numberOfDays * 100) + '%'
	};

	return getMarkSpanHtml(state, dispatch, markSpanChunk);
}

export function renderColumnViewMarkSpans(viewSettings, state, dispatch) {
	if (state.markSpanChunks.length === 0)
		return '';

	const {markSpanChunks} = state;
	markSpanChunks.sort((e1, e2) => e1.startMoment - e2.startMoment);
	return _.flatten(state.markSpanChunks.map(markSpanChunk => renderMarkSpanChunk(state, dispatch, markSpanChunk, viewSettings))).filter(html => !!html);
}

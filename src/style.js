import {ViewStyles} from './body-views';
import styles from './now-calendar.scss';

export default {
	styles: [styles, ...ViewStyles].join(' ')
};

/// @ts-check
import moment from 'moment-timezone';

export class ChunkEvent {
	static chunkIndex = 0;

	constructor({startMS, endMS, eventId}, timezone = "GMT") {
		this.id = "chunk_" + ChunkEvent.chunkIndex++;
		this.eventId = eventId;
		if (startMS) {
			this.startMS = startMS;
		} else
			throw new Error('Invalid date format');

		this.startMoment = /**@type {moment.Moment} */(undefined);

		if (endMS) {
			this.endMS = endMS;
		} else
			throw new Error('Invalid date format');


		if (this.startMS > this.endMS)
			throw new Error('Chunk start date should be before end date');

		this.endMoment = /**@type {moment.Moment} */(undefined);
		this.timezone = timezone;
	}


	initializeMoment() {
		if (!this.startMoment)
			this.startMoment = moment.utc(this.startMS);
		if (!this.endMoment)
			this.endMoment = moment.utc(this.endMS);
		this.startMoment.tz(this.timezone);
		this.endMoment.tz(this.timezone);
	}

	uninitializeMoment() {
		this.startMoment = undefined;
		this.endMoment = undefined;
	}

	clone() {
		return new ChunkEvent({...this}, this.timezone);
	}
}

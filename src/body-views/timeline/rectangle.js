/// @ts-check

import {tryParse} from './utils';
export class Rectangle {
	/**
     * 
     * @param {number=} x 
     * @param {number=} y 
     * @param {number=} width 
     * @param {number=} height 
     */
	constructor(x, y, width, height) {
		/**
         * @type {number}
         */
		this.x = x;
		/**
         * @type {number}
         */
		this.y = y;
		/**
         * @type {number}
         */
		this.width = width;//tryParse(width);
		/**
         * @type {number}
         */
		this.height = height;//tryParse(height);
	}
	get X() {
		return this.x;
	}
	set X(newX) {
		this.x = tryParse(newX);
	}
	get Y() {
		return this.y;
	}
	set Y(newY) {
		this.y = tryParse(newY);
	}
	get Width() {
		return this.width;
	}
	set Width(newWidth) {
		this.width = tryParse(newWidth);
	}
	get Height() {
		return this.height;
	}
	set Height(newHeight) {
		this.height = tryParse(newHeight);
	}
	/**
     * 
     * @param {Rectangle} rect 
     */
	contains(rect) {
		rect = Rectangle.parse(rect);
		return rect.x >= this.x && rect.y >= this.y && (rect.x + rect.width <= (this.x + this.width)) && (rect.y + rect.height <= (this.y + this.height));
	}
	/**
     * 
     * @param {Rectangle} rect 
     */
	intersects(rect) {
		rect = Rectangle.parse(rect);
		return !((this.x + this.width) < rect.x || (rect.x + rect.width < this.x) || (this.y + this.height) < rect.y || (rect.y + rect.height) < this.y);
	}
	translate(deltaX = 0, deltaY = 0) {
		this.x += deltaX;
		this.y += deltaY;
	}
	resize(newWidth = 0, newHeight = 0) {
		this.width = newWidth;
		this.height = newHeight;
	}
	/**
     * 
     * @param {Rectangle | Array<number> | {x: number, y: number, width: number, height: number}} rect 
     */
	equals(rect) {
		rect = Rectangle.parse(rect);
		return (rect.x === this.x && rect.y === this.y && rect.width === this.width && rect.height === this.height);
	}
	/**
     * 
     * @param {Rectangle} rect 
     */
	copy(rect) {
		rect = Rectangle.parse(rect);
		this.x = rect.x;
		this.y = rect.y;
		this.width = rect.width;
		this.height = rect.height;
	}
	translateAndResize(deltaX = 0, deltaY = 0, newWidth = 0, newHeight = 0) {
		this.x += deltaX;
		this.y += deltaY;
		this.width = newWidth;
		this.height = newHeight;
	}
	/**
     *
     * @param {Rectangle} rect
     */
	isCompletelyAbove(rect) {
		rect = Rectangle.parse(rect);
		return ((rect.y + rect.height) < this.y);
	}
	/**
     *
     * @param {Rectangle} rect
     */
	isComletelyBelow(rect) {
		rect = Rectangle.parse(rect);
		return ((this.y + this.height) < rect.y);
	}
	/**
     *
     * @param {Rectangle} rect
     */
	isCompletelyLeft(rect) {
		return ((rect.x + rect.width) < this.x);
	}

	/**
     * @param {Rectangle} rect
     */
	isCompletelyRight(rect) {
		rect = Rectangle.parse(rect);
		return (rect.x > (this.x + this.width));
	}
	clone() {
		return new Rectangle(this.X, this.Y, this.Width, this.Height);
	}
	/**
     *
     * @param {Rectangle | string | Array<string|number> | {x?: number, y?: number, width?: number, height?: number}} rawData 
     */
	static parse(rawData) {
		if (rawData instanceof Rectangle)
			return rawData;
		if (!rawData)
			return new Rectangle();
		var ar = [0, 0, 0, 0];
		if (typeof rawData === 'string')
			rawData = rawData.split(',');

		if (Array.isArray(rawData)) {
			for (let i = 0; i < ar.length && i < rawData.length; i++)
				ar[i] = tryParse(ar[i]);
			return new Rectangle(ar[0], ar[1], ar[2], ar[3]);
		}
        if (rawData instanceof Object)
            return new Rectangle(rawData.x, rawData.y, rawData.width, rawData.height);
        return new Rectangle();
    }
    /**
     * 
     * @param {{x: number, y: number}} point 
     */
    isPointInside(point) {
        return point.x >= this.x && point.x <= (this.x + this.width) && point.y >= this.y && point.y <= (this.y + this.height);
    }
    toString() {
        return JSON.stringify(this);
	}
	toObjectFormat() {
		return { x: this.x, y: this.y, width: this.width, height: this.height };
	}
}

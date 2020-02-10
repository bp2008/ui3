/*

Queue.js

A function to represent a queue

Created by Stephen Morley - http://code.stephenmorley.org/ - and released under
the terms of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

replaceFront method added by bp2008, Sept 2017

other modifications made by bp2008

*/

/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
function Queue()
{
	// initialise the queue and offset
	var queue = [];
	var offset = 0;

	/**
	 * Returns the length of the queue.
	 * @returns {Number} the length of the queue
	 */
	this.getLength = function ()
	{
		return queue.length - offset;
	};

	/**
	 * Returns true if the queue is empty, and false otherwise.
	 * @returns {Boolean} true if the queue is empty
	 */
	this.isEmpty = function ()
	{
		return queue.length === offset;
	};

	/**
	 * Enqueues the specified item.
	 * @param {Any} item the item to enqueue
	 */
	this.enqueue = function (item)
	{
		queue.push(item);
	};

	/**
	 * Dequeues an item and returns it. If the queue is empty, the value 'undefined' is returned.
	 * @returns {Any} The item which was at the front of the queue, or 'undefined'.
	 */
	this.dequeue = function ()
	{

		// if the queue is empty, return immediately
		if (queue.length === 0) return undefined;

		// store the item at the front of the queue
		var item = queue[offset];

		// Remove the item from the queue so it can be garbage collected.
		queue[offset] = undefined;


		// increment the offset and remove the free space if necessary
		offset++;
		if (queue.length > 16 && offset * 2 >= queue.length)
		{
			queue = queue.slice(offset);
			offset = 0;
		}

		// return the dequeued item
		return item;

	};

	/**
	 * Returns the item at the front of the queue (without dequeuing it). If the queue is empty then undefined is returned.
	 * @returns {Any} The item which is at the front of the queue, or 'undefined'.
	 */
	this.peek = function ()
	{
		return queue.length === offset ? undefined : queue[offset];
	};

	/**
	 * Replaces the item at the front of the queue with a different item. If the queue is empty then this method behaves like [enqueue].
	 * @param {Any} newFront the item to put at the front of the queue
	 */
	this.replaceFront = function (newFront)
	{
		if (queue.length > 0)
			queue[offset] = newFront;
		else
			queue.push(newFront);
	};

	/**
	 * Returns an array containing all the items in the queue, in the order they would have been dequeued in.
	 * @returns {Array} Returns an array containing all the items in the queue, in the order they would have been dequeued in.
	 */
	this.toArray = function ()
	{
		var len = queue.length - offset;
		var arr = new Array(len);
		for (var i = offset, n = 0; i < queue.length; i++, n++)
			arr[n] = queue[i];
		return arr;
	};

	/**
	 * Returns the first item that causes the specified predicate to return true.
	 * @param {Function} where A function to which each item from the queue is passed. The function should return true when the desired item is passed in.
	 * @returns {Any} Returns the first item that causes the specified predicate to return true.
	 */
	this.find = function (where)
	{
		for (var i = offset; i < queue.length; i++)
			if (where(queue[i]))
				return queue[i];
		return undefined;
	};
}

/*

Queue.js

A function to represent a queue

Created by Stephen Morley - http://code.stephenmorley.org/ - and released under
the terms of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

replaceFront method added by bp2008, Sept 2017

*/

/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
function Queue()
{

	// initialise the queue and offset
	var queue = [];
	var offset = 0;

	// Returns the length of the queue.
	this.getLength = function ()
	{
		return (queue.length - offset);
	}

	// Returns true if the queue is empty, and false otherwise.
	this.isEmpty = function ()
	{
		return (queue.length == 0);
	}

	/* Enqueues the specified item. The parameter is:
	 *
	 * item - the item to enqueue
	 */
	this.enqueue = function (item)
	{
		queue.push(item);
	}

	/* Dequeues an item and returns it. If the queue is empty, the value
	 * 'undefined' is returned.
	 */
	this.dequeue = function ()
	{

		// if the queue is empty, return immediately
		if (queue.length == 0) return undefined;

		// store the item at the front of the queue
		var item = queue[offset];

		// increment the offset and remove the free space if necessary
		if (++offset * 2 >= queue.length)
		{
			queue = queue.slice(offset);
			offset = 0;
		}

		// return the dequeued item
		return item;

	}

	/* Returns the item at the front of the queue (without dequeuing it). If the
	 * queue is empty then undefined is returned.
	 */
	this.peek = function ()
	{
		return (queue.length > 0 ? queue[offset] : undefined);
	}

	/* Replaces the item at the front of the queue with a different item. If the
	 * queue is empty then this method behaves like [enqueue].
	 */
	this.replaceFront = function (newFront)
	{
		if (queue.length > 0)
			queue[offset] = newFront;
		else
			queue.push(newFront);
	}

	this.toArray = function ()
	{
		var len = (queue.length - offset);
		var arr = new Array(len);
		var n = 0;
		for (var i = offset; i < queue.length; i++)
			arr[n++] = queue[i];
		return arr;
	}
	this.find = function (where)
	{
		var len = (queue.length - offset);
		for (var i = 0, n = offset; i < len; i++ , n++)
		{
			if (n >= len)
				n = 0;
			if (where(queue[n]))
				return queue[n];
		}
	}

}

/**
	Constructor for BasicEventTimer which helps measure execution time of code.

	A class which makes it easy to time different parts of a procedure individually and later report the time in seconds taken for each part.  This class is NOT thread-safe.
	
	Example:
	
	BasicEventTimer timer = new BasicEventTimer();
	
	timer.Start("Event 1");
	timed_procedure_1();

	timer.Start("Event 2");
	timed_procedure_2();
	timer.Stop();
	
	untimed_procedure();
	
	timer.Start("Event 3");
	timed_procedure_3();
	timer.Stop();
	
	Console.WriteLine(timer.ToString(Environment.NewLine));
	
	Example output:
	0.01 - Procedure 1
	50.15 - Procedure 2
	1.51 - Procedure 3
	@param {Boolean} mergeSameEventTimes If true, multiple events with the same name will have their times added together into one record.  Useful when repeating a sequence of operations in a loop.
*/
function BasicEventTimer(mergeSameEventTimes)
{
	var self = this;
	var dict_events = {};
	var events = [];
	var currentEvent;

	/**
	 * Starts timing a new event, automatically stopping the previous event, if there was one. 
	 * 	@param {String} name Name of the event.
	 */
	this.start = function (name)
	{
		self.stop();
		if (typeof name === "undefined")
			name = "undefined";

		if (mergeSameEventTimes)
		{
			currentEvent = dict_events[name];
			if (currentEvent)
				currentEvent.watch.start();
			else
				events.push(currentEvent = dict_events[name] = new TimedEvent(name));
		}
		else
			events.push(currentEvent = dict_events[name] = new TimedEvent(name));
	}

	/** Stops time measurement for the previously started event, if there was one. */
	this.stop = function ()
	{
		if (currentEvent)
			currentEvent.watch.stop();
	}

	/**
	 * Returns the time (in milliseconds) elapsed for the most recent occurrence of the named event. -1 if the named event is not found.
	 * @param {String} name Name of the event.
	 */
	this.duration = function (name)
	{
		if (typeof name === "undefined")
			name = "undefined";
		var e = dict_events[name];
		if (e)
			return e.watch.elapsedMs();
		return -1;
	}

	/**
	 * Returns a string containing the time in seconds measured for each event.  Events are separated by the specified string.
	 * @param {String} separator Separator to go between events.  If undefined, '\r\n' will be used instead.
	*/
	this.toString = function (separator)
	{
		if (typeof separator === "undefined")
			separator = '\r\n';
		var labels = new Array(events.length);
		for (var i = 0; i < events.length; i++)
			labels[i] = events[i].name + ": " + events[i].watch.elapsedMs().toFixed(1) + "ms";
		return labels.join(separator);
	}

	/** 
	 * Logs the events and their times to the console.
	 * @param {String} title Optional string to log before logging the events and their times.
	 * */
	this.log = function (title)
	{
		if (typeof title === "undefined")
			title = '';
		else
			title += '\r\n';
		console.log(title + self.toString('\r\n'));
	}

	function TimedEvent(name)
	{
		this.name = name;
		this.watch = new Stopwatch();
		this.watch.start();
	}
}
function Stopwatch()
{
	var accumulatedTime = 0;
	var startTime = 0;
	var isStarted = false;

	this.start = function ()
	{
		if (!isStarted)
		{
			startTime = performance.now();
			isStarted = true;
		}
	};
	this.stop = function ()
	{
		if (isStarted)
		{
			accumulatedTime += performance.now() - startTime;
			isStarted = false;
		}
	};
	this.elapsedMs = function ()
	{
		if (isStarted)
			return accumulatedTime + (performance.now() - startTime);
		return accumulatedTime;
	}
	this.reset = function ()
	{
		accumulatedTime = 0;
		startTime = 0;
		isStarted = false;
	}
}
// From https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
// and https://github.com/bryc/code/blob/master/jshash/PRNGs.md

/**
 * Construct one of these and call its [rand] function to create random numbers using a specific seed.
 * @param {String} seed Seed string
 */
function SeededRandom(seed)
{
	if (typeof seed !== "string")
		throw new Error("SeededRandom requires a seed string");

	// Create xmur3 state:
	var seeder = xmur3(seed);

	// Output four 32-bit hashes to provide the seed for sfc32.
	var randGenFn = sfc32(seeder(), seeder(), seeder(), seeder());

	/** Returns a random number between 0 and 1. */
	this.rand = randGenFn;

	function xmur3(str)
	{
		for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
		{
			h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
			h = h << 13 | h >>> 19;
		}
		return function ()
		{
			h = Math.imul(h ^ (h >>> 16), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			return (h ^= h >>> 16) >>> 0;
		}
	}
	function sfc32(a, b, c, d)
	{
		return function ()
		{
			a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
			var t = (a + b) | 0;
			a = b ^ b >>> 9;
			b = c + (c << 3) | 0;
			c = (c << 21 | c >>> 11);
			d = d + 1 | 0;
			t = t + d | 0;
			c = c + t | 0;
			return (t >>> 0) / 4294967296;
		}
	}
}
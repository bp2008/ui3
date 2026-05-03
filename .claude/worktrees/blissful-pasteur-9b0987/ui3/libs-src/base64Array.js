function base64Array(arr)
{
	var s = '';
	var size = 3 * 10250; // Encode small chunks at a time
	for (var i = 0; i < arr.length; i += size)
	{
		s += btoa(String.fromCharCode.apply(null, arr.slice(i, i + size)));
	}
	return s;
}
if (typeof btoa !== "function")
{
	// A helper that returns Base64 characters and their indices.
	var chars = {
		ascii: function ()
		{
			return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
		}
	};
	/**
   * Binary to ASCII (encode data to Base64)
   * @param {String} data
   * @returns {String}
   */
	window.btoa = function (data)
	{
		var ascii = chars.ascii(),
			len = data.length - 1,
			i = -1,
			b64 = [];

		while (i < len)
		{
			var code = data.charCodeAt(++i) << 16 | data.charCodeAt(++i) << 8 | data.charCodeAt(++i);
			b64.push(ascii[(code >>> 18) & 63] + ascii[(code >>> 12) & 63] + ascii[(code >>> 6) & 63] + ascii[code & 63]);
		}

		b64 = b64.join('');
		var pads = data.length % 3;
		if (pads > 0)
		{
			b64 = b64.slice(0, pads - 3);

			while (b64.length % 4 !== 0)
			{
				b64 += '=';
			}
		}

		return b64;
	}
}
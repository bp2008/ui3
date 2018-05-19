// This class is a crude AVI encoder written for UI3.  It requires the custom JavaScript "Queue" class to be defined.
function AVIEncoder(videoFourCC, bi /* BitmapInfoHeader */, audioFourCC, wf /* WaveFormatEx header */)
{
	var self = this;

	///////////////////////////////////////////////////////////////
	// Definitions ////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////

	var MAX_RIFF_SIZE = 1073741824; // Maximum size of one chunk
	var AVI_INDEX_OF_CHUNKS = 1; // 8-bit flag value for bIndexType in AVISTDINDEX.

	function CHUNK(fourCC)
	{
		/// <summary>
		/// 32 bit chunk ID
		/// Can be any 4-character ASCII string, however some chunk IDs are required or common in AVI
		/// "avih" = MainAVIHeader, appearing in the LIST "hdrl" chunk.
		/// "JUNK" = garbage data, essentially free space which can be used later when rewriting the AVI headers after finished writing the audio/video frames.
		/// For audio/video frames, this is a chunk id: 2 hex digits specifying stream number and 2 letters specifying the data 
		///		"db" = video (uncompressed)
		///		"dc" = video (compressed)
		///		"wb" = audio
		///		"tx" = text
		/// The "db" and "dc" terms only loosely refer to compression.  H.264 i-frames for example can be listed as "db".
		/// "ix##" can be used to define index blocks which appear in "movi" list blocks just like frame blocks appear in there.
		/// </summary>
		this.dwFourCC = fourCC;
		this.dwSize = 0; // 32 bit; not valid until the chunk is already serialized.
		this.data = null; // UInt8Array (byte array) or object implementing SerializeToGhettoStream.  Typically contains headers or video/audio data or index entries.
		this.offset = -1;

		this.SerializeToGhettoStream = function (stream)
		{
			if (typeof this.dwFourCC !== "string" || this.dwFourCC.length !== 4)
				throw new Error("dwFourCC must be a string with length 4");

			this.offset = stream.Count();

			var a_dwFourCC = new Uint8Array(4);
			WriteASCII(a_dwFourCC, this.dwFourCC, { offset: 0 });
			stream.Write(a_dwFourCC);

			var sizeArray = new Uint8Array(4);
			stream.Write(sizeArray);

			if (this.data)
			{
				if (typeof this.data.SerializeToGhettoStream == "function")
				{
					// Now we need to count how big our size is.
					var initialStreamSize = stream.Count();
					this.data.SerializeToGhettoStream(stream);
					// Here's our stream size!
					this.dwSize = stream.Count() - initialStreamSize;
				}
				else
				{
					stream.Write(this.data);
					this.dwSize = this.data.length;
				}
				WriteUInt32LE(sizeArray, this.dwSize, { offset: 0 });
			}

			if (this.dwSize % 2 == 1)
				stream.Write(new Uint8Array(1));
		}
	}
	// LIST is just a chunk where the first 4 bytes of the data section are kept separately from the byte array.
	function LIST(fourCC, listType)
	{
		// Prefix 'dw' is DWORD (4 bytes)
		this.dwFourCC = fourCC; // 32 bit, "RIFF" (RIFF-List) or "LIST" (List)
		this.dwSize = 0; // 32 bit; not valid until the chunk is already serialized.
		/// <summary>
		/// 32 bit list type
		/// dwListType can have many different values.
		///
		/// "AVI " (note the space after "AVI")
		/// Type of first RIFF-List chunk in the AVI file.
		///
		/// "hdrl"
		/// Header list, this is the first child of the first RIFF in the AVI file, and contains one "avih", one or more "strl" (the number of which must match avih's dwStreams property), one "odml", optionally followed by a "JUNK" chunk.
		///
		/// "strl"
		/// Stream list which describes a stream.
		///
		/// "odml"
		/// ODMLExtendedAVIHeader wrapper list
		///
		/// "dmlh"
		/// ODMLExtendedAVIHeader
		///
		/// "AVIX"
		/// Type of all following RIFF-List chunks in the AVI file.  By utilizing multiple AVIX chunks, an AVI can exceed the traditional 1 GB limit.
		///
		/// "movi"
		/// List of audio/video frames.  Located in "AVI " or "AVIX" lists.
		///
		/// "idx1"
		/// Optional index chunk telling where in the file each of the A/V frames are.  Helps with seeking.  This chunk simply contains a dump of 
		///
		/// "indx"
		/// Index of indexes (points at multiple indexes present throughout the AVI file).  Also known as the "Super Index".
		/// </summary>
		this.dwListType = listType;
		this.children = new Array(); // The serialized binary size of this should equal dwSize - 4 (because dwListType is included in dwSize)
		this.offset = -1;
		this.SerializeToGhettoStream = function (stream)
		{
			if (typeof this.dwFourCC !== "string" || this.dwFourCC.length !== 4)
				throw new Error("dwFourCC must be a string with length 4");
			if (typeof this.dwListType !== "string" || this.dwListType.length !== 4)
				throw new Error("dwListType must be a string with length 4");

			this.offset = stream.Count();

			var a_dwFourCC = new Uint8Array(4);
			WriteASCII(a_dwFourCC, this.dwFourCC, { offset: 0 });
			stream.Write(a_dwFourCC);

			var sizeArray = new Uint8Array(4);
			stream.Write(sizeArray);

			// Now we need to count how big our size is.
			var initialStreamSize = stream.Count();

			var a_dwListType = new Uint8Array(4);
			WriteASCII(a_dwListType, this.dwListType, { offset: 0 });
			stream.Write(a_dwListType);

			for (var i = 0; i < this.children.length; i++)
				this.children[i].SerializeToGhettoStream(stream);
			// Here's our stream size!
			this.dwSize = stream.Count() - initialStreamSize;
			WriteUInt32LE(sizeArray, this.dwSize, { offset: 0 });

			if (this.dwSize % 2 == 1)
				stream.Write(new Uint8Array(1));
		}
	}

	function MainAVIHeader() // This object represents a chunk with fourCC 'avih'
	{
		// All fields of this object are 4 bytes in size, hence the 'dw' or 'DWORD' prefix in their names.

		this.dwMicroSecPerFrame = 40000; // Microseconds between frames (can be ignored by readers!).
		this.dwMaxBytesPerSec = 4000000; // Max data rate in bytes per second.  Supposedly unimportant.  Defaulting to 16 Mbps or 2 MB/s
		this.dwPaddingGranularity = 2000; // File must be padded to a multiple of this size. "normally 2K" (as in 2000?)
		this.dwFlags = 0; // See HeaderFlags
		this.dwTotalFrames = 0; // # frames in the first RIFF chunk.
		this.dwInitialFrames = 0; // Ignore
		this.dwStreams = 0; // Number of streams in the file
		this.dwSuggestedBufferSize = 65535; // Size of buffer required to hold chunks of the file. Idiotic.
		this.dwWidth = 0; // Width of video stream (in pixels I assume)
		this.dwHeight = 0; // Height of video stream (in pixels I assume)
		this.dwReserved0 = 0; // 32 bit;
		this.dwReserved1 = 0; // 32 bit;
		this.dwReserved2 = 0; // 32 bit;
		this.dwReserved3 = 0; // 32 bit;

		this.SerializeToGhettoStream = function (stream)
		{
			var buf = new Uint8Array(56);
			var offsetWrapper = { offset: 0 };
			WriteUInt32LE(buf, this.dwMicroSecPerFrame, offsetWrapper);
			WriteUInt32LE(buf, this.dwMaxBytesPerSec, offsetWrapper);
			WriteUInt32LE(buf, this.dwPaddingGranularity, offsetWrapper);
			WriteUInt32LE(buf, this.dwFlags, offsetWrapper);
			WriteUInt32LE(buf, this.dwTotalFrames, offsetWrapper);
			WriteUInt32LE(buf, this.dwInitialFrames, offsetWrapper);
			WriteUInt32LE(buf, this.dwStreams, offsetWrapper);
			WriteUInt32LE(buf, this.dwSuggestedBufferSize, offsetWrapper);
			WriteUInt32LE(buf, this.dwWidth, offsetWrapper);
			WriteUInt32LE(buf, this.dwHeight, offsetWrapper);
			WriteUInt32LE(buf, this.dwReserved0, offsetWrapper);
			WriteUInt32LE(buf, this.dwReserved1, offsetWrapper);
			WriteUInt32LE(buf, this.dwReserved2, offsetWrapper);
			WriteUInt32LE(buf, this.dwReserved3, offsetWrapper);
			stream.Write(buf);
		}
	}
	var HeaderFlags =
		{
			AVIF_HASINDEX: 16  // The file has an index
			, AVIF_MUSTUSEINDEX: 32 // The order of video and audio chunks must be replayed in the order specified by the index (which may differ from the order in the file).
			, AVIF_ISINTERLEAVED: 256 // The streams are interleaved into each other
			, AVIF_WASCAPTUREFILE: 65536 // The file was captured (significance unknown).
			, AVIF_COPYRIGHTED: 131072 // Ignore
			, AVIF_TRUSTCKTYPE: 2048 // This flag indicates that the keyframe flags in the index are reliable. If this flag is not set in an Open-DML file, the keyframe flags could be defective without technically rendering the file invalid.

		};
	function AVIStreamHeader() // 'strh'
	{
		// Prefix 'fcc' is FOURCC (4 bytes)
		// Prefix 'dw' is DWORD (4 bytes)
		// Prefix 'w' is WORD (2 bytes)
		// Prefix 'rc' is RECT (another structure, 8 bytes in size)
		this.fccType; // Can be 'vids' for a video stream, 'auds' for audio, 'txts' for subtitle.
		this.fccHandler; // FourCC of the codec used by this stream, e.g. 'H264'
		this.dwFlags; // See StreamHeaderFlags
		this.wPriority = 0;
		this.wLanguage = 0;
		this.dwInitialFrames = 0; // Number of the first block of the stream that is present in the file
		this.dwScale = 1; // Denominator in dwRate / dwScale fraction.
		this.dwRate = 30; // dwRate / dwScale == samples/second (NTSC = 30000/1001) (PAL = 25/1).  Should be "mutually prime", which I guess means simplified to their lowest integer numbers.  E.g. 25/1 instead of 10,000,000/400,000
		this.dwStart = 0; // Start time of stream.  
		this.dwLength = 0; // Size of stream in units as defined in dwRate and dwScale.
		this.dwSuggestedBufferSize = 65535; // Size of buffer required to hold chunks of the file. Idiotic.
		this.dwQuality = 50; // Unimportant
		this.dwSampleSize = 0; // Minimum number of bytes of one stream atom.  Importance unknown.
		this.rcFrameLeft = 0; // 16 bits; 0
		this.rcFrameTop = 0; // 16 bits; 0
		this.rcFrameRight = 0; // 16 bits; video width
		this.rcFrameBottom = 0; // 16 bits; video height

		this.SerializeToGhettoStream = function (stream)
		{
			if (typeof this.fccType !== "string" || this.fccType.length !== 4)
				throw new Error("fccType must be a string with length 4");
			if (typeof this.fccHandler !== "string" || this.fccHandler.length !== 4)
				throw new Error("fccHandler must be a string with length 4");
			var buf = new Uint8Array(56);
			var offsetWrapper = { offset: 0 };
			WriteASCII(buf, this.fccType, offsetWrapper);
			WriteASCII(buf, this.fccHandler, offsetWrapper);
			WriteUInt32LE(buf, this.dwFlags, offsetWrapper);
			WriteUInt16LE(buf, this.wPriority, offsetWrapper);
			WriteUInt16LE(buf, this.wLanguage, offsetWrapper);
			WriteUInt32LE(buf, this.dwInitialFrames, offsetWrapper);
			WriteUInt32LE(buf, this.dwScale, offsetWrapper);
			WriteUInt32LE(buf, this.dwRate, offsetWrapper);
			WriteUInt32LE(buf, this.dwStart, offsetWrapper);
			WriteUInt32LE(buf, this.dwLength, offsetWrapper);
			WriteUInt32LE(buf, this.dwSuggestedBufferSize, offsetWrapper);
			WriteUInt32LE(buf, this.dwQuality, offsetWrapper);
			WriteUInt32LE(buf, this.dwSampleSize, offsetWrapper);
			WriteUInt16LE(buf, this.rcFrameLeft, offsetWrapper);
			WriteUInt16LE(buf, this.rcFrameTop, offsetWrapper);
			WriteUInt16LE(buf, this.rcFrameRight, offsetWrapper);
			WriteUInt16LE(buf, this.rcFrameBottom, offsetWrapper);
			stream.Write(buf);
		}
	}
	var StreamHeaderFlags =
		{
			AVISF_DISABLED: 1 // Stream should not be activated by default (I guess for foreign languages and stuff).  Not used by this encoder.
			, AVISF_VIDEO_PALCHANGES: 65536 // Stream is a video stream using palettes where the palette is changing during playback.  Not used by this encoder.
		}
	//function RECT()
	//{
	//	// Each field in this structure is 16 bit signed integer, despite being a 32 bit signed "LONG" types in the original RECT struct. Idiocy.
	//	this.left;
	//	this.top;
	//	this.right;
	//	this.bottom;
	//}

	// The stream format element 'strf' following the Stream Header 'strh' depends on the media type.  This is a BITMAPINFOHEADER for video or WAVEFORMATEX for audio.
	function AVIINDEX(movi)
	{
		this.items = new Array();
		this.SerializeToGhettoStream = function (stream)
		{
			// Build index
			var buf = new Uint8Array(16 * movi.children.length);
			var offsetWrapper = { offset: 0 };
			for (var i = 0; i < movi.children.length; i++)
			{
				var child = movi.children[i];
				var item = new AVIINDEXENTRY();
				item.ckid = child.dwFourCC;
				item.dwFlags = child.TagAsKeyframe ? IndexFlags.AVIIF_KEYFRAME : 0;
				item.dwChunkOffset = (child.offset - movi.offset) - 8;
				item.dwChunkLength = child.dwSize;
				item.SerializeToUint8Array(buf, offsetWrapper);
			}
			stream.Write(buf);
		}
	}
	function AVIINDEXENTRY() // Each instance of this object is one entry in the old-style AVI index.  Each index entry is 16 bytes.
	{
		this.ckid; // 4-char ASCII chunk ID (e.g. "00dc" or "00db" or "01wb")
		this.dwFlags; // Flags
		this.dwChunkOffset; // The offset relative to the first byte of the "movi" list.  Some encoders treat the offset as relative to the start of the file.
		this.dwChunkLength; // Length of the chunk.  I guess this is here so the chunk can be read slightly more efficiently, because each chunk has its length already...
		this.SerializeToUint8Array = function (buf, offsetWrapper)
		{
			WriteASCII(buf, this.ckid, offsetWrapper);
			WriteUInt32LE(buf, this.dwFlags, offsetWrapper);
			WriteUInt32LE(buf, this.dwChunkOffset, offsetWrapper);
			WriteUInt32LE(buf, this.dwChunkLength, offsetWrapper);
		}
	}
	var IndexFlags =
		{
			AVIIF_LIST: 1
			, AVIIF_KEYFRAME: 16
			, AVIIF_NO_TIME: 256
		};

	//function AVISTDINDEX()
	//{
	//	// This extension is not used by this encoder.
	//	this.fcc; // 32 bit; (4 ASCII characters) "ix##" where ## is the stream number for which this index was built.
	//	this.cb; // 32 bit; chunk size
	//	this.wLongsPerEntry = 2; // 16 bit field; must be sizeof(ODMLIndexEntry)/4
	//	this.bIndexSubType = 0; // 8 bit; must be 0
	//	this.bIndexType = AVI_INDEX_OF_CHUNKS; // 8 bit; must be AVI_INDEX_OF_CHUNKS
	//	this.nEntriesInUse; // 32 bit; Number of valid items in aIndex array (only differs from aIndex array length if aIndex has unused elements at the end).
	//	this.dwChunkId; // 32 bit; Type of chunk this is an index for: "##dc" or "##db" or "##wb" etc…
	//	this.qwBaseOffset; // 64 bit; all dwOffsets in aIndex array are relative to this
	//	this.dwReserved3 = 0; // 32 bit; must be 0
	//	var aIndex = new Array(); // Array of ODMLIndexEntry
	//}
	//function ODMLIndexEntry()
	//{
	//	// This extension is not used by this encoder.
	//	this.dwOffset; // Offset of the index entry relative to qwBaseOffset in AVISTDINDEX
	//	this.dwSize; // Size of the chunk this index entry points at.
	//}
	//function ODMLExtendedAVIHeaderWrapper()
	//{
	//	// This extension is not used by this encoder.
	//	this.dwFourCC = "odml";
	//	this.dwSize = 260;
	//}
	//function ODMLExtendedAVIHeader()
	//{
	//	// This extension is not used by this encoder.
	//	this.dwFourCC = "dmlh";
	//	this.dwSize = 248;
	//	this.dwTotalFrames; // Total number of frames in the entire AVI file.
	//	// This header should have an additional 244 null bytes appended because [idiotic reasons].
	//}


	///////////////////////////////////////////////////////////////
	// GhettoStream ///////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	function GhettoStream()
	{
		// <summary>A class which consumes Uint8Array objects and produces Uint8Array objects of whatever size you want by concatenating the inputs as needed.</summary>
		var self = this;
		var dataQueue = new Queue();
		var totalCachedBytes = 0;
		this.Count = function ()
		{
			return totalCachedBytes;
		}
		this.Write = function (newArray)
		{
			/// <summary>Writes the specified Uint8Array to the stream so it can be read later.</summary>
			dataQueue.enqueue(newArray);
			totalCachedBytes += newArray.length;
		}
		this.Read = function (byteCount)
		{
			/// <summary>Reads the specified number of bytes from the stream, returning null if not enough bytes are available yet.</summary>
			if (byteCount > totalCachedBytes)
				return null;

			var readBuf = new Uint8Array(byteCount);
			var alreadyRead = 0;
			var remainingToRead = byteCount - alreadyRead;

			while (remainingToRead > 0)
			{
				var chunk = dataQueue.peek();
				if (chunk.length > remainingToRead)
				{
					// This chunk will have left-overs.
					readBuf.set(chunk.subarray(0, remainingToRead), alreadyRead);
					dataQueue.replaceFront(chunk.subarray(remainingToRead));
					alreadyRead += remainingToRead;
				}
				else
				{
					// This entire chunk goes into the output buffer.
					readBuf.set(chunk, alreadyRead);
					dataQueue.dequeue();
					alreadyRead += chunk.length;
				}
				remainingToRead = byteCount - alreadyRead;
			}
			totalCachedBytes -= readBuf.length;
			return readBuf;
		}
	}
	///////////////////////////////////////////////////////////////
	// Binary Writing /////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	function WriteByte(buf, value, offsetWrapper)
	{
		buf[offsetWrapper.offset++] = value;
	}
	function WriteUInt16LE(buf, value, offsetWrapper)
	{
		new DataView(buf.buffer, offsetWrapper.offset, 2).setUint16(0, value, true);
		offsetWrapper.offset += 2;
	}
	function WriteInt16LE(buf, value, offsetWrapper)
	{
		new DataView(buf.buffer, offsetWrapper.offset, 2).setInt16(0, value, true);
		offsetWrapper.offset += 2;
	}
	function WriteUInt32LE(buf, value, offsetWrapper)
	{
		new DataView(buf.buffer, offsetWrapper.offset, 4).setUint32(0, value, true);
		offsetWrapper.offset += 4;
	}
	function WriteInt32LE(buf, value, offsetWrapper)
	{
		new DataView(buf.buffer, offsetWrapper.offset, 4).setInt32(0, value, true);
		offsetWrapper.offset += 4;
	}
	function WriteASCII(buf, value, offsetWrapper)
	{
		for (var i = 0; i < value.length; i++)
			buf[offsetWrapper.offset++] = value.charCodeAt(i);
	}
	//function ReadUTF8(buf, offsetWrapper, byteLength)
	//{
	//	var v = Utf8ArrayToStr(new Uint8Array(buf, offsetWrapper.offset, byteLength));
	//	offsetWrapper.offset += byteLength;
	//	return v;
	//}
	function ReadSubArray(buf, offsetWrapper, byteLength)
	{
		var readBuf = new Uint8Array(byteLength);
		readBuf.set(buf.subarray(offsetWrapper.offset, offsetWrapper.offset += byteLength));
		return readBuf;
	}

	///////////////////////////////////////////////////////////////
	// Where the bulk of the work is done /////////////////////////
	///////////////////////////////////////////////////////////////

	// Because JavaScript in the browser doesn't have standardized file writing support, we're just going to build this whole thing in memory and not necessarily support the extensions which allow AVI files to be larger than 1 GB.  We won't be able to export a file blob larger than about 500 MB reliably anyway.

	// Declare some references we'll need for later;
	var aviHeader, videoStreamHeader, audioStreamHeader, movi, idx1;

	// A RIFF-List named "AVI " is the first chunk in the AVI file
	var aviRiff = new LIST("RIFF", "AVI ");
	{
		// The first child of aviRiff is "LIST hdrl" which is a list of headers.
		var headerList = new LIST("LIST", "hdrl");
		{
			var streams = 0;
			if (videoFourCC)
				streams++;
			else if (audioFourCC)
				streams++;
			// The first child of headerList is the AVI Header "avih"
			var avih = new CHUNK("avih");
			avih.data = aviHeader = new MainAVIHeader();
			{
				aviHeader.dwFlags = HeaderFlags.AVIF_HASINDEX | HeaderFlags.AVIF_ISINTERLEAVED | HeaderFlags.AVIF_TRUSTCKTYPE;
				aviHeader.dwStreams = streams;
				aviHeader.dwWidth = bi.biWidth;
				aviHeader.dwHeight = bi.biHeight;
			}
			headerList.children.push(avih);

			// After MainAVIHeader comes one AVIStreamHeader Wrapper List for each stream
			// In the wrapper goes an AVIStreamHeader and a stream format object which varies by stream type.
			if (videoFourCC)
			{
				var streamList = new LIST("LIST", "strl");
				var strh = new CHUNK("strh");
				var sh = strh.data = videoStreamHeader = new AVIStreamHeader();
				{
					sh.fccType = "vids";
					sh.fccHandler = videoFourCC; // e.g. "H264"
					// We'll set FPS later
					sh.rcFrameRight = bi.biWidth;
					sh.rcFrameBottom = bi.biHeight;
				}
				streamList.children.push(strh);

				var videoStreamFormat = new CHUNK("strf");
				videoStreamFormat.data = bi.raw;
				streamList.children.push(videoStreamFormat);

				headerList.children.push(streamList);
			}
			if (audioFourCC)
			{
				var streamList = new LIST("LIST", "strl");
				var strh = new CHUNK("strh");
				var sh = strh.data = audioStreamHeader = new AVIStreamHeader();
				{
					sh.fccType = "auds";
					sh.fccHandler = audioFourCC; // e.g. "ulaw"
					sh.dwScale = 1;
					sh.dwRate = wf.nSamplesPerSec;
					sh.dwSuggestedBufferSize = wf.nAvgBytesPerSec;
					sh.dwSampleSize = wf.wBitsPerSample / 8;
				}
				streamList.children.push(strh);

				var audioStreamFormat = new CHUNK("strf");
				audioStreamFormat.data = wf.raw;
				streamList.children.push(audioStreamFormat);

				headerList.children.push(streamList);
			}

			// Add a token amount of JUNK just in case something expects it; we won't be using it.
			var junk = new CHUNK("JUNK");
			junk.data = new Uint8Array(2000);
			headerList.children.push(junk);
		}
		aviRiff.children.push(headerList);

		// Now we add a "movi" list.  This is where frames go.
		movi = new LIST("LIST", "movi");
		movi.children = new Array();
		aviRiff.children.push(movi);

		// Finally add the "idx1" index chunk to the end of our "AVI " RIFF-List.
		idx = new CHUNK("idx1");
		idx.data = new AVIINDEX(movi);
		aviRiff.children.push(idx);
	}

	var videoFrameCount = 0;
	var audioSampleCount = 0;
	var SerializeAVIStructure = function (FPS)
	{
		// Finalize some stuff before serializing
		// Frame Rate
		aviHeader.dwMicroSecPerFrame = parseInt(Math.round(1000000.0 / FPS));
		var sh = videoStreamHeader;
		sh.dwScale = aviHeader.dwMicroSecPerFrame;
		sh.dwRate = 1000000;
		// Really dumb, imperfect algorithm for simplifying the fraction:
		while (sh.dwScale > 1 && sh.dwRate > 1 && sh.dwScale % 2 == 0 && sh.dwRate % 2 == 0)
		{
			sh.dwScale /= 2;
			sh.dwRate /= 2;
		}
		// Frame counts.
		aviHeader.dwTotalFrames = sh.dwLength = videoFrameCount;
		if (audioStreamHeader)
			audioStreamHeader.dwLength = Math.round(audioSampleCount);
		// Okay to serialize
		var stream = new GhettoStream();
		aviRiff.SerializeToGhettoStream(stream);
		return stream.Read(stream.Count());
	}
	///////////////////////////////////////////////////////////////
	// Public Methods /////////////////////////////////////////////
	///////////////////////////////////////////////////////////////
	this.AddVideoFrame = function (frameData, TagAsKeyframe)
	{
		var chunk = new CHUNK(TagAsKeyframe ? "00db" : "00dc");
		chunk.TagAsKeyframe = TagAsKeyframe;
		chunk.data = frameData;
		movi.children.push(chunk)
		videoFrameCount++;
		if (aviHeader.dwSuggestedBufferSize < frameData.length + 8)
			aviHeader.dwSuggestedBufferSize = frameData.length + 8;
	}
	this.AddAudioFrame = function (frameData, TagAsKeyframe)
	{
		if (!wf)
			return;
		var chunk = new CHUNK("01wb");
		chunk.TagAsKeyframe = TagAsKeyframe;
		chunk.data = frameData;
		movi.children.push(chunk)
		audioSampleCount += frameData.length / wf.wBitsPerSample.dwSampleSize;
	}
	this.FinishAndGetUint8Array = function (FPS)
	{
		// <summary>Finishes the AVI structure in memory and serializes it to a Uint8Array, which is returned.</summary>
		return SerializeAVIStructure(FPS);
	}
}
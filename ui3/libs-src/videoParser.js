// videoParser.js - H.264 and H.265 NAL Unit Parser for UI3
// by bp2008
// Mostly AI-generated code.
//
// Compile for UI3 by going to https://babeljs.io/repl, enter `ie 8` in the TARGETS.  Copy the output to videoParser.compiled.js
// Then minify using Google's Closure Compiler (must be run locally).  Output to videoParser.min.js.
// Then copy the minified code to ui3/libs-ui3.js.

/**
 * BitReader utility for parsing H.264 bitstreams (RBSP)
 */
class UI3BitReader
{
	constructor(uint8array)
	{
		this.bytes = this.removeEmulationPreventionBytes(uint8array);
		this.byteOffset = 0;
		this.bitOffset = 0;
	}

	/**
	 * Remove emulation prevention bytes (0x03 after 0x0000)
	 * @param {Uint8Array} data - Input NAL unit data (excluding start code)
	 */
	removeEmulationPreventionBytes(data)
	{
		const out = [];
		for (let i = 0; i < data.length; i++)
		{
			if (i > 1 && data[i] === 0x03 && data[i - 1] === 0x00 && data[i - 2] === 0x00)
			{
				continue; // skip emulation prevention byte
			}
			out.push(data[i]);
		}
		return new Uint8Array(out);
	}

	readBit()
	{
		if (this.byteOffset >= this.bytes.length)
			throw new Error("Out of range");
		const bit = (this.bytes[this.byteOffset] >> (7 - this.bitOffset)) & 1;
		this.bitOffset++;
		if (this.bitOffset === 8)
		{
			this.bitOffset = 0;
			this.byteOffset++;
		}
		return bit;
	}
	readBits(n)
	{
		let val = 0;
		for (let i = 0; i < n; i++)
			val = (val << 1) | this.readBit();
		return val;
	}
	readUE()
	{
		let zeros = 0;
		while (this.readBit() === 0)
			zeros++;
		const value = (1 << zeros) - 1 + this.readBits(zeros);
		return value;
	}
	readSE()
	{
		const ue = this.readUE();
		return ((ue & 1) ? 1 : -1) * Math.ceil(ue / 2);
	}

	/**
	 * Return number of bits remaining in the buffer
	 * @returns {number}
	 */
	bitsRemaining()
	{
		const totalBits = this.bytes.length * 8;
		const consumedBits = this.byteOffset * 8 + this.bitOffset;
		return totalBits - consumedBits;
	}
	/**
	 * Skip n bits without reading them.
	 * @param {number} n - Number of bits to skip
	 */
	skipBits(n)
	{
		const wholeBytes = Math.floor(n / 8);
		this.byteOffset += wholeBytes;
		this.bitOffset += n % 8;
	}
}
var UI3_VideoParser = new (function ()
{
	var self = this;
	// Helper: extract nal_unit_type from first byte after header
	this.getNalTypeName = function (type, isH265)
	{
		if (isH265)
		{
			switch (type)
			{
				case 0: return "TRAIL_N";
				case 1: return "TRAIL_R";
				case 19: return "IDR_W_RADL";
				case 20: return "IDR_N_LP";
				case 21: return "CRA";
				case 32: return "VPS";
				case 33: return "SPS";
				case 34: return "PPS";
				case 35: return "AUD";
				case 39: return "SEI";
				case 40: return "SEI2";
			}
		}
		else
		{
			switch (type)
			{
				case 1: return "NDR";
				case 5: return "IDR";
				case 6: return "SEI";
				case 7: return "SPS";
				case 8: return "PPS";
				case 9: return "AUD";
			}
		}
	}
	/**
	 * Parse a Uint8Array containing one or more H.264 NAL units.
	 * Returns an array of { nal_unit_type, data } objects.
	 *
	 * Supports both Annex-B (start codes) and length-prefixed formats.
	 */
	this.parseNALUnits = function (buffer, isH265)
	{
		const units = [];
		let offset = 0;

		// Helper: extract nal_unit_type from first byte after header
		function getNalType(byte, isH265)
		{
			if (isH265)
				return (byte >> 1) & 63;
			else
				return byte & 0x1F; // lower 5 bits
		}

		// Detect format: Annex-B if we see 0x000001 or 0x00000001
		function isAnnexB(buf)
		{
			return (
				buf[0] === 0x00 &&
				buf[1] === 0x00 &&
				(buf[2] === 0x01 || (buf[2] === 0x00 && buf[3] === 0x01))
			);
		}

		if (isAnnexB(buffer))
		{
			// Annex-B parsing
			while (offset < buffer.length)
			{
				// Find next start code
				let start = -1;
				for (let i = offset; i < buffer.length - 3; i++)
				{
					if (
						buffer[i] === 0x00 &&
						buffer[i + 1] === 0x00 &&
						((buffer[i + 2] === 0x01) ||
							(buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01))
					)
					{
						start = i;
						break;
					}
				}
				if (start < 0) break;

				// Skip start code
				let scSize = buffer[start + 2] === 0x01 ? 3 : 4;
				let nalStart = start + scSize;

				// Find next start code for end
				let end = buffer.length;
				for (let i = nalStart; i < buffer.length - 3; i++)
				{
					if (
						buffer[i] === 0x00 &&
						buffer[i + 1] === 0x00 &&
						((buffer[i + 2] === 0x01) ||
							(buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01))
					)
					{
						end = i;
						break;
					}
				}

				const nalData = buffer.slice(nalStart, end);
				if (nalData.length > 0)
				{
					const type = getNalType(nalData[0]);
					const unit = {
						type,
						type_name: self.getNalTypeName(type, isH265),
						data: nalData
					};
					units.push(unit);
				}
				offset = end;
			}
		}
		else
		{
			// Length-prefixed parsing (AVC in MP4)
			while (offset + 4 <= buffer.length)
			{
				const length =
					(buffer[offset] << 24) |
					(buffer[offset + 1] << 16) |
					(buffer[offset + 2] << 8) |
					buffer[offset + 3];
				offset += 4;
				if (length <= 0 || offset + length > buffer.length) break;
				const nalData = buffer.slice(offset, offset + length);
				units.push({
					type: getNalType(nalData[0], isH265),
					data: nalData
				});
				offset += length;
			}
		}

		for (let i = 0; i < units.length; i++)
		{
			const unit = units[i];
			if (isH265)
			{
			}
			else
			{
				if (unit.type === 7)
					unit.sps = UI3_H264Parser.parseSPS(unit.data);
				else if (unit.type === 8)
					unit.pps = UI3_H264Parser.parsePPS(unit.data);
			}
		}

		return units;
	}
})();
var UI3_H264Parser = new (function ()
{

	/** Parse HRD parameters (Annex E) */
	function parseHrdParameters(br)
	{
		const hrd = {};
		hrd.cpb_cnt_minus1 = br.readUE();
		hrd.bit_rate_scale = br.readBits(4);
		hrd.cpb_size_scale = br.readBits(4);
		hrd.cpb = [];
		for (let i = 0; i <= hrd.cpb_cnt_minus1; i++)
		{
			const item = {
				bit_rate_value_minus1: br.readUE(),
				cpb_size_value_minus1: br.readUE(),
				cbr_flag: br.readBit()
			};
			hrd.cpb.push(item);
		}
		hrd.initial_cpb_removal_delay_length_minus1 = br.readBits(5);
		hrd.cpb_removal_delay_length_minus1 = br.readBits(5);
		hrd.dpb_output_delay_length_minus1 = br.readBits(5);
		hrd.time_offset_length = br.readBits(5);
		return hrd;
	}

	/** Parse VUI parameters (Annex E) */
	function parseVuiParameters(br)
	{
		const vui = {};
		try
		{
			if (br.bitsRemaining() <= 0)
				return vui;
			// aspect_ratio_info_present_flag
			vui.aspect_ratio_info_present_flag = br.readBit();
			if (vui.aspect_ratio_info_present_flag)
			{
				vui.aspect_ratio_idc = br.readBits(8);
				if (vui.aspect_ratio_idc === 255)
				{
					vui.sar_width = br.readBits(16);
					vui.sar_height = br.readBits(16);
				}
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// overscan_info_present_flag
			vui.overscan_info_present_flag = br.readBit();
			if (vui.overscan_info_present_flag)
			{
				vui.overscan_appropriate_flag = br.readBit();
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// video_signal_type_present_flag
			vui.video_signal_type_present_flag = br.readBit();
			if (vui.video_signal_type_present_flag)
			{
				vui.video_format = br.readBits(3);
				vui.video_full_range_flag = br.readBit();
				vui.colour_description_present_flag = br.readBit();
				if (vui.colour_description_present_flag)
				{
					vui.colour_primaries = br.readBits(8);
					vui.transfer_characteristics = br.readBits(8);
					vui.matrix_coefficients = br.readBits(8);
				}
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// chroma_loc_info_present_flag
			vui.chroma_loc_info_present_flag = br.readBit();
			if (vui.chroma_loc_info_present_flag)
			{
				vui.chroma_sample_loc_type_top_field = br.readUE();
				vui.chroma_sample_loc_type_bottom_field = br.readUE();
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// timing_info_present_flag
			vui.timing_info_present_flag = br.readBit();
			if (vui.timing_info_present_flag)
			{
				vui.num_units_in_tick = br.readBits(32);
				vui.time_scale = br.readBits(32);
				vui.fixed_frame_rate_flag = br.readBit();
				// Derived frame rate if sensible
				if (vui.num_units_in_tick && vui.time_scale)
				{
					vui.derived_fps = vui.time_scale / (2 * vui.num_units_in_tick);
				}
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// nal_hrd_parameters_present_flag
			vui.nal_hrd_parameters_present_flag = br.readBit();
			if (vui.nal_hrd_parameters_present_flag)
			{
				vui.nal_hrd = parseHrdParameters(br);
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// vcl_hrd_parameters_present_flag
			vui.vcl_hrd_parameters_present_flag = br.readBit();
			if (vui.vcl_hrd_parameters_present_flag)
			{
				vui.vcl_hrd = parseHrdParameters(br);
			}

			if (vui.nal_hrd_parameters_present_flag || vui.vcl_hrd_parameters_present_flag)
			{
				vui.low_delay_hrd_flag = br.readBit();
			}

			if (br.bitsRemaining() <= 0)
				return vui;
			// pic_struct_present_flag
			vui.pic_struct_present_flag = br.readBit();

			if (br.bitsRemaining() <= 0)
				return vui;
			// bitstream_restriction_flag
			vui.bitstream_restriction_flag = br.readBit();
			if (vui.bitstream_restriction_flag)
			{
				vui.motion_vectors_over_pic_boundaries_flag = br.readBit();
				vui.max_bytes_per_pic_denom = br.readUE();
				vui.max_bits_per_mb_denom = br.readUE();
				vui.log2_max_mv_length_horizontal = br.readUE();
				vui.log2_max_mv_length_vertical = br.readUE();
				vui.max_num_reorder_frames = br.readUE();
				vui.max_dec_frame_buffering = br.readUE();
			}

			// Derived SAR for common aspect_ratio_idc values if not extended SAR
			if (vui.aspect_ratio_info_present_flag && vui.aspect_ratio_idc !== 255)
			{
				const sarTable = {
					1: [1, 1], 2: [12, 11], 3: [10, 11], 4: [16, 11], 5: [40, 33],
					6: [24, 11], 7: [20, 11], 8: [32, 11], 9: [80, 33], 10: [18, 11],
					11: [15, 11], 12: [64, 33], 13: [160, 99], 14: [4, 3], 15: [3, 2],
					16: [2, 1]
				};
				const sar = sarTable[vui.aspect_ratio_idc];
				if (sar) { vui.sar_width = sar[0]; vui.sar_height = sar[1]; }
			}
		}
		catch (e)
		{
			console.warn("Error parsing VUI:", e);
		}

		return vui;
	}

	/**
	 * Parse SPS NAL Unit (with EP3 removal) and full VUI
	 * @param {Uint8Array} nalUnit - Raw SPS NAL unit payload (without start code)
	 * @returns {Object} Parsed SPS fields + derived width/height/fps
	 */
	this.parseSPS = function (nalUnit)
	{
		const br = new UI3BitReader(nalUnit);
		br.skipBits(8); // Skip NALU header
		const sps = { h264: true };
		try
		{
			// profile_idc, constraint flags, level_idc
			sps.profile_idc = br.readBits(8);
			sps.constraint_set_flags = br.readBits(8); // includes reserved_zero_2bits
			sps.level_idc = br.readBits(8);

			sps.profileName = profileName(sps.profile_idc);
			sps.levelName = levelName(sps.level_idc);
			sps.constraints = constraintFlagsString(sps.profile_idc);
			sps.summary = spsSummary(sps);

			sps.seq_parameter_set_id = br.readUE();

			// High profiles add chroma/bit-depth/scaling matrices
			const highProfiles = new Set([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134]);
			if (highProfiles.has(sps.profile_idc))
			{
				sps.chroma_format_idc = br.readUE();
				if (sps.chroma_format_idc === 3)
				{
					sps.separate_colour_plane_flag = br.readBit();
				}
				sps.bit_depth_luma_minus8 = br.readUE();
				sps.bit_depth_chroma_minus8 = br.readUE();
				sps.qpprime_y_zero_transform_bypass_flag = br.readBit();
				sps.seq_scaling_matrix_present_flag = br.readBit();
				if (sps.seq_scaling_matrix_present_flag)
				{
					// Scaling lists are involved; often safe to skip unless needed
					// You can add parsing of 8 or 12 scaling lists based on chroma_format_idc and separate_colour_plane_flag
					// For completeness, they are read with delta scales via signed Exp-Golomb.
					// Omitted here for brevity and speed.
				}
			}
			else
			{
				sps.chroma_format_idc = 1; // Default 4:2:0 for baseline/main
			}
			sps.chroma = chromaFormatName(sps.chroma_format_idc);

			sps.log2_max_frame_num_minus4 = br.readUE();
			sps.pic_order_cnt_type = br.readUE();

			if (sps.pic_order_cnt_type === 0)
			{
				sps.log2_max_pic_order_cnt_lsb_minus4 = br.readUE();
			}
			else if (sps.pic_order_cnt_type === 1)
			{
				sps.delta_pic_order_always_zero_flag = br.readBit();
				sps.offset_for_non_ref_pic = br.readSE();
				sps.offset_for_top_to_bottom_field = br.readSE();
				const num_ref_frames_in_pic_order_cnt_cycle = br.readUE();
				sps.offset_for_ref_frame = [];
				for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++)
				{
					sps.offset_for_ref_frame.push(br.readSE());
				}
			}

			sps.max_num_ref_frames = br.readUE();
			sps.gaps_in_frame_num_value_allowed_flag = br.readBit();
			sps.pic_width_in_mbs_minus1 = br.readUE();
			sps.pic_height_in_map_units_minus1 = br.readUE();
			sps.frame_mbs_only_flag = br.readBit();
			if (!sps.frame_mbs_only_flag)
			{
				sps.mb_adaptive_frame_field_flag = br.readBit();
			}
			sps.direct_8x8_inference_flag = br.readBit();

			sps.frame_cropping_flag = br.readBit();
			if (sps.frame_cropping_flag)
			{
				sps.frame_crop_left_offset = br.readUE();
				sps.frame_crop_right_offset = br.readUE();
				sps.frame_crop_top_offset = br.readUE();
				sps.frame_crop_bottom_offset = br.readUE();
			}

			sps.vui_parameters_present_flag = br.readBit();
			if (sps.vui_parameters_present_flag)
			{
				sps.vui = parseVuiParameters(br);
			}

			// Derived dimensions (in pixels before cropping)
			const widthInMbs = sps.pic_width_in_mbs_minus1 + 1;
			const heightInMapUnits = sps.pic_height_in_map_units_minus1 + 1;
			const frameHeightInMbs = (sps.frame_mbs_only_flag ? 1 : 2) * heightInMapUnits;

			let width = widthInMbs * 16;
			let height = frameHeightInMbs * 16;

			// Apply cropping (units depend on chroma_format_idc and frame_mbs_only_flag)
			if (sps.frame_cropping_flag)
			{
				const chromaFormatIdc = sps.chroma_format_idc;
				const subWidthC = (chromaFormatIdc === 1 || chromaFormatIdc === 2) ? 2 : 1;
				const subHeightC = (chromaFormatIdc === 1) ? 2 : (chromaFormatIdc === 2 ? 1 : 1);
				const cropUnitX = (chromaFormatIdc === 0) ? 1 : subWidthC;
				const cropUnitY = (chromaFormatIdc === 0) ? (2 - sps.frame_mbs_only_flag) : subHeightC * (2 - sps.frame_mbs_only_flag);

				const left = sps.frame_crop_left_offset * cropUnitX;
				const right = sps.frame_crop_right_offset * cropUnitX;
				const top = sps.frame_crop_top_offset * cropUnitY;
				const bottom = sps.frame_crop_bottom_offset * cropUnitY;

				width -= (left + right);
				height -= (top + bottom);
			}

			sps.width = width;
			sps.height = height;

			// Derived display aspect ratio if SAR is present
			if (sps.vui && sps.vui.sar_width && sps.vui.sar_height)
			{
				sps.sample_aspect_ratio = sps.vui.sar_width / sps.vui.sar_height;
				sps.display_width = Math.round(width * sps.sample_aspect_ratio);
				sps.display_height = height;
			}

			// Derived frame rate if timing info present
			if (sps.vui && typeof sps.vui.derived_fps === 'number')
			{
				sps.fps = sps.vui.derived_fps;
			}
		}
		catch (e)
		{
			console.warn("Error parsing SPS:", e);
		}

		return sps;
	}
	function profileName(profile_idc)
	{
		switch (profile_idc)
		{
			case 66: return "Baseline";
			case 77: return "Main";
			case 88: return "Extended";
			case 100: return "High";
			case 110: return "High 10";
			case 122: return "High 4:2:2";
			case 244: return "High 4:4:4 Predictive";
			case 44: return "CAVLC 4:4:4 Intra";
			case 83: return "Scalable Baseline";
			case 86: return "Scalable High";
			case 118: return "Multiview High";
			case 128: return "Stereo High";
			default: return "Unknown (" + profile_idc + ")";
		}
	}
	function chromaFormatName(chroma_format_idc)
	{
		switch (chroma_format_idc)
		{
			case 0: return "Monochrome (no chroma)";
			case 1: return "4:2:0";
			case 2: return "4:2:2";
			case 3: return "4:4:4";
			default: return "Unknown (" + chroma_format_idc + ")";
		}
	}

	function levelName(level_idc)
	{
		// Level IDC values are multiples of 10, e.g. 30 = Level 3.0
		let major = Math.floor(level_idc / 10);
		let minor = level_idc % 10;
		return major + "." + minor;
	}

	function constraintFlagsString(flags)
	{
		const names = [];
		if (flags & 0x80) names.push("0");
		if (flags & 0x40) names.push("1");
		if (flags & 0x20) names.push("2");
		if (flags & 0x10) names.push("3");
		if (flags & 0x08) names.push("4");
		if (flags & 0x04) names.push("5");
		// lowest 2 bits are reserved_zero_2bits
		return names.length ? names.join(",") : "none";
	}

	function spsSummary(sps)
	{
		return "Profile: " + sps.profileName + ", Level: " + sps.levelName
			+ (sps.constraint_set_flags === 0 ? '' : ", Constraints: " + sps.constraints);
	}
	/**
	 * Parse PPS NAL Unit from H.264 stream
	 * @param {Uint8Array} nalUnit - Raw PPS NAL Unit (RBSP form, without emulation prevention bytes ideally)
	 * @returns {Object} Parsed PPS fields
	 */
	this.parsePPS = function (nalUnit)
	{
		const br = new UI3BitReader(nalUnit);
		br.skipBits(8); // Skip NALU header
		const pps = { h264: true };
		try
		{
			// Picture Parameter Set syntax (ISO/IEC 14496-10 / ITU-T H.264)
			pps.pic_parameter_set_id = br.readUE();
			pps.seq_parameter_set_id = br.readUE();
			pps.entropy_coding_mode_flag = br.readBit();
			pps.bottom_field_pic_order_in_frame_present_flag = br.readBit();

			const num_slice_groups_minus1 = br.readUE();
			pps.num_slice_groups_minus1 = num_slice_groups_minus1;

			if (num_slice_groups_minus1 > 0)
			{
				// Handling slice group map type is complex; omitted for brevity
				pps.slice_group_map_type = br.readUE();
				// Additional fields depend on slice_group_map_type
			}

			pps.num_ref_idx_l0_default_active_minus1 = br.readUE();
			pps.num_ref_idx_l1_default_active_minus1 = br.readUE();
			pps.weighted_pred_flag = br.readBit();
			pps.weighted_bipred_idc = br.readBits(2);
			pps.pic_init_qp_minus26 = br.readSE();
			pps.pic_init_qs_minus26 = br.readSE();
			pps.chroma_qp_index_offset = br.readSE();
			pps.deblocking_filter_control_present_flag = br.readBit();
			pps.constrained_intra_pred_flag = br.readBit();
			pps.redundant_pic_cnt_present_flag = br.readBit();

			// Optional extensions if more data remains
			if (br.bitsRemaining() <= 0)
				return pps;
			if (br.byteOffset < nalUnit.length)
			{
				pps.transform_8x8_mode_flag = br.readBit();
				pps.pic_scaling_matrix_present_flag = br.readBit();
				if (pps.pic_scaling_matrix_present_flag)
				{
					// Scaling lists parsing omitted for brevity
				}
				// We can't read beyond here anyway because we never read the "scaling lists"
				//if (br.bitsRemaining() <= 0)
				//	return pps;
				//pps.second_chroma_qp_index_offset = br.readSE();
			}
		}
		catch (e)
		{
			console.warn("Error parsing PPS:", e);
		}
		return pps;
	}
})();
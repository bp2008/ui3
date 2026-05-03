function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
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
var UI3BitReader = /*#__PURE__*/function () {
  function UI3BitReader(uint8array) {
    _classCallCheck(this, UI3BitReader);
    this.bytes = this.removeEmulationPreventionBytes(uint8array);
    this.byteOffset = 0;
    this.bitOffset = 0;
  }

  /**
   * Remove emulation prevention bytes (0x03 after 0x0000)
   * @param {Uint8Array} data - Input NAL unit data (excluding start code)
   */
  return _createClass(UI3BitReader, [{
    key: "removeEmulationPreventionBytes",
    value: function removeEmulationPreventionBytes(data) {
      var out = [];
      for (var i = 0; i < data.length; i++) {
        if (i > 1 && data[i] === 0x03 && data[i - 1] === 0x00 && data[i - 2] === 0x00) {
          continue; // skip emulation prevention byte
        }
        out.push(data[i]);
      }
      return new Uint8Array(out);
    }
  }, {
    key: "readBit",
    value: function readBit() {
      if (this.byteOffset >= this.bytes.length) throw new Error("Out of range");
      var bit = this.bytes[this.byteOffset] >> 7 - this.bitOffset & 1;
      this.bitOffset++;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
      return bit;
    }
  }, {
    key: "readBits",
    value: function readBits(n) {
      var val = 0;
      for (var i = 0; i < n; i++) val = val << 1 | this.readBit();
      return val;
    }
  }, {
    key: "readUE",
    value: function readUE() {
      var zeros = 0;
      while (this.readBit() === 0) zeros++;
      var value = (1 << zeros) - 1 + this.readBits(zeros);
      return value;
    }
  }, {
    key: "readSE",
    value: function readSE() {
      var ue = this.readUE();
      return (ue & 1 ? 1 : -1) * Math.ceil(ue / 2);
    }

    /**
     * Return number of bits remaining in the buffer
     * @returns {number}
     */
  }, {
    key: "bitsRemaining",
    value: function bitsRemaining() {
      var totalBits = this.bytes.length * 8;
      var consumedBits = this.byteOffset * 8 + this.bitOffset;
      return totalBits - consumedBits;
    }
    /**
     * Skip n bits without reading them.
     * @param {number} n - Number of bits to skip
     */
  }, {
    key: "skipBits",
    value: function skipBits(n) {
      var wholeBytes = Math.floor(n / 8);
      this.byteOffset += wholeBytes;
      this.bitOffset += n % 8;
    }
  }]);
}();
var UI3_VideoParser = new function () {
  var self = this;
  // Helper: extract nal_unit_type from first byte after header
  this.getNalTypeName = function (type, isH265) {
    if (isH265) {
      switch (type) {
        case 0:
          return "TRAIL_N";
        case 1:
          return "TRAIL_R";
        case 19:
          return "IDR_W_RADL";
        case 20:
          return "IDR_N_LP";
        case 21:
          return "CRA";
        case 32:
          return "VPS";
        case 33:
          return "SPS";
        case 34:
          return "PPS";
        case 35:
          return "AUD";
        case 39:
          return "SEI";
        case 40:
          return "SEI2";
      }
    } else {
      switch (type) {
        case 1:
          return "NDR";
        case 5:
          return "IDR";
        case 6:
          return "SEI";
        case 7:
          return "SPS";
        case 8:
          return "PPS";
        case 9:
          return "AUD";
      }
    }
  };
  /**
   * Parse a Uint8Array containing one or more H.264 NAL units.
   * Returns an array of { nal_unit_type, data } objects.
   *
   * Supports both Annex-B (start codes) and length-prefixed formats.
   */
  this.parseNALUnits = function (buffer, isH265) {
    var units = [];
    var offset = 0;

    // Helper: extract nal_unit_type from first byte after header
    function getNalType(_byte, isH265) {
      if (isH265) return _byte >> 1 & 63;else return _byte & 0x1F; // lower 5 bits
    }

    // Detect format: Annex-B if we see 0x000001 or 0x00000001
    function isAnnexB(buf) {
      return buf[0] === 0x00 && buf[1] === 0x00 && (buf[2] === 0x01 || buf[2] === 0x00 && buf[3] === 0x01);
    }
    if (isAnnexB(buffer)) {
      // Annex-B parsing
      while (offset < buffer.length) {
        // Find next start code
        var start = -1;
        for (var i = offset; i < buffer.length - 3; i++) {
          if (buffer[i] === 0x00 && buffer[i + 1] === 0x00 && (buffer[i + 2] === 0x01 || buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01)) {
            start = i;
            break;
          }
        }
        if (start < 0) break;

        // Skip start code
        var scSize = buffer[start + 2] === 0x01 ? 3 : 4;
        var nalStart = start + scSize;

        // Find next start code for end
        var end = buffer.length;
        for (var _i = nalStart; _i < buffer.length - 3; _i++) {
          if (buffer[_i] === 0x00 && buffer[_i + 1] === 0x00 && (buffer[_i + 2] === 0x01 || buffer[_i + 2] === 0x00 && buffer[_i + 3] === 0x01)) {
            end = _i;
            break;
          }
        }
        var nalData = buffer.slice(nalStart, end);
        if (nalData.length > 0) {
          var type = getNalType(nalData[0], isH265);
          var unit = {
            type: type,
            type_name: self.getNalTypeName(type, isH265),
            data: nalData
          };
          units.push(unit);
        }
        offset = end;
      }
    } else {
      // Length-prefixed parsing (AVC in MP4)
      while (offset + 4 <= buffer.length) {
        var length = buffer[offset] << 24 | buffer[offset + 1] << 16 | buffer[offset + 2] << 8 | buffer[offset + 3];
        offset += 4;
        if (length <= 0 || offset + length > buffer.length) break;
        var _nalData = buffer.slice(offset, offset + length);
        var _type = getNalType(_nalData[0], isH265);
        units.push({
          type: _type,
          type_name: self.getNalTypeName(_type, isH265),
          data: _nalData
        });
        offset += length;
      }
    }
    for (var _i2 = 0; _i2 < units.length; _i2++) {
      var _unit = units[_i2];
      if (isH265) {
        if (_unit.type === 33) _unit.sps = UI3_H265Parser.parseSPS(_unit.data);
        //else if (unit.type === 34)
        //	unit.pps = UI3_H265Parser.parsePPS(unit.data);
      } else {
        if (_unit.type === 7) _unit.sps = UI3_H264Parser.parseSPS(_unit.data);else if (_unit.type === 8) _unit.pps = UI3_H264Parser.parsePPS(_unit.data);
      }
    }
    return units;
  };
}();
var UI3_H264Parser = new function () {
  /** Parse HRD parameters (Annex E) */
  function parseHrdParameters(br) {
    var hrd = {};
    hrd.cpb_cnt_minus1 = br.readUE();
    hrd.bit_rate_scale = br.readBits(4);
    hrd.cpb_size_scale = br.readBits(4);
    hrd.cpb = [];
    for (var i = 0; i <= hrd.cpb_cnt_minus1; i++) {
      var item = {
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
  function parseVuiParameters(br) {
    var vui = {};
    try {
      if (br.bitsRemaining() <= 0) return vui;
      // aspect_ratio_info_present_flag
      vui.aspect_ratio_info_present_flag = br.readBit();
      if (vui.aspect_ratio_info_present_flag) {
        vui.aspect_ratio_idc = br.readBits(8);
        if (vui.aspect_ratio_idc === 255) {
          vui.sar_width = br.readBits(16);
          vui.sar_height = br.readBits(16);
        }
      }
      if (br.bitsRemaining() <= 0) return vui;
      // overscan_info_present_flag
      vui.overscan_info_present_flag = br.readBit();
      if (vui.overscan_info_present_flag) {
        vui.overscan_appropriate_flag = br.readBit();
      }
      if (br.bitsRemaining() <= 0) return vui;
      // video_signal_type_present_flag
      vui.video_signal_type_present_flag = br.readBit();
      if (vui.video_signal_type_present_flag) {
        vui.video_format = br.readBits(3);
        vui.video_full_range_flag = br.readBit();
        vui.colour_description_present_flag = br.readBit();
        if (vui.colour_description_present_flag) {
          vui.colour_primaries = br.readBits(8);
          vui.transfer_characteristics = br.readBits(8);
          vui.matrix_coefficients = br.readBits(8);
        }
      }
      if (br.bitsRemaining() <= 0) return vui;
      // chroma_loc_info_present_flag
      vui.chroma_loc_info_present_flag = br.readBit();
      if (vui.chroma_loc_info_present_flag) {
        vui.chroma_sample_loc_type_top_field = br.readUE();
        vui.chroma_sample_loc_type_bottom_field = br.readUE();
      }
      if (br.bitsRemaining() <= 0) return vui;
      // timing_info_present_flag
      vui.timing_info_present_flag = br.readBit();
      if (vui.timing_info_present_flag) {
        vui.num_units_in_tick = br.readBits(32);
        vui.time_scale = br.readBits(32);
        vui.fixed_frame_rate_flag = br.readBit();
        // Derived frame rate if sensible
        if (vui.num_units_in_tick && vui.time_scale) {
          vui.derived_fps = vui.time_scale / (2 * vui.num_units_in_tick);
        }
      }
      if (br.bitsRemaining() <= 0) return vui;
      // nal_hrd_parameters_present_flag
      vui.nal_hrd_parameters_present_flag = br.readBit();
      if (vui.nal_hrd_parameters_present_flag) {
        vui.nal_hrd = parseHrdParameters(br);
      }
      if (br.bitsRemaining() <= 0) return vui;
      // vcl_hrd_parameters_present_flag
      vui.vcl_hrd_parameters_present_flag = br.readBit();
      if (vui.vcl_hrd_parameters_present_flag) {
        vui.vcl_hrd = parseHrdParameters(br);
      }
      if (vui.nal_hrd_parameters_present_flag || vui.vcl_hrd_parameters_present_flag) {
        vui.low_delay_hrd_flag = br.readBit();
      }
      if (br.bitsRemaining() <= 0) return vui;
      // pic_struct_present_flag
      vui.pic_struct_present_flag = br.readBit();
      if (br.bitsRemaining() <= 0) return vui;
      // bitstream_restriction_flag
      vui.bitstream_restriction_flag = br.readBit();
      if (vui.bitstream_restriction_flag) {
        vui.motion_vectors_over_pic_boundaries_flag = br.readBit();
        vui.max_bytes_per_pic_denom = br.readUE();
        vui.max_bits_per_mb_denom = br.readUE();
        vui.log2_max_mv_length_horizontal = br.readUE();
        vui.log2_max_mv_length_vertical = br.readUE();
        vui.max_num_reorder_frames = br.readUE();
        vui.max_dec_frame_buffering = br.readUE();
      }

      // Derived SAR for common aspect_ratio_idc values if not extended SAR
      if (vui.aspect_ratio_info_present_flag && vui.aspect_ratio_idc !== 255) {
        var sarTable = {
          1: [1, 1],
          2: [12, 11],
          3: [10, 11],
          4: [16, 11],
          5: [40, 33],
          6: [24, 11],
          7: [20, 11],
          8: [32, 11],
          9: [80, 33],
          10: [18, 11],
          11: [15, 11],
          12: [64, 33],
          13: [160, 99],
          14: [4, 3],
          15: [3, 2],
          16: [2, 1]
        };
        var sar = sarTable[vui.aspect_ratio_idc];
        if (sar) {
          vui.sar_width = sar[0];
          vui.sar_height = sar[1];
        }
      }
    } catch (e) {
      console.warn("Error parsing VUI:", e);
    }
    return vui;
  }

  /**
   * Parse SPS NAL Unit (with EP3 removal) and full VUI
   * @param {Uint8Array} nalUnit - Raw SPS NAL unit payload (without start code)
   * @returns {Object} Parsed SPS fields + derived width/height/fps
   */
  this.parseSPS = function (nalUnit) {
    var br = new UI3BitReader(nalUnit);
    br.skipBits(8); // Skip NALU header
    var sps = {
      h264: true
    };
    try {
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
      var highProfiles = new Set([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134]);
      if (highProfiles.has(sps.profile_idc)) {
        sps.chroma_format_idc = br.readUE();
        if (sps.chroma_format_idc === 3) {
          sps.separate_colour_plane_flag = br.readBit();
        }
        sps.bit_depth_luma_minus8 = br.readUE();
        sps.bit_depth_chroma_minus8 = br.readUE();
        sps.qpprime_y_zero_transform_bypass_flag = br.readBit();
        sps.seq_scaling_matrix_present_flag = br.readBit();
        if (sps.seq_scaling_matrix_present_flag) {
          // Scaling lists are involved; often safe to skip unless needed
          // You can add parsing of 8 or 12 scaling lists based on chroma_format_idc and separate_colour_plane_flag
          // For completeness, they are read with delta scales via signed Exp-Golomb.
          // Omitted here for brevity and speed.
        }
      } else {
        sps.chroma_format_idc = 1; // Default 4:2:0 for baseline/main
      }
      sps.chroma = chromaFormatName(sps.chroma_format_idc);
      sps.log2_max_frame_num_minus4 = br.readUE();
      sps.pic_order_cnt_type = br.readUE();
      if (sps.pic_order_cnt_type === 0) {
        sps.log2_max_pic_order_cnt_lsb_minus4 = br.readUE();
      } else if (sps.pic_order_cnt_type === 1) {
        sps.delta_pic_order_always_zero_flag = br.readBit();
        sps.offset_for_non_ref_pic = br.readSE();
        sps.offset_for_top_to_bottom_field = br.readSE();
        var num_ref_frames_in_pic_order_cnt_cycle = br.readUE();
        sps.offset_for_ref_frame = [];
        for (var i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
          sps.offset_for_ref_frame.push(br.readSE());
        }
      }
      sps.max_num_ref_frames = br.readUE();
      sps.gaps_in_frame_num_value_allowed_flag = br.readBit();
      sps.pic_width_in_mbs_minus1 = br.readUE();
      sps.pic_height_in_map_units_minus1 = br.readUE();
      sps.frame_mbs_only_flag = br.readBit();
      if (!sps.frame_mbs_only_flag) {
        sps.mb_adaptive_frame_field_flag = br.readBit();
      }
      sps.direct_8x8_inference_flag = br.readBit();
      sps.frame_cropping_flag = br.readBit();
      if (sps.frame_cropping_flag) {
        sps.frame_crop_left_offset = br.readUE();
        sps.frame_crop_right_offset = br.readUE();
        sps.frame_crop_top_offset = br.readUE();
        sps.frame_crop_bottom_offset = br.readUE();
      }
      sps.vui_parameters_present_flag = br.readBit();
      if (sps.vui_parameters_present_flag) {
        sps.vui = parseVuiParameters(br);
      }

      // Derived dimensions (in pixels before cropping)
      var widthInMbs = sps.pic_width_in_mbs_minus1 + 1;
      var heightInMapUnits = sps.pic_height_in_map_units_minus1 + 1;
      var frameHeightInMbs = (sps.frame_mbs_only_flag ? 1 : 2) * heightInMapUnits;
      var width = widthInMbs * 16;
      var height = frameHeightInMbs * 16;

      // Apply cropping (units depend on chroma_format_idc and frame_mbs_only_flag)
      if (sps.frame_cropping_flag) {
        var chromaFormatIdc = sps.chroma_format_idc;
        var subWidthC = chromaFormatIdc === 1 || chromaFormatIdc === 2 ? 2 : 1;
        var subHeightC = chromaFormatIdc === 1 ? 2 : chromaFormatIdc === 2 ? 1 : 1;
        var cropUnitX = chromaFormatIdc === 0 ? 1 : subWidthC;
        var cropUnitY = chromaFormatIdc === 0 ? 2 - sps.frame_mbs_only_flag : subHeightC * (2 - sps.frame_mbs_only_flag);
        var left = sps.frame_crop_left_offset * cropUnitX;
        var right = sps.frame_crop_right_offset * cropUnitX;
        var top = sps.frame_crop_top_offset * cropUnitY;
        var bottom = sps.frame_crop_bottom_offset * cropUnitY;
        width -= left + right;
        height -= top + bottom;
      }
      sps.width = width;
      sps.height = height;

      // Derived display aspect ratio if SAR is present
      if (sps.vui && sps.vui.sar_width && sps.vui.sar_height) {
        sps.sample_aspect_ratio = sps.vui.sar_width / sps.vui.sar_height;
        sps.display_width = Math.round(width * sps.sample_aspect_ratio);
        sps.display_height = height;
      }

      // Derived frame rate if timing info present
      if (sps.vui && typeof sps.vui.derived_fps === 'number') {
        sps.fps = sps.vui.derived_fps;
      }
    } catch (e) {
      console.warn("Error parsing SPS:", e);
    }
    return sps;
  };
  function profileName(profile_idc) {
    switch (profile_idc) {
      case 66:
        return "Baseline";
      case 77:
        return "Main";
      case 88:
        return "Extended";
      case 100:
        return "High";
      case 110:
        return "High 10";
      case 122:
        return "High 4:2:2";
      case 244:
        return "High 4:4:4 Predictive";
      case 44:
        return "CAVLC 4:4:4 Intra";
      case 83:
        return "Scalable Baseline";
      case 86:
        return "Scalable High";
      case 118:
        return "Multiview High";
      case 128:
        return "Stereo High";
      default:
        return "Unknown (" + profile_idc + ")";
    }
  }
  function chromaFormatName(chroma_format_idc) {
    switch (chroma_format_idc) {
      case 0:
        return "Monochrome (no chroma)";
      case 1:
        return "4:2:0";
      case 2:
        return "4:2:2";
      case 3:
        return "4:4:4";
      default:
        return "Unknown (" + chroma_format_idc + ")";
    }
  }
  function levelName(level_idc) {
    // Level IDC values are multiples of 10, e.g. 30 = Level 3.0
    var major = Math.floor(level_idc / 10);
    var minor = level_idc % 10;
    return major + "." + minor;
  }
  function constraintFlagsString(flags) {
    var names = [];
    if (flags & 0x80) names.push("0");
    if (flags & 0x40) names.push("1");
    if (flags & 0x20) names.push("2");
    if (flags & 0x10) names.push("3");
    if (flags & 0x08) names.push("4");
    if (flags & 0x04) names.push("5");
    // lowest 2 bits are reserved_zero_2bits
    return names.length ? names.join(",") : "none";
  }
  function spsSummary(sps) {
    return "Profile: " + sps.profileName + ", Level: " + sps.levelName + (sps.constraint_set_flags === 0 ? '' : ", Constraints: " + sps.constraints);
  }
  /**
   * Parse PPS NAL Unit from H.264 stream
   * @param {Uint8Array} nalUnit - Raw PPS NAL Unit (RBSP form, without emulation prevention bytes ideally)
   * @returns {Object} Parsed PPS fields
   */
  this.parsePPS = function (nalUnit) {
    var br = new UI3BitReader(nalUnit);
    br.skipBits(8); // Skip NALU header
    var pps = {
      h264: true
    };
    try {
      // Picture Parameter Set syntax (ISO/IEC 14496-10 / ITU-T H.264)
      pps.pic_parameter_set_id = br.readUE();
      pps.seq_parameter_set_id = br.readUE();
      pps.entropy_coding_mode_flag = br.readBit();
      pps.bottom_field_pic_order_in_frame_present_flag = br.readBit();
      var num_slice_groups_minus1 = br.readUE();
      pps.num_slice_groups_minus1 = num_slice_groups_minus1;
      if (num_slice_groups_minus1 > 0) {
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
      if (br.bitsRemaining() <= 0) return pps;
      if (br.byteOffset < nalUnit.length) {
        pps.transform_8x8_mode_flag = br.readBit();
        pps.pic_scaling_matrix_present_flag = br.readBit();
        if (pps.pic_scaling_matrix_present_flag) {
          // Scaling lists parsing omitted for brevity
        }
        // We can't read beyond here anyway because we never read the "scaling lists"
        //if (br.bitsRemaining() <= 0)
        //	return pps;
        //pps.second_chroma_qp_index_offset = br.readSE();
      }
    } catch (e) {
      console.warn("Error parsing PPS:", e);
    }
    return pps;
  };
}();

/**
 * H.265/HEVC SPS and PPS parser
 */
var UI3_H265Parser = new function () {
  /**
   * Parse SPS NAL Unit from H.265 stream
   * @param {Uint8Array} nalUnit - Raw SPS NAL unit payload (without start code)
   * @returns {Object} Parsed SPS fields
   */
  this.parseSPS = function (nalUnit) {
    var br = new UI3BitReader(nalUnit);
    br.skipBits(16); // Skip NALU header (2 bytes for H.265)
    var sps = {
      h265: true
    };
    try {
      // profile_tier_level parsing (simplified)
      sps.sps_video_parameter_set_id = br.readBits(4);
      sps.sps_max_sub_layers_minus1 = br.readBits(3);
      sps.sps_temporal_id_nesting_flag = br.readBit();

      // profile_tier_level
      sps.profile_tier_level = parseProfileTierLevel(br, sps.sps_max_sub_layers_minus1);
      //sps.profile_space = br.readBits(2);
      //sps.tier_flag = br.readBits(1);
      //sps.profile_idc = br.readBits(5);

      //sps.profile_compatibility_flags = br.readBits(32);
      //sps.constraint_indicator_flags = new Uint8Array(6);
      //for (let i = 0; i < 6; i++)
      //	sps.constraint_indicator_flags[i] = br.readUByte();

      //sps.level_idc = br.readBits(1);

      sps.sps_seq_parameter_set_id = br.readUE();
      sps.chroma_format_idc = br.readUE();
      if (sps.chroma_format_idc === 3) {
        sps.separate_colour_plane_flag = br.readBit();
      }
      sps.pic_width_in_luma_samples = br.readUE();
      sps.pic_height_in_luma_samples = br.readUE();
      sps.conformance_window_flag = br.readBit();
      if (sps.conformance_window_flag) {
        sps.conf_win_left_offset = br.readUE();
        sps.conf_win_right_offset = br.readUE();
        sps.conf_win_top_offset = br.readUE();
        sps.conf_win_bottom_offset = br.readUE();
      }
      sps.bit_depth_luma_minus8 = br.readUE();
      sps.bit_depth_chroma_minus8 = br.readUE();
      sps.log2_max_pic_order_cnt_lsb_minus4 = br.readUE();
      sps.sps_sub_layer_ordering_info_present_flag = br.readBit();
      var orderingCount = sps.sps_sub_layer_ordering_info_present_flag ? sps.sps_max_sub_layers_minus1 + 1 : 1;
      sps.sub_layer_ordering = [];
      for (var i = 0; i < orderingCount; i++) {
        sps.sub_layer_ordering[i] = {
          sps_max_dec_pic_buffering_minus1: br.readUE(),
          sps_max_num_reorder_pics: br.readUE(),
          sps_max_latency_increase_plus1: br.readUE()
        };
      }
      sps.log2_min_luma_coding_block_size_minus3 = br.readUE();
      sps.log2_diff_max_min_luma_coding_block_size = br.readUE();
      sps.log2_min_transform_block_size_minus2 = br.readUE();
      sps.log2_diff_max_min_transform_block_size = br.readUE();
      sps.max_transform_hierarchy_depth_inter = br.readUE();
      sps.max_transform_hierarchy_depth_intra = br.readUE();
      sps.scaling_list_enabled_flag = br.readBit();
      if (sps.scaling_list_enabled_flag) {
        sps.sps_scaling_list_data_present_flag = br.readBit();
        if (sps.sps_scaling_list_data_present_flag) {
          sps.scaling_list_data = parseScalingListData(br);
        }
      }
      sps.amp_enabled_flag = br.readBit();
      sps.sample_adaptive_offset_enabled_flag = br.readBit();
      sps.pcm_enabled_flag = br.readBit();
      if (sps.pcm_enabled_flag) {
        sps.pcm_sample_bit_depth_luma_minus1 = br.readBits(4);
        sps.pcm_sample_bit_depth_chroma_minus1 = br.readBits(4);
        sps.log2_min_pcm_luma_coding_block_size_minus3 = br.readUE();
        sps.log2_diff_max_min_pcm_luma_coding_block_size = br.readUE();
        sps.pcm_loop_filter_disabled_flag = br.readBit();
      }
      sps.num_short_term_ref_pic_sets = br.readUE();
      sps.st_ref_pic_sets = parseShortTermRefPicSets(br, sps.num_short_term_ref_pic_sets, sps.log2_max_pic_order_cnt_lsb_minus4);
      sps.long_term_ref_pics_present_flag = br.readBit();
      if (sps.long_term_ref_pics_present_flag) {
        sps.num_long_term_ref_pics_sps = br.readUE();
        sps.lt_ref_pic = [];
        for (var _i3 = 0; _i3 < sps.num_long_term_ref_pics_sps; _i3++) {
          sps.lt_ref_pic.push({
            lt_ref_pic_poc_lsb_sps: br.readBits(sps.log2_max_pic_order_cnt_lsb_minus4 + 4),
            used_by_curr_pic_lt_sps_flag: br.readBit()
          });
        }
      }
      sps.sps_temporal_mvp_enabled_flag = br.readBit();
      sps.strong_intra_smoothing_enabled_flag = br.readBit();

      // VUI
      sps.vui_parameters_present_flag = br.readBit();
      if (sps.vui_parameters_present_flag) {
        sps.vui = parseVuiParameters(br, sps);
      }

      // Derived width/height after conformance window cropping
      var width = sps.pic_width_in_luma_samples;
      var height = sps.pic_height_in_luma_samples;
      if (sps.conformance_window_flag) {
        var cf = sps.chroma_format_idc;
        var subWidthC = cf === 1 || cf === 2 ? 2 : 1;
        var subHeightC = cf === 1 ? 2 : 1;
        var cropUnitX = subWidthC;
        var cropUnitY = subHeightC;
        width -= (sps.conf_win_left_offset + sps.conf_win_right_offset) * cropUnitX;
        height -= (sps.conf_win_top_offset + sps.conf_win_bottom_offset) * cropUnitY;
      }
      sps.width = width;
      sps.height = height;

      // rbsp_stop_one_bit + trailing_bits are typically outside this parser’s scope;
      // ensure your bitreader consumes emulation prevention bytes and RBSP boundaries correctly elsewhere.
    } catch (e) {
      console.warn("Error parsing H.265 SPS:", e);
    }
    if (sps.profile_tier_level) sps.description = describePTL(sps.profile_tier_level);
    return sps;
  };

  // --- helpers for nested syntax structures ---
  function parseProfileTierLevel(br, maxSubLayersMinus1) {
    var ptl = {};
    ptl.general_profile_space = br.readBits(2);
    ptl.general_tier_flag = br.readBit();
    ptl.general_profile_idc = br.readBits(5);
    ptl.general_profile_compatibility_flags = br.readBits(32);
    ptl.general_progressive_source_flag = br.readBit();
    ptl.general_interlaced_source_flag = br.readBit();
    ptl.general_non_packed_constraint_flag = br.readBit();
    ptl.general_frame_only_constraint_flag = br.readBit();
    // general_reserved_zero_44bits
    ptl.general_reserved_zero_44bits_hi = br.readBits(16);
    ptl.general_reserved_zero_44bits_lo = br.readBits(28);
    ptl.general_level_idc = br.readBits(8);
    ptl.sub_layer_profile_present_flag = [];
    ptl.sub_layer_level_present_flag = [];
    for (var i = 0; i < maxSubLayersMinus1; i++) {
      ptl.sub_layer_profile_present_flag[i] = br.readBit();
      ptl.sub_layer_level_present_flag[i] = br.readBit();
    }
    if (maxSubLayersMinus1 > 0) {
      for (var _i4 = maxSubLayersMinus1; _i4 < 8; _i4++) {
        br.readBits(2); // reserved_zero_2bits
      }
    }
    ptl.sub_layers = [];
    for (var _i5 = 0; _i5 < maxSubLayersMinus1; _i5++) {
      var sl = {};
      if (ptl.sub_layer_profile_present_flag[_i5]) {
        sl.sub_layer_profile_space = br.readBits(2);
        sl.sub_layer_tier_flag = br.readBit();
        sl.sub_layer_profile_idc = br.readBits(5);
        sl.sub_layer_profile_compatibility_flags = br.readBits(32);
        sl.sub_layer_progressive_source_flag = br.readBit();
        sl.sub_layer_interlaced_source_flag = br.readBit();
        sl.sub_layer_non_packed_constraint_flag = br.readBit();
        sl.sub_layer_frame_only_constraint_flag = br.readBit();
        // sub_layer_reserved_zero_44bits
        sl.sub_layer_reserved_zero_44bits_hi = br.readBits(16);
        sl.sub_layer_reserved_zero_44bits_lo = br.readBits(28);
      }
      if (ptl.sub_layer_level_present_flag[_i5]) {
        sl.sub_layer_level_idc = br.readBits(8);
      }
      ptl.sub_layers[_i5] = sl;
    }
    return ptl;
  }
  function parseScalingListData(br) {
    var data = {
      scaling_list: []
    };
    for (var sizeId = 0; sizeId < 4; sizeId++) {
      var matrixNum = sizeId === 3 ? 2 : 6;
      data.scaling_list[sizeId] = [];
      for (var matrixId = 0; matrixId < matrixNum; matrixId++) {
        var scaling_list_pred_mode_flag = br.readBit();
        var entry = {
          scaling_list_pred_mode_flag: scaling_list_pred_mode_flag
        };
        if (!scaling_list_pred_mode_flag) {
          entry.scaling_list_pred_matrix_id_delta = br.readUE();
        } else {
          var coefNum = Math.min(64, 1 << 4 + (sizeId << 1));
          var nextCoef = 8;
          if (sizeId > 1) {
            entry.scaling_list_dc_coef_minus8 = br.readSE();
            nextCoef = entry.scaling_list_dc_coef_minus8 + 8;
          }
          entry.scaling_list = [];
          for (var i = 0; i < coefNum; i++) {
            var delta = br.readSE();
            nextCoef = nextCoef + delta + 256 & 255;
            entry.scaling_list[i] = nextCoef;
          }
        }
        data.scaling_list[sizeId][matrixId] = entry;
      }
    }
    return data;
  }
  function parseShortTermRefPicSets(br, numRps, log2MaxPicOrderCntLsbMinus4) {
    var rps = [];
    var prevRps = null;
    for (var i = 0; i < numRps; i++) {
      var r = {};
      var inter_ref_pic_set_prediction_flag = i !== 0 ? br.readBit() : 0;
      r.inter_ref_pic_set_prediction_flag = inter_ref_pic_set_prediction_flag;
      if (inter_ref_pic_set_prediction_flag) {
        var delta_idx_minus1 = i === 0 ? 0 : br.readUE();
        r.delta_idx_minus1 = delta_idx_minus1;
        r.delta_rps_sign = br.readBit();
        r.abs_delta_rps_minus1 = br.readUE();
        var refRps = rps[i - 1 - delta_idx_minus1];
        var RefNum = (refRps.num_negative_pics || 0) + (refRps.num_positive_pics || 0);
        r.used_by_curr_pic_flag = [];
        r.use_delta_flag = [];
        var totalNeg = 0;
        var totalPos = 0;
        for (var j = 0; j <= RefNum; j++) {
          var used = br.readBit();
          r.used_by_curr_pic_flag.push(used);
          var useDeltaFlag = used ? 1 : br.readBit();
          r.use_delta_flag.push(useDeltaFlag);
        }
        // Derivation of NumNegativePics/NumPositivePics and delta_poc_s0/1 is complex; store flags only
      } else {
        r.num_negative_pics = br.readUE();
        r.num_positive_pics = br.readUE();
        r.delta_poc_s0_minus1 = [];
        r.used_by_curr_pic_s0_flag = [];
        for (var _j = 0; _j < r.num_negative_pics; _j++) {
          r.delta_poc_s0_minus1[_j] = br.readUE();
          r.used_by_curr_pic_s0_flag[_j] = br.readBit();
        }
        r.delta_poc_s1_minus1 = [];
        r.used_by_curr_pic_s1_flag = [];
        for (var _j2 = 0; _j2 < r.num_positive_pics; _j2++) {
          r.delta_poc_s1_minus1[_j2] = br.readUE();
          r.used_by_curr_pic_s1_flag[_j2] = br.readBit();
        }
      }
      rps.push(r);
      prevRps = r;
    }
    return rps;
  }
  function parseVuiParameters(br, sps) {
    var vui = {};
    vui.aspect_ratio_info_present_flag = br.readBit();
    if (vui.aspect_ratio_info_present_flag) {
      vui.aspect_ratio_idc = br.readBits(8);
      if (vui.aspect_ratio_idc === 255) {
        vui.sar_width = br.readBits(16);
        vui.sar_height = br.readBits(16);
      }
    }
    vui.overscan_info_present_flag = br.readBit();
    if (vui.overscan_info_present_flag) {
      vui.overscan_appropriate_flag = br.readBit();
    }
    vui.video_signal_type_present_flag = br.readBit();
    if (vui.video_signal_type_present_flag) {
      vui.video_format = br.readBits(3);
      vui.video_full_range_flag = br.readBit();
      vui.colour_description_present_flag = br.readBit();
      if (vui.colour_description_present_flag) {
        vui.colour_primaries = br.readBits(8);
        vui.transfer_characteristics = br.readBits(8);
        vui.matrix_coeffs = br.readBits(8);
      }
    }
    vui.chroma_loc_info_present_flag = br.readBit();
    if (vui.chroma_loc_info_present_flag) {
      vui.chroma_sample_loc_type_top_field = br.readUE();
      vui.chroma_sample_loc_type_bottom_field = br.readUE();
    }
    vui.neutral_chroma_indication_flag = br.readBit();
    vui.field_seq_flag = br.readBit();
    vui.frame_field_info_present_flag = br.readBit();
    vui.default_display_window_flag = br.readBit();
    if (vui.default_display_window_flag) {
      vui.def_disp_win_left_offset = br.readUE();
      vui.def_disp_win_right_offset = br.readUE();
      vui.def_disp_win_top_offset = br.readUE();
      vui.def_disp_win_bottom_offset = br.readUE();
    }
    vui.vui_timing_info_present_flag = br.readBit();
    if (vui.vui_timing_info_present_flag) {
      vui.vui_num_units_in_tick = br.readBits(32);
      vui.vui_time_scale = br.readBits(32);
      vui.vui_poc_proportional_to_timing_flag = br.readBit();
      if (vui.vui_poc_proportional_to_timing_flag) {
        vui.vui_num_ticks_poc_diff_one_minus1 = br.readUE();
      }
      vui.vui_hrd_parameters_present_flag = br.readBit();
      if (vui.vui_hrd_parameters_present_flag) {
        // hrd_parameters() is extensive; many decoders skip full detail.
        // Parse the presence flags minimally to consume the bitstream.
        var cpbCntMinus1 = [];
        var bitRateScale = br.readBits(4);
        var cpbSizeScale = br.readBits(4);
        var initialCpbRemovalDelayLengthMinus1 = br.readBits(5);
        var auCpbRemovalDelayLengthMinus1 = br.readBits(5);
        var dpbOutputDelayLengthMinus1 = br.readBits(5);
        var subPicHrdParamsPresentFlag = br.readBit();
        var tickDivisorMinus2 = 0;
        var duCpbRemovalDelayLengthMinus1 = 0;
        var dpbOutputDelayDuLengthMinus1 = 0;
        if (subPicHrdParamsPresentFlag) {
          tickDivisorMinus2 = br.readBits(8);
          var duCpbRemovalDelayIncrementLengthMinus1 = br.readBits(5);
          var subPicCpbParamsInPicTimingSeiFlag = br.readBit();
          duCpbRemovalDelayLengthMinus1 = br.readBits(5);
          dpbOutputDelayDuLengthMinus1 = br.readBits(5);
        }
        var fixedPicRateGeneralFlag = [];
        var fixedPicRateWithinCvsFlag = [];
        var lowDelayHrdFlag = [];
        var elementalDurationInTcMinus1 = [];
        for (var i = 0; i <= sps.sps_max_sub_layers_minus1; i++) {
          fixedPicRateGeneralFlag[i] = br.readBit();
          var fixedRate = false;
          if (!fixedPicRateGeneralFlag[i]) {
            fixedPicRateWithinCvsFlag[i] = br.readBit();
            fixedRate = fixedPicRateWithinCvsFlag[i];
          } else {
            fixedRate = true;
          }
          if (fixedRate) {
            elementalDurationInTcMinus1[i] = br.readUE();
          } else {
            lowDelayHrdFlag[i] = br.readBit();
          }
          cpbCntMinus1[i] = br.readUE();
          var nalHrdParametersPresentFlag = br.readBit();
          var vclHrdParametersPresentFlag = br.readBit();
          for (var _i6 = 0, _arr = [nalHrdParametersPresentFlag, vclHrdParametersPresentFlag]; _i6 < _arr.length; _i6++) {
            var presentFlag = _arr[_i6];
            if (presentFlag) {
              for (var j = 0; j <= cpbCntMinus1[i]; j++) {
                br.readUE(); // bit_rate_value_minus1
                br.readUE(); // cpb_size_value_minus1
                if (subPicHrdParamsPresentFlag) {
                  br.readUE(); // cpb_size_du_value_minus1
                  br.readUE(); // bit_rate_du_value_minus1
                }
                br.readBit(); // cbr_flag
              }
            }
          }
        }
        vui.hrd = {
          bitRateScale: bitRateScale,
          cpbSizeScale: cpbSizeScale,
          initialCpbRemovalDelayLengthMinus1: initialCpbRemovalDelayLengthMinus1,
          auCpbRemovalDelayLengthMinus1: auCpbRemovalDelayLengthMinus1,
          dpbOutputDelayLengthMinus1: dpbOutputDelayLengthMinus1,
          subPicHrdParamsPresentFlag: subPicHrdParamsPresentFlag,
          tickDivisorMinus2: tickDivisorMinus2,
          duCpbRemovalDelayLengthMinus1: duCpbRemovalDelayLengthMinus1,
          dpbOutputDelayDuLengthMinus1: dpbOutputDelayDuLengthMinus1
        };
      }
    }
    vui.bitstream_restriction_flag = br.readBit();
    if (vui.bitstream_restriction_flag) {
      vui.tiles_fixed_structure_flag = br.readBit();
      vui.motion_vectors_over_pic_boundaries_flag = br.readBit();
      vui.restricted_ref_pic_lists_flag = br.readBit();
      vui.min_spatial_segmentation_idc = br.readUE();
      vui.max_bytes_per_pic_denom = br.readUE();
      vui.max_bits_per_min_cu_denom = br.readUE();
      vui.log2_max_mv_length_horizontal = br.readUE();
      vui.log2_max_mv_length_vertical = br.readUE();
    }
    return vui;
  }
  function describePTL(ptl) {
    var profiles = {
      1: "Main",
      2: "Main 10",
      3: "Main Still Picture",
      4: "Range Extensions",
      5: "High Throughput 4:4:4",
      6: "Multiview Main",
      7: "Scalable Main",
      8: "3D Main",
      9: "Screen-Extended Main",
      10: "Screen-Extended Main 10",
      11: "Screen-Extended 4:4:4"
    };
    var profile = profiles[ptl.general_profile_idc] || "Profile ".concat(ptl.general_profile_idc);
    var tier = ptl.general_tier_flag ? "High" : ""; // ptl.general_tier_flag ? "High" : "Main";
    var level = (ptl.general_level_idc / 30).toFixed(1);
    return profile + " L" + level + " " + (tier ? tier + " Tier" : "");
  }

  //// HEVC (H.265) Picture Parameter Set (PPS) parser (ISO/IEC 23008-2 / ITU-T H.265)
  //// Spec-compliant skeleton with full fields, conditionals, tiles, deblocking,
  //// scaling list parsing, PPS extensions, and RBSP trailing bits.
  ///**
  // * Parse PPS NAL Unit from H.265 stream
  // * @param {Uint8Array} nalUnit - Raw PPS NAL unit payload (without start code)
  // * @returns {Object} Parsed PPS fields
  // */
  //this.parsePPS = function (nalUnit)
  //{
  //	const br = new UI3BitReader(nalUnit);
  //	const pps = { h265: true };

  //	try
  //	{
  //		// 1) Parse NALU header and verify PPS type (34 in HEVC for PPS NAL units).
  //		const nalu = parseH265NALUHeader(br);
  //		pps.nalu = nalu;
  //		// Optional: validate nal_unit_type if you only feed PPS NALs here
  //		// if (nalu.nal_unit_type !== 34) { throw new Error('Not a PPS NALU'); }

  //		// 2) PPS syntax (as per standard sequence)
  //		pps.pps_pic_parameter_set_id = br.readUE();
  //		pps.pps_seq_parameter_set_id = br.readUE();
  //		pps.dependent_slice_segments_enabled_flag = br.readBit();
  //		pps.output_flag_present_flag = br.readBit();
  //		pps.num_extra_slice_header_bits = br.readBits(3);
  //		pps.sign_data_hiding_enabled_flag = br.readBit();
  //		pps.cabac_init_present_flag = br.readBit();
  //		pps.num_ref_idx_l0_default_active_minus1 = br.readUE();
  //		pps.num_ref_idx_l1_default_active_minus1 = br.readUE();
  //		pps.init_qp_minus26 = br.readSE();
  //		pps.constrained_intra_pred_flag = br.readBit();
  //		pps.transform_skip_enabled_flag = br.readBit();
  //		pps.cu_qp_delta_enabled_flag = br.readBit();

  //		if (pps.cu_qp_delta_enabled_flag)
  //		{
  //			pps.diff_cu_qp_delta_depth = br.readUE();
  //		}

  //		pps.pps_cb_qp_offset = br.readSE();
  //		pps.pps_cr_qp_offset = br.readSE();
  //		pps.pps_slice_chroma_qp_offsets_present_flag = br.readBit();
  //		pps.weighted_pred_flag = br.readBit();
  //		pps.weighted_bipred_flag = br.readBit();
  //		pps.transquant_bypass_enabled_flag = br.readBit();
  //		pps.tiles_enabled_flag = br.readBit();
  //		pps.entropy_coding_sync_enabled_flag = br.readBit();

  //		// Tiles block
  //		if (pps.tiles_enabled_flag)
  //		{
  //			pps.num_tile_columns_minus1 = br.readUE();
  //			pps.num_tile_rows_minus1 = br.readUE();
  //			pps.uniform_spacing_flag = br.readBit();

  //			const numCols = (pps.num_tile_columns_minus1 || 0) + 1;
  //			const numRows = (pps.num_tile_rows_minus1 || 0) + 1;

  //			if (!pps.uniform_spacing_flag)
  //			{
  //				pps.column_width_minus1 = [];
  //				pps.row_height_minus1 = [];
  //				for (let i = 0; i < numCols - 1; i++)
  //				{
  //					pps.column_width_minus1[i] = br.readUE();
  //				}
  //				for (let j = 0; j < numRows - 1; j++)
  //				{
  //					pps.row_height_minus1[j] = br.readUE();
  //				}
  //			}

  //			pps.loop_filter_across_tiles_enabled_flag = br.readBit();
  //		}

  //		pps.pps_loop_filter_across_slices_enabled_flag = br.readBit();

  //		// Deblocking filter control
  //		pps.deblocking_filter_control_present_flag = br.readBit();
  //		if (pps.deblocking_filter_control_present_flag)
  //		{
  //			pps.deblocking_filter_override_enabled_flag = br.readBit();
  //			pps.pps_deblocking_filter_disabled_flag = br.readBit();
  //			if (!pps.pps_deblocking_filter_disabled_flag)
  //			{
  //				pps.pps_beta_offset_div2 = br.readSE();
  //				pps.pps_tc_offset_div2 = br.readSE();
  //			}
  //		}

  //		// Scaling lists
  //		pps.pps_scaling_list_data_present_flag = br.readBit();
  //		if (pps.pps_scaling_list_data_present_flag)
  //		{
  //			pps.scaling_list_data = readScalingListData(br);
  //		}

  //		// Other slice/header-related fields
  //		pps.lists_modification_present_flag = br.readBit();
  //		pps.log2_parallel_merge_level_minus2 = br.readUE();
  //		pps.slice_segment_header_extension_present_flag = br.readBit();

  //		// PPS extension flags and payload
  //		pps.pps_extension_present_flag = br.readBit();
  //		if (pps.pps_extension_present_flag)
  //		{
  //			readPpsExtensions(br, pps);
  //		}

  //		// 3) RBSP trailing bits (consume stop-one-bit and alignment zeros)
  //		readRbspTrailingBits(br);

  //	} catch (e)
  //	{
  //		console.warn('Error parsing H.265 PPS:', e);
  //		pps.error = String(e && e.message ? e.message : e);
  //	}

  //	return pps;
  //}
  //function parseH265NALUHeader(br)
  //{
  //	// HEVC NALU header:
  //	// forbidden_zero_bit: 1 bit
  //	// nal_unit_type: 6 bits
  //	// nuh_layer_id: 6 bits
  //	// nuh_temporal_id_plus1: 3 bits
  //	const forbidden_zero_bit = br.readBit();
  //	const nal_unit_type = br.readBits(6);
  //	const nuh_layer_id = br.readBits(6);
  //	const nuh_temporal_id_plus1 = br.readBits(3);

  //	return {
  //		forbidden_zero_bit,
  //		nal_unit_type,
  //		nuh_layer_id,
  //		nuh_temporal_id_plus1
  //	};
  //}

  //// Helper: RBSP trailing bits (stop bit + alignment zero bits).
  //function readRbspTrailingBits(br)
  //{
  //	// rbsp_stop_one_bit (shall be '1')
  //	const stopBit = br.readBit();
  //	// then zero bits until the next byte boundary
  //	// If your reader tracks bit position, this can be a no-op, but we consume zero bits explicitly.
  //	while (br.bitsUntilByteAligned && br.bitsUntilByteAligned() !== 0)
  //	{
  //		const pad = br.readBit();
  //		// Spec says these must be zero. We don't hard-fail but you may choose to assert here.
  //	}
  //	return { stopBit };
  //}

  //// Helper: "more_rbsp_data" check.
  //// If your bitreader exposes this, use it. Otherwise, conservatively read until stop_one_bit encountered.
  //// Here we implement a pragmatic approach: we peek until next '1' stop bit at the end of rbsp.
  //function moreRbspData(br)
  //{
  //	// If your UI3BitReader can tell remaining bits excluding trailing, prefer that.
  //	// As a safe fallback, we use remaining bits > 8 to indicate more data; tweak as needed.
  //	return typeof br.bitsRemaining === 'function'
  //		? br.bitsRemaining() > 8
  //		: true; // fallback if unknown; caller should guard with known lengths in container contexts
  //}

  //// PPS range/multilayer/3D/extension parsing (payload is syntax-dependent and often not used).
  //// We expose flags and consume extension bits conservatively to avoid desync.
  //function readPpsExtensions(br, pps)
  //{
  //	// Spec: if (pps_extension_present_flag) {
  //	//   pps_range_extension_flag
  //	//   pps_multilayer_extension_flag
  //	//   pps_3d_extension_flag
  //	//   pps_extension_5bits
  //	//   if (pps_range_extension_flag) { pps_range_extension() }
  //	//   if (pps_multilayer_extension_flag) { pps_multilayer_extension() }
  //	//   if (pps_3d_extension_flag) { pps_3d_extension() }
  //	//   if (pps_extension_5bits) {
  //	//     while (more_rbsp_data()) { pps_extension_data_flag; }
  //	//   }
  //	// }
  //	pps.pps_range_extension_flag = br.readBit();
  //	pps.pps_multilayer_extension_flag = br.readBit();
  //	pps.pps_3d_extension_flag = br.readBit();
  //	pps.pps_extension_5bits = br.readBits(5);

  //	// Range extension syntax (if needed): placeholder
  //	if (pps.pps_range_extension_flag)
  //	{
  //		// Implement per H.265 Range Extensions if targets require it.
  //		pps.range_extension = { /* parse fields as per RExt */ };
  //	}

  //	// Multilayer extension syntax: placeholder
  //	if (pps.pps_multilayer_extension_flag)
  //	{
  //		pps.multilayer_extension = { /* parse multilayer PPS extension */ };
  //	}

  //	// 3D extension syntax: placeholder
  //	if (pps.pps_3d_extension_flag)
  //	{
  //		pps.three_d_extension = { /* parse 3D PPS extension */ };
  //	}

  //	// Vendor/proprietary or future extension area: consume remaining flags until trailing bits.
  //	if (pps.pps_extension_5bits)
  //	{
  //		pps.extension_data = [];
  //		while (moreRbspData(br))
  //		{
  //			// Per spec this is a sequence of flags; commonly just padding or reserved
  //			const flag = br.readBit();
  //			pps.extension_data.push(flag);
  //			// Break safety to avoid infinite loops in pathological streams
  //			if (pps.extension_data.length > 1024) break;
  //		}
  //	}
  //}

  //// Scaling list syntax (pps_scaling_list_data_present_flag).
  //// This is full spec-compatible parsing for PPS scaling lists.
  //function readScalingListData(br)
  //{
  //	// HEVC scaling lists cover sizes [4x4, 8x8, 16x16, 32x32] and matrix counts per size.
  //	// sizeId 0..3 => 4x4, 8x8, 16x16, 32x32
  //	// matrixId count per size: (sizeId === 3 ? 2 : 6)
  //	// For each matrix: scaling_list_pred_mode_flag
  //	// if pred_mode == 0: scaling_list_pred_matrix_id_delta
  //	// else: parse coeffs with delta, possibly scaling_list_dc_coef for sizeId >= 2
  //	const scalingList = { lists: [] };

  //	for (let sizeId = 0; sizeId <= 3; sizeId++)
  //	{
  //		const numMatrices = (sizeId === 3) ? 2 : 6;
  //		scalingList.lists[sizeId] = [];
  //		for (let matrixId = 0; matrixId < numMatrices; matrixId++)
  //		{
  //			const scaling_list_pred_mode_flag = br.readBit();
  //			const entry = { sizeId, matrixId, scaling_list_pred_mode_flag };

  //			if (scaling_list_pred_mode_flag === 0)
  //			{
  //				// Predicted from another matrix
  //				entry.scaling_list_pred_matrix_id_delta = br.readUE();
  //			} else
  //			{
  //				// Explicit coefficients
  //				const coefNum = Math.min(64, 1 << (4 + (sizeId << 1))); // per spec
  //				let nextCoef = 8; // default per spec
  //				if (sizeId >= 2)
  //				{
  //					entry.scaling_list_dc_coef_minus8 = br.readSE();
  //					nextCoef = entry.scaling_list_dc_coef_minus8 + 8;
  //				}
  //				entry.scaling_list = [];

  //				for (let i = 0; i < coefNum; i++)
  //				{
  //					const scaling_list_delta_coef = br.readSE();
  //					nextCoef = (nextCoef + scaling_list_delta_coef + 256) % 256; // wrap
  //					entry.scaling_list.push(nextCoef);
  //				}
  //			}
  //			scalingList.lists[sizeId][matrixId] = entry;
  //		}
  //	}

  //	return scalingList;
  //}

  ///**
  // * Extract QP from an HEVC slice NAL. Returns { qp } only if a non-dependent slice
  // * header contains slice_qp_delta; otherwise returns null.
  // * 
  // * This method is AI-generated and doesn't deliver the correct QP value currently, possibly due to inadequate SPS and PPS parsing by other functions in this object.  This stuff is incredibly overcomplicated.
  // *
  // * @param {Uint8Array} nal - Raw NAL unit bytes (Annex B unit payload, without start code).
  // * @param {Object} sps - Minimal SPS context (see doc).
  // * @param {Object} pps - Minimal PPS context (see doc).
  // * @returns {{qp:number}|null}
  // */
  //this.parseQPFromNAL = function (nal, sps, pps)
  //{
  //	if (!(nal instanceof Uint8Array))
  //		throw new Error("nal must be Uint8Array");
  //	if (!sps || !pps)
  //		throw new Error("SPS and PPS contexts are required");

  //	// Parse NAL header (HEVC: first 2 bytes; nal_unit_type is 6 bits)
  //	if (nal.length < 2)
  //		return null;
  //	const nalUnitType = (nal[0] >>> 1) & 0x3F; // 0..63
  //	const nuhLayerId = ((nal[0] & 0x01) << 5) | ((nal[1] >>> 3) & 0x1F);
  //	const nuhTemporalIdPlus1 = nal[1] & 0x07;
  //	// Only VCL slices 0..31 can carry slice headers with QP
  //	if (nalUnitType > 31)
  //		return null;

  //	const br = new UI3BitReader(nal);
  //	br.skipBits(16); // Skip NALU header (2 bytes for H.265)

  //	// HEVC 7.3.6 slice_segment_header parsing up to slice_qp_delta
  //	// first_slice_segment_in_pic_flag
  //	const first_slice_segment_in_pic_flag = br.readBits(1) === 1;

  //	// For not-first slices: slice_segment_address is ue(v)
  //	if (!first_slice_segment_in_pic_flag)
  //	{
  //		br.readUE(); // slice_segment_address
  //	}

  //	// IRAP picture types are 16..23; for those, no_output_of_prior_pics_flag present
  //	const isIRAP = nalUnitType >= 16 && nalUnitType <= 23;
  //	if (isIRAP && pps.output_flag_present_flag)
  //	{
  //		br.readBits(1); // no_output_of_prior_pics_flag
  //	}

  //	// num_extra_slice_header_bits
  //	const numExtra = pps.num_extra_slice_header_bits >>> 0;
  //	for (let i = 0; i < numExtra; i++)
  //	{
  //		br.readBits(1); // slice_reserved_flag[ i ]
  //	}

  //	// dependent_slice_segments_enabled_flag path:
  //	const dependent_slice_segment_flag = pps.dependent_slice_segments_enabled_flag
  //		? br.readBits(1) === 1
  //		: false;

  //	// slice_type (ue(v)) present for both dependent/non-dependent
  //	const slice_type = br.readUE(); // 0=P, 1=B, 2=I

  //	// If dependent slice, slice_qp_delta is NOT present => return null
  //	if (dependent_slice_segment_flag)
  //	{
  //		return null;
  //	}

  //	// pic_output_flag if output_flag_present_flag
  //	if (pps.output_flag_present_flag)
  //	{
  //		br.readBits(1); // pic_output_flag
  //	}

  //	// Redundant picture count for I-slices only (rare, typically 0) — not signalled in HEVC
  //	// HEVC does not have H.264-style redundant_pic_cnt for slices, so nothing here.

  //	// POC LSB for non-IDR (per spec: for non-IRAP? In HEVC, slice_pic_order_cnt_lsb is present
  //	// for all non-IDR-TFD? To keep spec-compliant, gate by SPS field and IRAP rules.)
  //	// Conservative approach: only read if sps.log2_max_pic_order_cnt_lsb_minus4 is defined
  //	// and nalUnitType is not IDR_W_RADL/IDR_N_LP (19/20). For simplicity, skip unless caller requests.
  //	// If you need strict parsing, set sps.read_poc_lsb = true and provide log2 value.
  //	if (sps.read_poc_lsb)
  //	{
  //		const bits = (sps.log2_max_pic_order_cnt_lsb_minus4 + 4) >>> 0;
  //		br.readBits(bits);
  //	}

  //	// Short-term and long-term refs presence depends on SPS/flags.
  //	// We conservatively allow caller to skip these by default. If enabled, we parse the structures
  //	// to correctly position the reader.
  //	if (sps.parse_strp_in_slice_header)
  //	{
  //		parseShortTermRefs(br, sps);
  //	}
  //	//if (sps.long_term_ref_pics_present_flag && sps.parse_ltrp_in_slice_header)
  //	if (sps.long_term_ref_pics_present_flag && pps.slice_segment_header_extension_present_flag)
  //	{
  //		parseLongTermRefs(br, sps);
  //	}

  //	// temporal MVP flag
  //	if (sps.sps_temporal_mvp_enabled_flag)
  //	{
  //		br.readBits(1); // slice_temporal_mvp_enabled_flag
  //	}

  //	// slice_qp_delta is reached after (optional) cabac_init_idc and chroma qp offsets
  //	// The branch conditions ahead:
  //	// - pps.cabac_init_present_flag => slice_cb_qp_offset fields follow later, but
  //	//   cabac_init_idc precedes slice_qp_delta.
  //	if (pps.cabac_init_present_flag)
  //	{
  //		br.readUE(); // cabac_init_idc
  //	}

  //	// Now the target:
  //	const slice_qp_delta = br.readSE(); // signed Exp-Golomb

  //	//// Chroma QP offsets (don’t affect QP parsing, but keep reader correct if enabled)
  //	//if (pps.pps_slice_chroma_qp_offsets_present_flag)
  //	//{
  //	//	br.readSE(); // slice_cb_qp_offset
  //	//	br.readSE(); // slice_cr_qp_offset
  //	//}

  //	//// Deblocking filter override and flags
  //	//if (pps.deblocking_filter_override_enabled_flag)
  //	//{
  //	//	const deblocking_filter_override_flag = br.readBits(1) === 1;
  //	//	if (deblocking_filter_override_flag)
  //	//	{
  //	//		const slice_deblocking_filter_disabled_flag = pps.pps_deblocking_filter_disabled_flag
  //	//			? br.readBits(1) === 1
  //	//			: false;
  //	//		if (!slice_deblocking_filter_disabled_flag)
  //	//		{
  //	//			br.readSE(); // slice_beta_offset_div2
  //	//			br.readSE(); // slice_tc_offset_div2
  //	//		}
  //	//	}
  //	//}

  //	//// Loop filter across slices flag
  //	//br.readBits(1); // slice_loop_filter_across_slices_flag (signalled if PPS enabled globally)
  //	//// Note: If PPS disables loop filter across slices globally, spec may omit this flag.
  //	//// If you need strict gating, add pps.pps_loop_filter_across_slices_enabled_flag guard.

  //	// Compute final QP
  //	const qp = 26 + (pps.pps_init_qp_minus26 | 0) + slice_qp_delta;
  //	return { qp };
  //}

  ///* Optional detailed ref parsing when enabled via SPS flags */
  //function parseShortTermRefs(br, sps)
  //{
  //	// short-term refs in slice: num_ref_idx_active_override_flag and lists
  //	// Minimal compliance: read flags and counts without building lists
  //	const num_ref_idx_active_override_flag = br.readBits(1) === 1;
  //	if (num_ref_idx_active_override_flag)
  //	{
  //		br.readUE(); // num_ref_idx_l0_active_minus1
  //		br.readUE(); // num_ref_idx_l1_active_minus1 (for B-slices; harmless if present)
  //	}
  //}

  //function parseLongTermRefs(br, sps)
  //{
  //	// Minimal placeholder: in full spec you parse lt_cnt and signalled POC/msb flags
  //	// We provide a conservative reader to keep bit alignment if enabled.
  //	const num_long_term_sps = br.readUE();
  //	const num_long_term_pics = br.readUE();
  //	const total = num_long_term_sps + num_long_term_pics;
  //	for (let i = 0; i < total; i++)
  //	{
  //		const bits = (sps.log2_max_pic_order_cnt_lsb_minus4 + 4) >>> 0;
  //		br.readBits(bits);      // lt_poc_lsb
  //		br.readBits(1);         // used_by_curr_pic_lt_flag
  //		br.readBits(1);         // delta_poc_msb_present_flag
  //		// If delta_poc_msb_present_flag, parse SE delta; spec uses ue/se depending on path.
  //		// For robustness, assume ue here; change to SE if your stream requires.
  //		// br.readUE(); // delta_poc_msb_cycle_lt[i]
  //	}
  //}
}();
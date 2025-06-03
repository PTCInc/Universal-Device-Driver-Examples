/*****************************************************************************
 * 
 * This file is copyright (c) PTC, Inc.
 * All rights reserved.
 * 
 * Name: base64 encode and decode.js
 * NOTE: Made with LLM + source at https://mathiasbynens/base64 
 * Example uses:
 * -- Encode: base64(<inputString>, encode = true)
 * -- Decode: base64(<inputString>, encode = false)
 * 
 * Update History:
 * 0.0.1:   Initial Release
 * 
 * Version: 0.0.1
******************************************************************************/

function base64(input, encode = true) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  const InvalidCharacterError = function (message) {
    this.message = message;
  };
  InvalidCharacterError.prototype = new Error();
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  const btoa = function (input) {
    let str = String(input);
    let output = '';
    for (
      let block, charCode, idx = 0, map = chars;
      str.charAt(idx | 0) || (map = '=', idx % 1);
      output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
    ) {
      charCode = str.charCodeAt((idx += 3 / 4));
      if (charCode > 0xff) {
        throw new InvalidCharacterError(
          "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
        );
      }
      block = (block << 8) | charCode;
    }
    return output;
  };

  const atob = function (input) {
    let str = String(input).replace(/=+$/, '');
    if (str.length % 4 == 1) {
      throw new InvalidCharacterError(
        "'atob' failed: The string to be decoded is not correctly encoded."
      );
    }
    let output = '';
    for (
      let bc = 0, bs, buffer, idx = 0;
      (buffer = str.charAt(idx++));
      ~buffer &&
      ((bs = bc % 4 ? bs * 64 + buffer : buffer),
      bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  };

  return encode ? btoa(input) : atob(input);
}
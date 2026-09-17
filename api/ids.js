// Unguessable short ids for tiny links and images.
//
// Both are served by public GETs, so an id is the only thing between a stranger and
// the content. Math.random is not a CSPRNG — its output can be predicted from a few
// earlier values — so ids come from crypto.randomBytes.
//
// Bytes ≥ 252 are discarded rather than folded in with `% 36`: 256 is not a multiple
// of 36, and folding would make the first four characters slightly more likely.

const crypto = require('crypto');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const UNBIASED_LIMIT = 252;   // largest multiple of 36 below 256

function randomId(length) {
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte < UNBIASED_LIMIT && out.length < length) out += ALPHABET[byte % 36];
    }
  }
  return out;
}

module.exports = { randomId };

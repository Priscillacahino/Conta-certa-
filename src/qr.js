// QR Code byte-mode encoder for short Conta Certa validation payloads.
// Fixed QR version 4-L (33x33, 80 data codewords, 20 EC codewords).
// The implementation is local/offline and intentionally scoped to payloads <= 78 Latin-1/ASCII bytes.

const VERSION = 4;
const SIZE = 17 + 4 * VERSION;
const DATA_CODEWORDS = 80;
const EC_CODEWORDS = 20;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i += 1) {
  GF_EXP[i] = x;
  GF_LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) GF_EXP[i] = GF_EXP[i - 255];

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function generatorPolynomial(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

const GENERATOR = generatorPolynomial(EC_CODEWORDS);

function reedSolomon(data) {
  const rem = new Array(EC_CODEWORDS).fill(0);
  for (const value of data) {
    const factor = value ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let i = 0; i < EC_CODEWORDS; i += 1) rem[i] ^= gfMul(GENERATOR[i + 1], factor);
    }
  }
  return rem;
}

function bytesFromText(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code > 255) throw new RangeError('QR suporta apenas caracteres Latin-1 no payload de validação');
    bytes.push(code);
  }
  return bytes;
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function makeDataCodewords(text) {
  const bytes = bytesFromText(text);
  if (bytes.length > 78) throw new RangeError('Payload de QR excede a capacidade segura da versão 4-L');
  const bits = [];
  pushBits(bits, 0b0100, 4); // byte mode
  pushBits(bits, bytes.length, 8); // version 1-9 byte count
  for (const byte of bytes) pushBits(bits, byte, 8);
  const capacityBits = DATA_CODEWORDS * 8;
  for (let i = 0; i < Math.min(4, capacityBits - bits.length); i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  let pad = true;
  while (data.length < DATA_CODEWORDS) {
    data.push(pad ? 0xec : 0x11);
    pad = !pad;
  }
  return data;
}

function bchDigit(data) {
  let digit = 0;
  while (data !== 0) { digit += 1; data >>>= 1; }
  return digit;
}

function bchTypeInfo(data) {
  const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
  const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
}

function setFinder(modules, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) continue;
      const black = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      modules[rr][cc] = black;
    }
  }
}

function setAlignment(modules, row, col) {
  if (modules[row][col] != null) return;
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      modules[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
    }
  }
}

function setTiming(modules) {
  for (let i = 8; i < SIZE - 8; i += 1) {
    if (modules[i][6] == null) modules[i][6] = i % 2 === 0;
    if (modules[6][i] == null) modules[6][i] = i % 2 === 0;
  }
}

function setTypeInfo(modules, maskPattern) {
  // Error correction level L = 01 in the qrcode.js numeric convention (1).
  const bits = bchTypeInfo((1 << 3) | maskPattern);
  for (let i = 0; i < 15; i += 1) {
    const mod = ((bits >>> i) & 1) === 1;
    if (i < 6) modules[i][8] = mod;
    else if (i < 8) modules[i + 1][8] = mod;
    else modules[SIZE - 15 + i][8] = mod;
  }
  for (let i = 0; i < 15; i += 1) {
    const mod = ((bits >>> i) & 1) === 1;
    if (i < 8) modules[8][SIZE - i - 1] = mod;
    else if (i < 9) modules[8][15 - i] = mod;
    else modules[8][15 - i - 1] = mod;
  }
  modules[SIZE - 8][8] = true;
}

function mask0(row, col) { return (row + col) % 2 === 0; }

function mapData(modules, codewords) {
  let bitIndex = 0;
  let row = SIZE - 1;
  let direction = -1;
  for (let col = SIZE - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let c = 0; c < 2; c += 1) {
        const cc = col - c;
        if (modules[row][cc] != null) continue;
        const byteIndex = Math.floor(bitIndex / 8);
        const shift = 7 - (bitIndex % 8);
        let bit = byteIndex < codewords.length ? ((codewords[byteIndex] >>> shift) & 1) === 1 : false;
        if (mask0(row, cc)) bit = !bit;
        modules[row][cc] = bit;
        bitIndex += 1;
      }
      row += direction;
      if (row < 0 || row >= SIZE) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }
}

export function qrMatrix(text) {
  const data = makeDataCodewords(text);
  const ecc = reedSolomon(data);
  const codewords = [...data, ...ecc];
  const modules = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  setFinder(modules, 0, 0);
  setFinder(modules, SIZE - 7, 0);
  setFinder(modules, 0, SIZE - 7);
  setAlignment(modules, 26, 26);
  setTiming(modules);
  setTypeInfo(modules, 0);
  mapData(modules, codewords);
  return modules.map(row => row.map(Boolean));
}

export function qrPayload({ certificateId, verificationCode, contentHash }) {
  return `CC1|${certificateId}|${verificationCode}|${String(contentHash).slice(0, 16)}`;
}

export const QR_SIZE = SIZE;

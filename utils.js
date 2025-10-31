import crypto from "node:crypto";

export function sha256d(payload) {
    return sha256(sha256(payload));
}

export function sha256(payload) {
    return crypto.createHash('sha256').update(payload).digest();
}

export function hexDump(buffer) {
    const bytesPerLine = 16;
    let out = '';

    for (let offset = 0; offset < buffer.length; offset += bytesPerLine) {
        //it is safe to slice longer than buffer length, it just clamps
        const slice = buffer.slice(offset, offset + bytesPerLine);
        const hex = Array.from(slice)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
            .padEnd(3 * bytesPerLine - 1, ' ');
        const ascii = Array.from(slice)
        .map(b => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
        .join('');
        out += `${offset.toString(16).padStart(8, '0')}  ${hex}  ${ascii}\n`;
  }

  return out;
}

export function nonceBigUInt64() {
    return crypto.randomBytes(8).readBigUInt64LE()
}
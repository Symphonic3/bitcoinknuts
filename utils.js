import crypto from "node:crypto";

export function sha256d(payload) {
    return sha256(sha256(payload));
}

export function sha256(payload) {
    return crypto.createHash('sha256').update(payload).digest();
}
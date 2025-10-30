import { connectIPv4 } from "./peer.js";
import { resolve4 } from 'dns/promises';

const peers = new Set();

export async function initPeersAsync(count) {
    for (let i = 0; i < count; i++) {
        peers.add(await getPeerAsync());
    }
}

async function terminatorAsync(peer) {
    peers.delete(peer);
    peers.add(await getPeerAsync());
}

async function getPeerAsync() {
    const addresses = await resolve4("seed.btc.petertodd.org");
    const host = addresses[0]; //TODO replace this with a peerdb
    return connectIPv4(host, 8333, terminatorAsync);
}
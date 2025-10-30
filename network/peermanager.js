import { connectIPv4 } from "./peer.js";
import { resolve4 } from 'dns/promises';

const peers = [];

export async function initPeersAsync(count) {
    const offset = peers.length;
    for (let i = 0; i < count; i++) {
        peers.push(await getPeerAsync(makeTerminator(offset + i)));
    }
}

function makeTerminator(n) {
    async function terminatorAsync() {
        peers[n] = await getPeerAsync(terminatorAsync);
    }
    return terminatorAsync;
}

async function getPeerAsync(terminatorAsync) {
    const addresses = await resolve4("seed.btc.petertodd.org");
    const host = addresses[0]; //TODO replace this with a peerdb
    return connectIPv4(host, 8333, terminatorAsync);
}
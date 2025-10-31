import { getFirstPeer, initPeersAsync } from './network/peer.js';

async function bitcoin() {
    await initPeersAsync(1);
}

bitcoin();



const GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";

const peer = await new Promise((resolve, reject) => {
    const poll = setInterval(() => {
        let peer = getFirstPeer(peer => peer.ver && peer.verack); //indicates an initialized peer
        if (peer) {
            clearInterval(poll);
            resolve(peer);
        }
    }, 100);
});
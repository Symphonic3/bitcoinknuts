import { initPeersAsync } from './network/peermanager.js';

async function bitcoin() {
    await initPeersAsync(2);
}

const GENESIS_HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";



bitcoin();
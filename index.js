import { initPeersAsync } from './network/peermanager.js';

async function bitcoin() {
    await initPeersAsync(2);
}

bitcoin();
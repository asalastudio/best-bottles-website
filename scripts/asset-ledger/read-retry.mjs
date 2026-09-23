// Retry only transient read failures. Exhausted reads still fail the ledger build.
const transient = error => error?.name === 'TimeoutError' ||
    ['ETIMEDOUT','ECONNRESET','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET'].includes(error?.code ?? error?.cause?.code) ||
    (error instanceof TypeError && error.message === 'fetch failed');

export async function retryLedgerRead(read, {attempts=3, wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
    for(let attempt=1; ; attempt++) {
        try {return await read();}
        catch(error) {
            if(attempt>=attempts || !transient(error))throw error;
            await wait(250*attempt);
        }
    }
}

export const timedLedgerFetch = (input, init={}) => fetch(input, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
});

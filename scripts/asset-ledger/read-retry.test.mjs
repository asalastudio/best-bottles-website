import test from 'node:test';
import assert from 'node:assert/strict';
import {retryLedgerRead} from './read-retry.mjs';

test('a transient read retries and retains the actual result',async()=>{
    let calls=0;const waits=[];
    const result=await retryLedgerRead(async()=>{
        if(++calls===1)throw new TypeError('fetch failed',{cause:{code:'ETIMEDOUT'}});
        return {present:true};
    },{wait:async ms=>waits.push(ms)});
    assert.deepEqual(result,{present:true});assert.equal(calls,2);assert.deepEqual(waits,[250]);
});
test('exhausted read failures fail closed rather than becoming missing records',async()=>{
    let calls=0;const error=new TypeError('fetch failed');
    await assert.rejects(retryLedgerRead(async()=>{calls++;throw error;},{wait:async()=>{}}),e=>e===error);
    assert.equal(calls,3);
});
test('catalog validation errors are not retried',async()=>{
    let calls=0;const error=new Error('Invalid product identity');
    await assert.rejects(retryLedgerRead(async()=>{calls++;throw error;},{wait:async()=>{}}),e=>e===error);
    assert.equal(calls,1);
});

import {test} from "node:test";
import assert from "node:assert/strict";
import {applyCommand,makeSeed} from "../src/lib/domain";
import {activeHeadMassage} from "../src/lib/home-activity";
const now="2026-09-26T12:00:00.000Z";
test("head massage is derived only from accepted unexpired timers without modifying profiles",()=>{
 for(const owner of ["blue","red"] as const){
 let s=makeSeed();const profiles=structuredClone(s.profiles);const id=crypto.randomUUID();
 s=applyCommand(s,{type:"coupon.request",id:"demo-"+owner+"-0",requestId:id},owner,now);
 assert.equal(activeHeadMassage(s.couponUses,Date.parse(now)),undefined);
 s=applyCommand(s,{type:"coupon.accept",id},owner==="blue"?"red":"blue",now);
 assert.equal(activeHeadMassage(s.couponUses,Date.parse(now))?.owner,owner);
 assert.equal(activeHeadMassage(s.couponUses,Date.parse(s.couponUses[0].endsAt!)),undefined);
 assert.equal(activeHeadMassage([{...s.couponUses[0],title:"按摩肩膀卡"}],Date.parse(now)),undefined);
 s=applyCommand(s,{type:"coupon.cancel",id,reason:""},owner,now);
 assert.equal(activeHeadMassage(s.couponUses,Date.parse(now)),undefined);
 assert.deepEqual(s.profiles,profiles);
 }
});

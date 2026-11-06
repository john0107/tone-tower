import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFloorGauge} from './tower-details.js';
import {P} from './pixel-world.js';
test('the full tower stays visible and lights exactly one window per completed floor',()=>{
 for(const progress of [0,1,19,20,59,80,100]){
  const windows=[],labels=[];const ctx={fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(w>=0&&h>=0);if(w===2&&h===3)windows.push(this.fillStyle)},fillText(value){labels.push(value)}};
  drawFloorGauge(ctx,{progress,floor:Math.min(99,progress)},P);assert.equal(windows.length,100);assert.equal(windows.filter(color=>color!==P.shade).length,progress);assert.ok(labels.some(label=>label.includes('/ 100')));
 }
});

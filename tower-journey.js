export const TOWER_FLOOR_HEIGHT=240;

// A wrong door, replacement recording or replay never changes the physical floor.
// Only the next prompt after a cleared floor moves the camera upstairs.
export function createTowerJourney(start=0){
 let floor=Math.max(0,Math.min(99,start)),camera=floor*TOWER_FLOOR_HEIGHT;
 let state=null,previous=null,from=camera,elapsed=.65;
 return {
  update(next){
   // The model awards progress before clock.pause() emits its final answering tick.
   // Follow the prompt's room, so that tick cannot move us before the door animation.
   const target=Math.max(floor,Math.min(99,next.floor??next.progress??floor));
   if(!['correct','landing','review'].includes(next.phase)&&target>floor){
    previous=state?{...state,scene:state.phase==='landing'?'tower-rest':'tone',restTime:99,result:'success',walk:1,open:1}:null;
    floor=target;from=camera;elapsed=0;
   }
   state={...next};
  },
  tick(dt,{paused=false,reduced=false}={}){
   if(!paused){
    elapsed=reduced?.65:Math.min(.65,elapsed+Math.max(0,dt));
    const p=elapsed/.65,ease=p*p*(3-2*p);
    camera=from+(floor*TOWER_FLOOR_HEIGHT-from)*ease;
   }
   const offset=camera-floor*TOWER_FLOOR_HEIGHT;
   if(offset===0)previous=null;
   return {camera,floor,offset,previous};
  }
 };
}

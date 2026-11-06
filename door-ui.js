export function hall(doors,intro=false,count=2){
  return `<div class="hall ${intro?'intro-hall':''}" data-count="${count}"><div class="plant"></div><div class="plant right"></div><div class="door-row">${doors}</div><div class="sprout" aria-hidden="true"></div></div>`;
}
export function walkToDoor(app,tone){
  const sprout=app.querySelector('.sprout'),door=app.querySelector(`[data-door="${tone}"]`);
  if(!sprout||!door)return;
  const from=sprout.getBoundingClientRect(),to=door.getBoundingClientRect();
  sprout.style.setProperty('--walk-x',`${to.x+to.width/2-from.x-from.width/2}px`);
  sprout.style.setProperty('--walk-y',`${to.bottom-from.bottom-25}px`);
  sprout.classList.add('walk-door');
}

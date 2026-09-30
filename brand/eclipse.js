/* Umbra eclipse: the brand mark in motion. A true black disc, a corona that bleeds light outward,
   a diamond-ring flare and an orbiting line naming the three things Umbra does. Same code on every Umbra surface. */
function makeUmbraEclipse(small){ let seed=9; const r=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const P=Array.from({length:small?520:1100},()=>{const k=r();return {a:r()*6.283,sp:.05+r()*.12,ph:r(),s:.5+r()*1.4,c:k<.07?'#8B7CFF':k<.3?'#FFB347':'#F5E6C8',sw:(r()-.5)*.5}});
  const RAYS=Array.from({length:small?70:120},()=>({a:r()*6.283,l:.2+r()*.9,w:.6+r()*1.8,sp:.3+r()*.9,ph:r()*6.28}));
  const WORD='UMBRA  ·  SEE  ·  GOVERN  ·  TRANSFORM  ·  ';
  return function draw(x,X,Y,R,t,heat,o){ o=o||{}; const k=1+heat*.5, br=.9+.1*Math.sin(t*.9);
    x.save(); x.globalCompositeOperation='lighter';
    let g=x.createRadialGradient(X,Y,R,X,Y,R*2.9); g.addColorStop(0,`rgba(255,214,150,${.34*k*br})`); g.addColorStop(.25,`rgba(255,179,71,${.12*k})`); g.addColorStop(.6,`rgba(139,124,255,${.05*k})`); g.addColorStop(1,'rgba(139,124,255,0)'); x.fillStyle=g; x.beginPath(); x.arc(X,Y,R*2.9,0,6.283); x.fill();
    for(const q of RAYS){ const a=q.a+t*.015, len=R*q.l*(.55+.45*Math.sin(t*q.sp+q.ph))*k, x0=X+Math.cos(a)*R*.98, y0=Y+Math.sin(a)*R*.98, x1=X+Math.cos(a)*(R+len), y1=Y+Math.sin(a)*(R+len);
      const lg=x.createLinearGradient(x0,y0,x1,y1); lg.addColorStop(0,`rgba(255,240,215,${.55*br})`); lg.addColorStop(.35,'rgba(255,190,110,.18)'); lg.addColorStop(1,'rgba(255,179,71,0)'); x.strokeStyle=lg; x.lineWidth=q.w; x.beginPath(); x.moveTo(x0,y0); x.lineTo(x1,y1); x.stroke(); }
    for(const p of P){ const u=(t*p.sp*(1+heat*.8)+p.ph)%1, d=R*(1.01+Math.pow(u,1.25)*1.55), a=p.a+u*p.sw+t*.01; x.globalAlpha=Math.pow(1-u,1.6)*.95; x.fillStyle=p.c; const s=p.s*(1-u*.5); x.fillRect(X+Math.cos(a)*d-s/2,Y+Math.sin(a)*d-s/2,s,s); }
    x.globalAlpha=1;
    g=x.createRadialGradient(X,Y,R*.97,X,Y,R*1.32); g.addColorStop(0,`rgba(255,246,228,${.95*br})`); g.addColorStop(.12,`rgba(255,226,180,${.6*k})`); g.addColorStop(.45,'rgba(255,179,71,.14)'); g.addColorStop(1,'rgba(255,179,71,0)'); x.fillStyle=g; x.beginPath(); x.arc(X,Y,R*1.32,0,6.283); x.fill();
    const th=-.85+Math.sin(t*.22)*.5, fx=X+Math.cos(th)*R, fy=Y+Math.sin(th)*R, fl=.75+.25*Math.sin(t*2.3)+heat*.3;
    g=x.createRadialGradient(fx,fy,0,fx,fy,R*.5); g.addColorStop(0,`rgba(255,255,255,${.95*fl})`); g.addColorStop(.12,`rgba(255,236,200,${.55*fl})`); g.addColorStop(1,'rgba(255,200,120,0)'); x.fillStyle=g; x.beginPath(); x.arc(fx,fy,R*.5,0,6.283); x.fill();
    const L=R*1.6*fl; for(const [dx,dy,w] of [[1,0,1.3],[0,1,1.3],[.7,.7,.7],[.7,-.7,.7]]){ const lg=x.createLinearGradient(fx-dx*L,fy-dy*L,fx+dx*L,fy+dy*L); lg.addColorStop(0,'rgba(255,240,210,0)'); lg.addColorStop(.5,`rgba(255,248,232,${.8*fl})`); lg.addColorStop(1,'rgba(255,240,210,0)'); x.strokeStyle=lg; x.lineWidth=w; x.beginPath(); x.moveTo(fx-dx*L,fy-dy*L); x.lineTo(fx+dx*L,fy+dy*L); x.stroke(); }
    x.restore();
    x.fillStyle='#000'; x.beginPath(); x.arc(X,Y,R,0,6.283); x.fill();
    g=x.createRadialGradient(X-R*.25,Y-R*.3,R*.1,X,Y,R); g.addColorStop(0,'rgba(22,20,30,.55)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.beginPath(); x.arc(X,Y,R,0,6.283); x.fill();
    x.strokeStyle=`rgba(255,238,205,${.85*br})`; x.lineWidth=1.2; x.beginPath(); x.arc(X,Y,R+.4,0,6.283); x.stroke();
    if(o.word!==false){ const rr=R*(o.wordR||2.2), fs=Math.max(9,Math.round(R*.1)); x.font=`500 ${fs}px "Fragment Mono","JetBrains Mono",ui-monospace,monospace`; x.fillStyle='#F5E6C8'; const chars=[...WORD], step=(fs*.78)/rr, span=chars.length*step;
      if(span<6.2){ const reps=Math.max(1,Math.floor(6.283/span)); for(let n=0;n<reps;n++) chars.forEach((ch,i)=>{ const a=-t*.05+n*(6.283/reps)+i*step; x.save(); x.translate(X+Math.cos(a)*rr,Y+Math.sin(a)*rr); x.rotate(a+Math.PI/2); x.globalAlpha=.32+.25*heat; x.fillText(ch,-fs*.3,0); x.restore(); }); } x.globalAlpha=1; }
  };
}

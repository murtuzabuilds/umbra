/* Umbra eclipse: the particle eclipse from the logo, alive. A black disc ringed by a corona of square
   particles; two layers turn in opposite directions, particles twinkle and bleed slowly outward,
   the glow breathes, a small flare circles the rim, and the corona leans toward the cursor. */
function makeUmbraEclipse(small){ let seed=9; const r=()=>((seed=(seed*16807)%2147483647)/2147483647);
  const N=small?900:2000, P=Array.from({length:N},()=>{const f=Math.pow(r(),2.4);return {a:r()*6.283,f,s:.6+(1-f)*1.8,hot:r()<.06,ph:r()*6.28,dir:r()<.5?1:-1,tw:r()<.35,tws:1.5+r()*3,bleed:r()<.22,bs:.03+r()*.06}});
  return function draw(x,X,Y,R,t,heat,o){ o=o||{}; const lean=o.lean||[0,0], la=Math.atan2(lean[1],lean[0]), lm=Math.min(1,Math.hypot(lean[0],lean[1]));
    const br=1+.08*Math.sin(t*1.2)+heat*.25;
    let g=x.createRadialGradient(X,Y,R*.9,X,Y,R*2.7*br); g.addColorStop(0,`rgba(245,230,200,${.38*br})`); g.addColorStop(.25,'rgba(255,179,71,.09)'); g.addColorStop(1,'rgba(255,179,71,0)'); x.fillStyle=g; x.beginPath(); x.arc(X,Y,R*2.7*br,0,6.283); x.fill();
    for(const p of P){ const a=p.a+t*(.035+heat*.05)*p.dir;
      let f=p.f; if(p.bleed){ f=(p.f+((t*p.bs+p.ph)%1)*.9); }
      const pull=Math.max(0,Math.cos(a-la))*lm*.9, breath=Math.sin(t*.8+p.ph)*.05;
      const d=R*(1.06+f*(1.25+breath+pull*.8)); if(f>1.35) continue;
      let al=(1-Math.min(1,f))*.9+.05; if(p.tw) al*=.35+.65*(.5+.5*Math.sin(t*p.tws+p.ph*3)); if(p.bleed) al*=1-Math.min(1,(f-p.f)/.9);
      x.globalAlpha=al; x.fillStyle=p.hot?'#8B7CFF':'#F5E6C8'; x.fillRect(X+Math.cos(a)*d,Y+Math.sin(a)*d,p.s,p.s); }
    x.globalAlpha=1;
    x.strokeStyle=`rgba(245,230,200,${.8+.15*Math.sin(t*1.2)})`; x.lineWidth=1.4; x.beginPath(); x.arc(X,Y,R*1.02,0,6.283); x.stroke();
    const fa=t*.9-1.2, fx=X+Math.cos(fa)*R*1.02, fy=Y+Math.sin(fa)*R*1.02; g=x.createRadialGradient(fx,fy,0,fx,fy,R*.3); g.addColorStop(0,'rgba(255,250,235,.95)'); g.addColorStop(.25,'rgba(255,217,160,.45)'); g.addColorStop(1,'rgba(255,179,71,0)'); x.fillStyle=g; x.beginPath(); x.arc(fx,fy,R*.3,0,6.283); x.fill();
    x.fillStyle='#000'; x.beginPath(); x.arc(X,Y,R,0,6.283); x.fill();
  };
}

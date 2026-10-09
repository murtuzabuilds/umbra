/* Umbra central intelligence: shared with the portfolio. Plain script, sets window.umbraSystem. */
/* Umbra as a central intelligence. A black hole at the centre, its accretion disk turning, the light of the far
   side bent over the top. The company's AI services orbit it, and each orbit is a ring of Umbra's influence:
   rules, tool calling, API limits, data boundaries, approvals, audit trail. The tighter the orbit, the stronger the
   hold. The whole system travels forward, so every orbit leaves a spiral behind it. Every few seconds the core
   reaches out to one service; every ten or so it pulls a shadow tool inward and governs it (red, then lavender,
   then green). Then a new shadow tool shows up on the edge, because there is always another one.
   Names come from Umbra's own sample catalog. */
window.umbraSystem=function(cv,o){ o=o||{}; const x=cv.getContext('2d'); const D=Math.min(2,devicePixelRatio||1); let W,H,seed=3; const r=()=>((seed=(seed*16807)%2147483647)/2147483647);
const S=Array.from({length:240},()=>[r(),r(),r()]);
const size=()=>{W=cv.clientWidth;H=cv.clientHeight;cv.width=W*D;cv.height=H*D;x.setTransform(D,0,0,D,0,0)}; size(); addEventListener('resize',size);
const sec=o.host||cv.parentElement; let mx=-1e4,my=-1e4,heat=0; sec.addEventListener('pointermove',e=>{const c=cv.getBoundingClientRect();mx=e.clientX-c.left;my=e.clientY-c.top;}); sec.addEventListener('pointerleave',()=>{mx=my=-1e4;});
const still=matchMedia('(prefers-reduced-motion: reduce)').matches; let on=false, running=false; const go=()=>{ if(!running&&on&&!still&&(!o.active||o.active())){ running=true; last=performance.now(); requestAnimationFrame(f); } }; new IntersectionObserver(e=>{on=e[0].isIntersecting; go();}).observe(cv); cv.umbraWake=go;
const MONO=(getComputedStyle(document.body).getPropertyValue('--mono')||'').trim()||'monospace';
/* accretion disk: particles on circular orbits seen at a low angle */
const KY=.2, DISK=Array.from({length:innerWidth<700?1400:2600},()=>{const u=r(); return {f:Math.pow(u,1.7), a:r()*6.283, s:.6+r()*.9, j:r()};});
const HEATC=['#FFFBF0','#FFF1D2','#FFE2AE','#FFD08A','#FFBC6A','#FFA552','#F68A45','#E06F3E','#C2573D','#9E4542','#7A3B55','#5B3566'];
/* rings of influence: radius in hole radii, tilt, flatness */
const ORB=[[2.95,-.14,.6],[3.4,.04,.52],[3.85,-.22,.64],[4.3,-.06,.56],[4.75,-.18,.62],[5.2,-.02,.54]];
const RING=['rules','tool calling','API limits','data boundaries','approvals','audit trail'];
const RC=[[59,232,176],[59,232,176],[179,168,255],[179,168,255],[255,90,110],[255,90,110]];
const VX=-.3, VY=-.95; /* direction of travel: up, so the trails fall away below */
/* status runs 0 shadow, 1 under review, 2 approved */
const SC=[[255,90,110],[179,168,255],[59,232,176]], SN=o.statusNames||['shadow AI','under review','approved'];
const col=g=>{ const i=Math.min(1,Math.floor(g)), t=Math.min(1,g-i), a=SC[i], b=SC[Math.min(2,i+1)]; return [0,1,2].map(k=>Math.round(a[k]+(b[k]-a[k])*t)); };
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mk=(n,g,o,a)=>({n,g,o,a,ph:r()*6.283,beam:0,h:[],cap:-1,al:1});
const P=o.planets?o.planets.map((q,i)=>mk(q.n,q.g,q.o,i*2.399)):[mk('Aster Enterprise',2,0,.0),mk('Orion Code',2,1,3.1),mk('Relay Agents',2,1,1.4),
         mk('Quill Write',1,2,.8),mk('Sonar Search',1,3,4.2),...(o.full?[mk('Vela Meeting AI',2,0,3.4),mk('Murmur Notes',1,3,1.2)]:[]),
         mk('Chatly',0,4,5.4),mk('HexPilot',0,4,2.2),mk('Aster Free',0,5,3.6),mk('Lumen Draw',0,5,.4),...(o.full?[mk('ParsePDF AI',0,5,2.1)]:[])];
const POOL=['Loopwork','ParsePDF AI','Chatly','HexPilot','Aster Free','Lumen Draw']; let poolI=0;
const orbAt=o=>{ const i=Math.max(0,Math.min(4.999,o)), a=Math.floor(i), t=i-a, A=ORB[a], B=ORB[a+1]; return [A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t]; };
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let next=1.5, pick=0, story=o.firstStory||6; let last=performance.now(), T=0;
function f(now){const dt=Math.min(.05,(now-last)/1000); last=now; x.clearRect(0,0,W,H);
 for(const [a,b,c] of S){ const sp=(3+c*11)*T, sx=((a*W-VX*sp)%W+W)%W, sy=((b*H-VY*sp)%H+H)%H; x.globalAlpha=(.05+c*.35)*(.55+.45*Math.sin(T*(.6+c*1.8)+c*40));x.fillStyle='#F5E6C8';x.fillRect(sx,sy,c>.85?1.5:1,c>.85?1.5:1)} x.globalAlpha=1;
 const {X,Y,Rh,narrow}=o.geom(W,H);
 const near=Math.hypot(mx-X,my-Y)<Rh*6; heat+=((near?1:0)-heat)*.04; T+=dt*(1+heat*.5);
 const rin=Rh*1.5, rout=Rh*2.85;
 let g=x.createRadialGradient(X,Y,Rh*.8,X,Y,Rh*5); g.addColorStop(0,`rgba(255,190,110,${.16+heat*.08})`); g.addColorStop(.35,'rgba(139,124,255,.07)'); g.addColorStop(1,'rgba(5,6,10,0)'); x.fillStyle=g; x.fillRect(X-Rh*5,Y-Rh*5,Rh*10,Rh*10);
 /* the story: every ten seconds or so, pull a shadow tool inward and govern it */
 story-=dt; if(o.story!==false&&story<=0&&!P.some(p=>p.cap>=0)){ const sh=P.filter(p=>p.g<.5&&p.al>.99); if(sh.length){ const p=sh[Math.floor(r()*sh.length)]; p.cap=0; p.o0=p.o; p.g0=p.g; } story=16; }
 for(const p of P){
   if(p.cap>=0){ p.cap+=dt/7; const e=ease(Math.min(1,p.cap)); p.o=p.o0+(1.3-p.o0)*e; p.g=p.g0+(2-p.g0)*e; p.beam=Math.max(p.beam,Math.min(1,p.cap*3)*(p.cap<1.1?1:0));
     if(p.cap>=2.2){ p.al-=dt; if(p.al<=0){ /* a new shadow tool appears on the edge */ let n; do{ n=POOL[poolI++%POOL.length]; }while(P.some(q=>q.n===n)); Object.assign(p,{n,g:0,o:4+r(),cap:-1,al:0,h:[],a:r()*6.283}); p.fade=1; } } }
   else if(p.fade){ p.al=Math.min(1,p.al+dt*.6); if(p.al>=1) p.fade=0; } }
 /* planets: positions and depth */
 const pl=P.map(p=>{ const [k,tl,oy]=orbAt(p.o), w=.065*Math.pow(3.1/k,1.5)*(1-heat*.35); p.a+=dt*w*(p.g<.5?1+.25*Math.sin(T*.7+p.ph):1);
   const ex=Math.cos(p.a)*Rh*k, ey=Math.sin(p.a)*Rh*k*oy, ct=Math.cos(tl), sn=Math.sin(tl);
   const px=X+ex*ct-ey*sn, py=Y+ex*sn+ey*ct, drift=dt*(5.5+heat*4); for(const h of p.h){ h[0]-=VX*drift; h[1]-=VY*drift; } p.h.push([px,py,p.g]); if(p.h.length>1500) p.h.shift();
   return {p, px, py, z:Math.sin(p.a), c:col(p.g)}; });
 /* the path each planet has travelled: the system moves forward, so orbits become spirals behind it */
 x.lineWidth=1.1; for(const q of pl){ const h=q.p.h; for(let i=1;i<h.length;i+=1){ x.globalAlpha=Math.pow(i/h.length,1.8)*(h[i][2]<.5?.3:.4)*q.p.al; x.strokeStyle=rgba(col(h[i][2]),1); x.beginPath(); x.moveTo(h[i-1][0],h[i-1][1]); x.lineTo(h[i][0],h[i][1]); x.stroke(); } } x.globalAlpha=1;
 /* the core's own wake */
 { const L=Rh*5; for(let i=10;i>=1;i--){ const k=i/10, cx=X-VX*L*k, cy=Y-VY*L*k, rr=Rh*(1.4-k*.6); const wg=x.createRadialGradient(cx,cy,0,cx,cy,rr*1.6); wg.addColorStop(0,`rgba(${k<.5?'255,205,150':'150,135,255'},${(.09+heat*.04)*(1-k*.8)})`); wg.addColorStop(1,'rgba(139,124,255,0)'); x.fillStyle=wg; x.beginPath(); x.arc(cx,cy,rr*1.6,0,6.283); x.fill(); } }
 /* rings of influence, drawn in two halves so they pass behind the hole and in front of it */
 const ring=(front)=>{ ORB.forEach(([k,tl,oy],i)=>{ x.save(); x.translate(X,Y); x.rotate(tl); x.beginPath(); x.ellipse(0,0,Rh*k,Rh*k*oy,0,front?0:Math.PI,front?Math.PI:6.283); x.lineWidth=front?1.15:.9; x.strokeStyle=rgba(RC[i],(front?.26:.09)+heat*.06); if(i>3) x.setLineDash([2,5]); x.stroke(); x.setLineDash([]);
   const lab=o.labels==='always'?.75:heat; if(front&&lab>.02){ const la=[.55,1.25,.25,1.9,.85,1.55][i], lx=Math.cos(la)*Rh*k, ly=Math.sin(la)*Rh*k*oy; x.globalAlpha=lab; x.fillStyle=rgba(RC[i],.85); x.font=`${narrow?8.5:9.5}px ${MONO}`; x.textAlign='left'; x.textBaseline='top'; x.fillText(RING[i],lx+5,ly+3); x.globalAlpha=1; }
   x.restore(); }); };
 ring(false);
 /* the core reaches out to one service at a time */
 next-=dt; if(next<=0){ next=3.6; const q=pl[pick%pl.length]; if(q.p.cap<0) q.p.beam=1; pick+=4; }
 let hov=null, hd=1e9; pl.forEach(q=>{ const d=Math.hypot(mx-q.px,my-q.py); if(d<28&&d<hd){hd=d;hov=q;} });
 const cw=narrow?6.1:6.7, boxes=[]; [...pl].sort((a,b)=>(b===hov)-(a===hov)||(b.p.cap>=0)-(a.p.cap>=0)||b.z-a.z).forEach(q=>{ const w=q.p.n.length*cw+6, bx=q.px-w/2, by=q.py+4; q.show=q===hov||q.p.cap>=0||!boxes.some(b=>bx<b[2]&&bx+w>b[0]&&by<b[3]&&by+(q.p.beam>.35?30:16)>b[1]); if(q.show) boxes.push([bx,by,bx+w,by+(q.p.beam>.35||q.p.cap>=0?30:16)]); });
 const drawPlanet=q=>{ const {p,px,py,z,c}=q, s=(narrow?4.2:5.4)*(1+.22*z)*(1+.1*p.g/2), lit=hov===q, A=p.al;
   if(p.cap<0) p.beam=Math.max(0,p.beam-dt*.55); else if(p.cap>1.1) p.beam=Math.max(0,p.beam-dt*.5);
   if(p.beam>0||lit){ const b=(lit?1:p.beam)*A; const lg=x.createLinearGradient(X,Y,px,py); lg.addColorStop(0,'rgba(255,230,190,0)'); lg.addColorStop(.25,`rgba(255,230,190,${.5*b})`); lg.addColorStop(1,rgba(c,1)); x.globalAlpha=b*.9; x.strokeStyle=lg; x.lineWidth=p.cap>=0?1.8:1.2; x.beginPath(); x.moveTo(X+(px-X)*.18,Y+(py-Y)*.18); x.lineTo(px,py); x.stroke();
     x.globalAlpha=b*.6; x.strokeStyle=rgba(c,1); x.lineWidth=1.1; x.beginPath(); x.arc(px,py,s+4+(p.cap>=0?3*Math.sin(T*6):(1-b)*12),0,6.283); x.stroke(); x.globalAlpha=1; }
   const flick=p.g<.5?.7+.3*Math.sin(T*3.1+p.ph*7):1;
   const hg=x.createRadialGradient(px,py,0,px,py,s*4); hg.addColorStop(0,rgba(c,.33)); hg.addColorStop(1,rgba(c,0)); x.globalAlpha=A*flick*(.45+.55*(z+1)/2); x.fillStyle=hg; x.beginPath(); x.arc(px,py,s*4,0,6.283); x.fill();
   const dd=Math.hypot(X-px,Y-py)||1, lx=px+(X-px)/dd*s*.55, ly=py+(Y-py)/dd*s*.55;
   const sg=x.createRadialGradient(lx,ly,s*.1,px,py,s); sg.addColorStop(0,'#FFFFFF'); sg.addColorStop(.35,rgba(c,1)); sg.addColorStop(1,'#0A0C13'); x.globalAlpha=A*flick*(.55+.45*(z+1)/2); x.fillStyle=sg; x.beginPath(); x.arc(px,py,s,0,6.283); x.fill();
   if(q.show){ x.globalAlpha=A*(lit||p.cap>=0?1:.3+.6*(z+1)/2)*(p.g<.5?flick:1); x.font=`500 ${narrow?10:11}px ${MONO}`; x.textBaseline='middle'; x.textAlign='center'; x.fillStyle=lit?'#FFFFFF':'#D6D9E4'; x.fillText(p.n,px,py+s+9);
     if(lit||p.beam>.35||p.cap>=0){ x.globalAlpha=A*(lit||p.cap>=0?1:p.beam); x.fillStyle=rgba(c,1); x.font=`${narrow?9:10}px ${MONO}`; x.fillText(p.cap>=0&&p.cap<1?'governing…':SN[Math.round(p.g)],px,py+s+21); } }
   x.globalAlpha=1; x.textAlign='left'; };
 const back=pl.filter(q=>q.z<0).sort((a,b)=>a.z-b.z), front=pl.filter(q=>q.z>=0).sort((a,b)=>a.z-b.z);
 back.forEach(drawPlanet);
 /* disk: far half first, then the bent light over the top, then the hole, then the near half */
 const pts=DISK.map(d=>{ const rr=rin+(rout-rin)*d.f; d.a+=dt*(1+heat*1)*.26*Math.pow(rin/rr,1.5); const ca=Math.cos(d.a), sa=Math.sin(d.a);
   const ci=Math.min(HEATC.length-1,Math.floor(d.f*HEATC.length)), dop=1+.6*ca; return {px:X+ca*rr, py:Y+sa*rr*KY, sa, ca, ci, al:Math.min(1,(.35+.65*(1-d.f))*dop*(.75+.25*Math.sin(T*2+d.j*30))*(.85+heat*.3)), s:d.s*(narrow?.85:1)*(1+(1-d.f)*.5), f:d.f}; });
 x.save(); x.translate(X,Y); x.scale(1,KY); g=x.createRadialGradient(0,0,rin*.9,0,0,rout*1.15); g.addColorStop(0,`rgba(255,214,150,${.5+heat*.2})`); g.addColorStop(.45,'rgba(255,150,80,.22)'); g.addColorStop(1,'rgba(120,60,120,0)'); x.fillStyle=g; x.beginPath(); x.arc(0,0,rout*1.15,0,6.283); x.fill(); x.restore();
 x.save(); x.translate(X,Y); x.scale(1,.94); g=x.createRadialGradient(0,0,Rh*1.05,0,0,Rh*1.9); g.addColorStop(0,`rgba(255,220,170,${.38+heat*.15})`); g.addColorStop(1,'rgba(255,170,90,0)'); x.fillStyle=g; x.beginPath(); x.arc(0,0,Rh*1.9,Math.PI,0); x.fill(); x.restore();
 x.globalCompositeOperation='lighter';
 for(const q of pts) if(q.sa<0){ x.globalAlpha=q.al*.8; x.fillStyle=HEATC[q.ci]; x.fillRect(q.px-q.s/2,q.py-q.s/2,q.s,q.s); }
 /* lensed image of the far side, arching over the top and a thin ring underneath */
 for(const q of pts){ const lr=Rh*(1.12+.6*q.f), ang=Math.atan2(q.sa,q.ca); const top=Math.PI+(ang<0?ang+Math.PI:ang);
   x.globalAlpha=q.al*.8; x.fillStyle=HEATC[q.ci]; const ax=X+Math.cos(top)*lr, ay=Y+Math.sin(top)*lr*.96; x.fillRect(ax-q.s*.5,ay-q.s*.5,q.s,q.s);
   if(q.f<.45){ const br=Rh*(1.06+.22*q.f), bt=top-Math.PI; x.globalAlpha=q.al*.28; x.fillRect(X+Math.cos(bt)*br-.6,Y+Math.sin(bt)*br*.94-.6,1.2,1.2); } }
 x.globalCompositeOperation='source-over'; x.globalAlpha=1;
 /* event horizon and photon ring */
 g=x.createRadialGradient(X,Y,Rh*.6,X,Y,Rh*1.14); g.addColorStop(0,'#000'); g.addColorStop(.86,'#000'); g.addColorStop(.93,`rgba(255,236,200,${.85+heat*.15})`); g.addColorStop(1,'rgba(255,200,130,0)');
 x.fillStyle=g; x.beginPath(); x.arc(X,Y,Rh*1.14,0,6.283); x.fill();
 x.globalCompositeOperation='lighter';
 for(const q of pts) if(q.sa>=0){ x.globalAlpha=q.al; x.fillStyle=HEATC[q.ci]; x.fillRect(q.px-q.s/2,q.py-q.s/2,q.s,q.s); }
 x.globalCompositeOperation='source-over'; x.globalAlpha=1;
 ring(true);
 front.forEach(drawPlanet);
 if(on&&!still&&(!o.active||o.active())) requestAnimationFrame(f); else running=false; }
if(still) requestAnimationFrame(f);
};

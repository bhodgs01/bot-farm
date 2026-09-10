/**
 * Totoro's companions — Chu Totoro (blue) and Chibi Totoro (white). From ChatGPT's
 * Totoro_Companions batch, made into an ES module with the colony's THREE. They don't wander
 * or take cards of their own: a procession controller makes them hop along behind the main
 * Totoro. createTotoroProcession(leader) returns a group whose userData.update(dt) trails the
 * leader — call it each frame after the leader has moved.
 */
import * as THREE from 'three'
globalThis.THREE = globalThis.THREE || THREE

/* Totoro: continuous pear-shaped body, articulated limbs and five expressions.
   THREE must be global. No external models or textures required by the builder. */
function createTotoroCompanion(kind="blue"){
  const blue=kind==="blue";
  const T=globalThis.THREE;if(!T)throw new Error('createTotoro requires globalThis.THREE');
  const g=new T.Group();g.name=blue?'Chu Totoro':'Chibi Totoro';
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.93,metalness:0});
  const fur=mat(blue?0x557c9c:0xf0eee3),cream=mat(0xf0eee3),mark=mat(0x575451),dark=mat(0x27252d),white=mat(0xfaf9ed),mouthDark=mat(0x402730),tongueMat=mat(0xc87586),claw=mat(0x55515a);
  const add=(p,geo,m,x=0,y=0,z=0)=>{const a=new T.Mesh(geo,m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;p.add(a);return a;};
  const oval=(x,y,z)=>{const geo=new T.SphereGeometry(1,32,20);geo.scale(x,y,z);return geo;};
  const rod=(p,a,b,r,m)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av);const mesh=add(p,new T.CylinderGeometry(r*.52,r,v.length(),8),m,...av.clone().add(bv).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return mesh;};
  const profile=[[0,.10],[.24,.13],[.37,.24],[.45,.43],[.465,.63],[.435,.84],[.365,1.06],[.30,1.22],[.20,1.30],[0,1.33]];
  const curve=new T.CatmullRomCurve3(profile.map(([r,y])=>new T.Vector3(r,y,0)));const samples=curve.getPoints(100).map(v=>new T.Vector2(Math.max(0,v.x),v.y));
  // Exact same sampled surface is used for the cream belly and facial markings.
  function radiusAt(y){for(let i=1;i<samples.length;i++){if(y<=samples[i].y){const a=samples[i-1],b=samples[i];return T.MathUtils.lerp(a.x,b.x,T.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1));}}return .001;}
  const surfaceZ=(x,y)=>.75*Math.sqrt(Math.max(.00001,radiusAt(y)**2-x*x));
  const bodyGeo=new T.LatheGeometry(samples,64);bodyGeo.scale(1,1,.75);bodyGeo.translate(0,-.72,0);
  const head=add(g,bodyGeo,fur,0,.72,0);head.name='body-and-head';
  function surface(shape,m,depth=.004){
    const source=new T.ShapeGeometry(shape,24),pos=source.attributes.position,index=source.index;const vertices=[],normals=[];
    const append=(x,y)=>{vertices.push(x,y-.72,surfaceZ(x,y)+depth);const h=.0001,dx=(surfaceZ(x+h,y)-surfaceZ(x-h,y))/(2*h),dy=(surfaceZ(x,y+h)-surfaceZ(x,y-h))/(2*h);const n=new T.Vector3(-dx,-dy,1).normalize();normals.push(n.x,n.y,n.z);};
    const subdivisions=m===cream?16:5;
    for(let k=0;k<index.count;k+=3){const a=new T.Vector2(pos.getX(index.getX(k)),pos.getY(index.getX(k))),b=new T.Vector2(pos.getX(index.getX(k+1)),pos.getY(index.getX(k+1))),c=new T.Vector2(pos.getX(index.getX(k+2)),pos.getY(index.getX(k+2)));
      const point=(i,j)=>a.clone().addScaledVector(b.clone().sub(a),i/subdivisions).addScaledVector(c.clone().sub(a),j/subdivisions);
      const tri=(a,b,c)=>{for(const v of [a,b,c])append(v.x,v.y);};
      for(let i=0;i<subdivisions;i++)for(let j=0;j<subdivisions-i;j++){tri(point(i,j),point(i+1,j),point(i,j+1));if(i+j<subdivisions-1)tri(point(i+1,j),point(i+1,j+1),point(i,j+1));}
    }
    source.dispose();const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return add(head,geo,m);
  }
  const ellipse=(cx,cy,rx,ry)=>{const s=new T.Shape();s.absellipse(cx,cy,rx,ry,0,Math.PI*2,false,0);return s;};
  function line(points,m,width=.006,depth=.012){const parts=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];parts.push(rod(head,[a[0],a[1]-.72,surfaceZ(...a)+depth],[b[0],b[1]-.72,surfaceZ(...b)+depth],width,m));}return parts;}
  if(blue)surface(ellipse(0,.585,.35,.335),cream,.008);
  // Head and cheeks share the body silhouette; no separate spherical head seam.
  for(const side of [-1,1]){
    surface(ellipse(side*.133,1.145,.060,.071),white,.006);
    surface(ellipse(side*.129,1.144,.012,.017),dark,.011);
  }
  if(blue)add(head,oval(.032,.014,.022),dark,0,1.085-.72,surfaceZ(0,1.085)+.007);
  const ears=[];
  for(const side of [-1,1]){
    const pts=[[0,0],[.025,.024],[.049,.11],[.040,.21],[.018,.30],[0,.335]].map(p=>new T.Vector2(...p));
    const geo=new T.LatheGeometry(pts,20);geo.scale(1,1,.55);
    const ear=add(head,geo,fur,side*.19,1.275-.72,-.015);ear.rotation.z=-side*.12;ears.push(ear);
    
  }
  // Small feet with toes, shoulder-pivot flippers and three short claws per paw.
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const geo=oval(.135,.090,.18);geo.translate(0,-.09,.035);
    const foot=add(g,geo,fur,side*.19,.18,.015);foot.userData.restY=.18;legs.push(foot);

    const armGeo=oval(.085,.24,.09);armGeo.translate(side*.016,-.24,0);
    const arm=add(head,armGeo,fur,side*.372,.935-.72,0);arm.rotation.z=side*.10;arms.push(arm);

  }
  const tail=add(head,oval(.14,.12,.24),fur,0,.29-.72,-.30);tail.rotation.x=-.17;
  // Tied cloth sack follows the torso rather than sliding during a hop.
  const sackMat=mat(0xb7a584),foldMat=mat(0x86785f);
  const sack=add(head,oval(.31,.23,.23),sackMat,-.25,.96-.72,-.12);sack.rotation.z=-.18;
  const neck=add(head,new T.ConeGeometry(.075,.23,12),sackMat,-.30,.99-.72,.14);neck.rotation.x=1.15;
  add(head,oval(.064,.045,.04),foldMat,-.30,.95-.72,.24);
  const tie=add(head,new T.ConeGeometry(.065,.12,10),sackMat,-.29,.89-.72,.25);tie.rotation.z=.35;
  const expressions={
    neutral:line([[-.026,1.031],[.026,1.031]],dark,.0025),
    happy:line([[-.063,1.046],[-.04,1.018],[0,1.005],[.04,1.018],[.063,1.046]],dark,.004),
    surprised:[surface(ellipse(0,1.025,.033,.047),mouthDark,.014),...line([[-.18,1.253],[-.12,1.272]],dark,.004),...line([[.12,1.272],[.18,1.253]],dark,.004)],
    annoyed:[...line([[-.045,1.015],[.045,1.015]],dark,.004),...line([[-.19,1.23],[-.085,1.20]],dark,.005),...line([[.085,1.20],[.19,1.23]],dark,.005)],
    sleepy:[]
  };
  for(const side of [-1,1]){
    expressions.sleepy.push(surface(ellipse(side*.133,1.145,.064,.075),fur,.018));
    expressions.sleepy.push(...line([[side*.133-.045,1.143],[side*.133,1.132],[side*.133+.045,1.143]],dark,.004,.028));
  }
  for(const [name,parts] of Object.entries(expressions))parts.forEach(m=>m.visible=name==='neutral');
  let time=0,phase=0,disposed=false;
  function setExpression(name){if(!expressions[name])throw new Error('Unknown Totoro expression: '+name);for(const [key,parts] of Object.entries(expressions))parts.forEach(p=>p.visible=key===name);g.userData.expression=name;}
  // The hop moves an inner group, keeping root navigation on the ground.
  const motion=new T.Group();while(g.children.length)motion.add(g.children[0]);g.add(motion);
  function update(dt,state={}){
    if(disposed)return;
    dt=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.1):0;time+=dt;
    if(state.expression)setExpression(state.expression);
    const expression=Object.keys(expressions).find(e=>expressions[e][0]?.visible)||'neutral';g.userData.expression=expression;
    const moving=Number.isFinite(state.speed)&&state.speed>0;
    if(moving||phase%Math.PI>.001){phase+=dt*(blue?8:10);if(!moving&&Math.floor((phase-dt*(blue?8:10))/Math.PI)!==Math.floor(phase/Math.PI))phase=Math.ceil((phase-.001)/Math.PI)*Math.PI;}
    const hop=moving?Math.abs(Math.sin(phase)):0;
    motion.position.y=hop*.19;
    motion.scale.set(1-hop*.025,1+hop*.03,1-hop*.025);
    head.rotation.z=Math.sin(time*1.3)*.012;
    ears.forEach((e,i)=>e.rotation.z=(i? -1:1)*(.12+hop*.08));
    arms.forEach((a,i)=>{a.rotation.x=hop*.12;a.rotation.z=(i?1:-1)*(expression==='surprised'?.7:.12);});
    tail.rotation.y=Math.sin(time*2)*.08;
  }
  g.userData={displayName:g.name,intro:blue?'Acorns packed. Following the big fellow.':'Hop. Hop. Wait for me.',head,arms,legs,ears,tail,expressions,expression:'neutral',update,setExpression,
    dispose(){disposed=true;g.removeFromParent();const gs=new Set(),ms=new Set();g.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());}};
  g.scale.setScalar(blue?.52:.30);update(0);return g;
}
function createChuTotoro(){return createTotoroCompanion('blue');}
function createChibiTotoro(){return createTotoroCompanion('white');}
Object.assign(globalThis,{createChuTotoro,createChibiTotoro});

/* Follow sampled leader positions, including turns. All navigation is world-space.
   Ground height follows the leader's root; leader should not put hop motion on its root.
   Place leader before creating the procession. No navigation collision solver is included. */
function createTotoroProcession(leader,options={}){
  const T=globalThis.THREE,group=new T.Group(),blue=createChuTotoro(),white=createChibiTotoro();
  group.name='Totoro companions';group.add(blue,white);
  const followers=[blue,white],spacing=options.spacing??.70;
  if(!(spacing>0))throw new Error('spacing must be positive');
  const trail=[],last=new T.Vector3(),q=new T.Quaternion();
  leader.getWorldPosition(last);leader.getWorldQuaternion(q);
  const forward=new T.Vector3(0,0,1).applyQuaternion(q);forward.y=0;if(forward.lengthSq()<1e-8)forward.set(0,0,1);forward.normalize();
  for(let i=0;i<=50;i++)trail.push(last.clone().addScaledVector(forward,-i*spacing*3/50));
  let settled=false;
  function atDistance(d){let remain=d;for(let i=1;i<trail.length;i++){const len=trail[i].distanceTo(trail[i-1]);if(len>0&&remain<=len)return trail[i-1].clone().lerp(trail[i],remain/len);remain-=len;}return trail[trail.length-1].clone();}
  function place(dt,initial=false){
    group.updateWorldMatrix(true,false);
    followers.forEach((f,i)=>{
      const desired=atDistance(spacing*(i+1)),world=f.getWorldPosition(new T.Vector3());
      const delta=desired.clone().sub(world),distance=delta.length();
      const moved=initial?desired:world.addScaledVector(delta,1-Math.exp(-dt*9));
      const local=group.worldToLocal(moved.clone());f.position.copy(local);
      if(!initial&&delta.x*delta.x+delta.z*delta.z>1e-7){
        const aim=group.worldToLocal(moved.clone().add(new T.Vector3(delta.x,0,delta.z)));
        f.rotation.y=Math.atan2(aim.x-local.x,aim.z-local.z);
      }else if(initial){const dir=forward.clone().transformDirection(group.matrixWorld.clone().invert());f.rotation.y=Math.atan2(dir.x,dir.z);}
      f.userData.update(dt,{speed:!initial&&distance>.015?1:0});
    });
  }
  function update(dt){
    dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
    const now=leader.getWorldPosition(new T.Vector3());
    if(now.distanceTo(last)>spacing*8){trail.length=0;leader.getWorldQuaternion(q);forward.set(0,0,1).applyQuaternion(q).setY(0).normalize();for(let i=0;i<=50;i++)trail.push(now.clone().addScaledVector(forward,-i*spacing*3/50));settled=false;}
    else if(now.distanceTo(trail[0])>.008){trail.unshift(now.clone());let length=0;for(let i=1;i<trail.length;i++){length+=trail[i].distanceTo(trail[i-1]);if(length>spacing*3){trail.length=i+1;break;}}}
    last.copy(now);place(dt,!settled);settled=true;
  }
  group.userData={followers,blue,white,update,setExpression(name){followers.forEach(f=>f.userData.setExpression(name));},dispose(){followers.forEach(f=>f.userData.dispose());group.removeFromParent();}};
  return group;
}


export { createTotoroProcession, createChuTotoro, createChibiTotoro }

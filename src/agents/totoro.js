/**
 * Totoro — a quiet forest guardian who ambles the Bot Farm. From ChatGPT's Totoro_Bot_Farm
 * batch; its globalThis builder made into an ES module by feeding it the colony's THREE.
 * 77 meshes, five expressions, self-animated paws/ears/tail via userData.update(dt,{speed}).
 */
import * as THREE from 'three'
globalThis.THREE = globalThis.THREE || THREE

/* Totoro: continuous pear-shaped body, articulated limbs and five expressions.
   THREE must be global. No external models or textures required by the builder. */
function createTotoro(){
  const T=globalThis.THREE;if(!T)throw new Error('createTotoro requires globalThis.THREE');
  const g=new T.Group();g.name='Totoro';
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.93,metalness:0});
  const fur=mat(0x6c6865),cream=mat(0xe0d9b4),mark=mat(0x575451),dark=mat(0x27252d),white=mat(0xfaf9ed),mouthDark=mat(0x402730),tongueMat=mat(0xc87586),claw=mat(0x55515a);
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
  // Large cream oval and the characteristic three-over-four chevron arrangement.
  surface(ellipse(0,.585,.35,.335),cream,.008);
  for(const [cx,cy] of [[-.18,.80],[0,.825],[.18,.80],[-.255,.675],[-.085,.70],[.085,.70],[.255,.675]]){
    const s=new T.Shape();s.moveTo(cx-.045,cy-.018);s.quadraticCurveTo(cx-.012,cy+.07,cx+.045,cy-.018);s.quadraticCurveTo(cx+.005,cy+.025,cx-.045,cy-.018);surface(s,mark,.013);
  }
  // Head and cheeks share the body silhouette; no separate spherical head seam.
  for(const side of [-1,1]){
    surface(ellipse(side*.133,1.145,.060,.071),white,.006);
    surface(ellipse(side*.129,1.144,.012,.017),dark,.011);
  }
  add(head,oval(.046,.019,.024),dark,0,1.085-.72,surfaceZ(0,1.085)+.007);
  add(head,oval(.014,.012,.012),dark,0,1.072-.72,surfaceZ(0,1.072)+.016);
  // Three fine, tapered whiskers on each cheek.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*.25,y=1.075-i*.034;
    rod(head,[x,y-.72,surfaceZ(x,y)+.012],[side*(.56+i*.006),y-.72+(1-i)*.033,.265],.0045,dark);
  }
  const ears=[];
  for(const side of [-1,1]){
    const pts=[[0,0],[.025,.024],[.049,.11],[.040,.21],[.018,.30],[0,.335]].map(p=>new T.Vector2(...p));
    const geo=new T.LatheGeometry(pts,20);geo.scale(1,1,.55);
    const ear=add(head,geo,fur,side*.19,1.275-.72,-.015);ear.rotation.z=-side*.12;ears.push(ear);
    const inner=add(ear,oval(.022,.115,.005),mark,0,.164,.025);inner.rotation.z=side*.02;
  }
  // Small feet with toes, shoulder-pivot flippers and three short claws per paw.
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const geo=oval(.135,.090,.18);geo.translate(0,-.09,.035);
    const foot=add(g,geo,fur,side*.19,.18,.015);foot.userData.restY=.18;legs.push(foot);
    for(let i=0;i<3;i++)add(foot,oval(.017,.018,.046),claw,(i-1)*.044,-.145,.173);
    const armGeo=oval(.117,.29,.123);armGeo.translate(side*.016,-.24,0);
    const arm=add(head,armGeo,fur,side*.372,.935-.72,0);arm.rotation.z=side*.10;arms.push(arm);
    for(let i=0;i<3;i++){const nailGeo=new T.ConeGeometry(.018,.065,10);nailGeo.rotateX(Math.PI);add(arm,nailGeo,claw,side*.018+(i-1)*.033,-.521,.025);}
  }
  const tail=add(head,oval(.14,.12,.24),fur,0,.29-.72,-.30);tail.rotation.x=-.17;
  // Expression geometry is all built upfront; only neutral starts visible.
  const expressions={};
  const neutral=[...line([[-.05,1.018],[0,1.012],[.05,1.018]],dark,.0035)];expressions.neutral=neutral;
  const grin=new T.Shape();grin.moveTo(-.238,1.014);grin.quadraticCurveTo(0,1.028,.238,1.014);grin.bezierCurveTo(.19,.875,-.19,.875,-.238,1.014);
  const happy=[surface(grin,white,.009)];
  for(const x of [-.15,-.075,0,.075,.15]){const bottom=.912+.06*(x/.238)**2;happy.push(...line([[x,1.018],[x,bottom]],mark,.0018,.015));}
  happy.push(...line([[-.19,1.244],[-.12,1.257]],mark,.005),...line([[.12,1.257],[.19,1.244]],mark,.005));expressions.happy=happy;
  const surprised=[surface(ellipse(0,.973,.19,.132),mouthDark,.015),surface(ellipse(0,.909,.097,.039),tongueMat,.023)];
  for(const row of [-1,1])for(const x of [-.12,-.06,0,.06,.12])surprised.push(surface(ellipse(x,.973+row*(.104-.025*(x/.15)**2),.027,.022),white,.026));
  surprised.push(...line([[-.19,1.258],[-.12,1.278]],mark,.005),...line([[.12,1.278],[.19,1.258]],mark,.005));expressions.surprised=surprised;
  const annoyed=[...line([[-.063,.998],[0,1.008],[.063,.998]],dark,.005),...line([[-.198,1.227],[-.091,1.194]],mark,.007),...line([[.091,1.194],[.198,1.227]],mark,.007)];expressions.annoyed=annoyed;
  const sleepy=[...line([[-.035,1.012],[.035,1.012]],dark,.004)];
  for(const side of [-1,1]){
    sleepy.push(surface(ellipse(side*.133,1.145,.063,.074),fur,.015));
    sleepy.push(...line([[side*.133-.045,1.144],[side*.133,1.132],[side*.133+.045,1.144]],dark,.004,.023));
  }
  expressions.sleepy=sleepy;
  for(const [name,parts] of Object.entries(expressions))parts.forEach(m=>m.visible=name==='neutral');
  let time=0,phase=0,disposed=false;
  function setExpression(name){if(!expressions[name])throw new Error('Unknown Totoro expression: '+name);for(const [key,parts] of Object.entries(expressions))parts.forEach(p=>p.visible=key===name);g.userData.expression=name;}
  function update(dt,state={}){
    if(disposed)return;dt=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.1):0;time+=dt;
    if(state.expression)setExpression(state.expression);
    const expression=Object.keys(expressions).find(e=>expressions[e][0].visible)||'neutral';g.userData.expression=expression;
    const speed=Number.isFinite(state.speed)?state.speed:0;phase+=dt*6*speed;
    const sleep=expression==='sleepy',surprise=expression==='surprised';
    const mix=dt>0?1-Math.exp(-dt*10):1,approach=(a,b)=>a+(b-a)*mix;
    head.position.y=.72+Math.sin(time*(sleep?.9:1.4))*.005;
    head.rotation.z=Math.sin(speed?phase:time*.65)*(speed?.02:.006);
    ears.forEach((ear,i)=>{const side=i===0?-1:1;ear.rotation.z=approach(ear.rotation.z,-side*(surprise?.22:sleep?.32:.12)+Math.sin(time*1.3+i)*.025);});
    if(state.animateLimbs!==false){
      arms.forEach((arm,i)=>{const side=i===0?-1:1;let az=side*.10,ax=speed?Math.sin(phase+i*Math.PI)*.23:Math.sin(time*.8+i)*.025;
        if(surprise){az=side*2.05;ax=-.25;}else if(state.wave&&i===1){az=2.35+Math.sin(time*4)*.10;ax=-.18;}
        arm.rotation.z=approach(arm.rotation.z,az);arm.rotation.x=approach(arm.rotation.x,ax);
        const foot=legs[i],angle=speed?Math.sin(phase+i*Math.PI)*.20:0;foot.rotation.x=angle;
        // Lift enough for the complete foot + toe envelope, not just its center.
        foot.position.y=.18+Math.max(0,.18*Math.cos(angle)+.22*Math.abs(Math.sin(angle))-.18);
      });
    }
    tail.rotation.y=Math.sin(time*.85)*.12;
  }
  g.userData={displayName:'Totoro',intro:'A quiet guardian. An enormous appetite. A very good nap.',head,arms,legs,ears,tail,expressions,expression:'neutral',update,setExpression,
    dispose(){disposed=true;g.removeFromParent();const gs=new Set(),ms=new Set();g.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());}};
  g.scale.setScalar(.85);update(0);return g;
}


export { createTotoro }

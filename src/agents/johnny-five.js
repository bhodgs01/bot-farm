/**
 * Johnny 5 (Short Circuit) — a tracked robot that wanders the Bot Farm reporting what he
 * sees. From ChatGPT's Johnny_5_Bot_Farm batch; its globalThis IIFE-style module made into
 * an ES module by feeding it the colony's THREE. 207 meshes, tread locomotion, five faces.
 */
import * as THREE from 'three'
globalThis.THREE = globalThis.THREE || THREE

/* Johnny 5 — procedural articulated Bot Farm character. THREE is global.
   No textures, loaders, external models, or animation loop. Call update(dt,state).
   This detailed model intentionally exceeds the old 40-part toy budget. */
function createJohnny5() {
  const T = globalThis.THREE;
  if (!T) throw new Error('createJohnny5 requires globalThis.THREE');
  const g = new T.Group(); g.name = 'Johnny 5';
  const mat=(color,metalness=.65,roughness=.38)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const alloy=mat(0xa6afb1,.8,.32), edge=mat(0x657075,.8,.4), pale=mat(0xc5c5b6,.62,.44);
  const black=mat(0x141b20,.35,.5), rubber=mat(0x252b2c,.08,.83), blue=mat(0x374c60,.55,.46);
  const chrome=mat(0xdce2dc,.9,.19), brass=mat(0x9a7b48,.7,.4), wire=mat(0x302d29,.1,.8);
  const glass=new T.MeshPhysicalMaterial({color:0x172a32,metalness:.7,roughness:.07,clearcoat:1,clearcoatRoughness:.04});
  const glint=new T.MeshBasicMaterial({color:0xc4e4e8});
  const led=new T.MeshStandardMaterial({color:0xe09035,emissive:0xe57918,emissiveIntensity:.7,roughness:.4});
  const add=(parent,geo,material,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  // Rounded machining edges catch studio light, while remaining primitive geometry.
  const roundedBox=(w,h,d)=>{const geo=new T.BoxGeometry(w,h,d,4,4,4),a=geo.attributes.position,n=geo.attributes.normal;
    const r=Math.min(w,h,d)*.16,c=new T.Vector3(w/2-r,h/2-r,d/2-r),v=new T.Vector3(),q=new T.Vector3();
    for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);q.set(T.MathUtils.clamp(v.x,-c.x,c.x),T.MathUtils.clamp(v.y,-c.y,c.y),T.MathUtils.clamp(v.z,-c.z,c.z));v.sub(q).normalize();n.setXYZ(i,v.x,v.y,v.z);q.addScaledVector(v,r);a.setXYZ(i,q.x,q.y,q.z);}return geo;};
  const box=(p,w,h,d,m,x=0,y=0,z=0)=>add(p,roundedBox(w,h,d),m,x,y,z);
  const oval=(x,y,z)=>{const geo=new T.SphereGeometry(1,20,12);geo.scale(x,y,z);return geo;};
  const cyl=(p,r,h,m,x,y,z,axis='y')=>{const geo=new T.CylinderGeometry(r,r,h,20);if(axis==='x')geo.rotateZ(Math.PI/2);if(axis==='z')geo.rotateX(Math.PI/2);return add(p,geo,m,x,y,z);};
  const rod=(p,a,b,r,m)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);const mesh=add(p,new T.CylinderGeometry(r,r,delta.length(),10),m,...av.clone().add(bv).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return mesh;};
  const bolts=[];
  const bolt=(p,x,y,z)=>{const geo=new T.CylinderGeometry(.009,.009,.009,6);geo.rotateX(Math.PI/2);bolts.push(add(p,geo,chrome,x,y,z));};

  // Low chassis and two continuous stadium-shaped caterpillar belts.
  box(g,.45,.12,.46,edge,0,.20,0);box(g,.42,.035,.40,alloy,0,.277,0);
  box(g,.35,.13,.25,blue,0,.345,-.045);
  box(g,.31,.025,.25,pale,0,.417,-.045);
  const wheels=[],belts=[],beltMeshes=[],radius=.134,half=.188,cy=.161;
  const perimeter=4*half+2*Math.PI*radius,cleats=40;
  function beltPoint(distance){let d=((distance%perimeter)+perimeter)%perimeter;
    if(d<2*half)return {y:cy+radius,z:-half+d,dy:0,dz:1};d-=2*half;
    if(d<Math.PI*radius){let a=d/radius;return {y:cy+radius*Math.cos(a),z:half+radius*Math.sin(a),dy:-Math.sin(a),dz:Math.cos(a)};}d-=Math.PI*radius;
    if(d<2*half)return {y:cy-radius,z:half-d,dy:0,dz:-1};d-=2*half;let a=d/radius;return {y:cy-radius*Math.cos(a),z:-half-radius*Math.sin(a),dy:Math.sin(a),dz:-Math.cos(a)};
  }
  const dummy=new T.Object3D();
  function setBelt(mesh,offset){for(let i=0;i<cleats;i++){let p=beltPoint(i*perimeter/cleats+offset);dummy.position.set(0,p.y,p.z);dummy.rotation.set(Math.atan2(-p.dy,p.dz),0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;}
  for(const s of [-1,1]){
    const track=new T.Group();track.position.x=s*.285;track.name=s<0?'left-track':'right-track';g.add(track);belts.push(track);
    box(track,.135,.17,.40,black,0,cy,0);
    const tread=new T.InstancedMesh(new T.BoxGeometry(.19,.027,.046),rubber,cleats);tread.castShadow=true;tread.receiveShadow=true;tread.frustumCulled=false;track.add(tread);beltMeshes.push(tread);setBelt(tread,0);
    for(const z of [-half,half]){
      const wheel=cyl(track,.118,.144,edge,0,cy,z,'x');wheels.push(wheel);
      cyl(wheel,.076,.154,alloy,0,0,0,'x');cyl(wheel,.029,.164,brass,0,0,0,'x');
      for(let k=0;k<5;k++){const a=k*Math.PI*2/5;box(wheel,.006,.02,.061,black,s*.081,Math.sin(a)*.051,Math.cos(a)*.051).rotation.x=-a;}
    }
    for(const z of [-.075,.075])cyl(track,.052,.151,black,0,.128,z,'x');
    box(track,.035,.055,.38,pale,s*.083,.235,0);
  }
  // Rear stabilizer caster and fork.
  rod(g,[-.1,.23,-.2],[-.1,.13,-.40],.018,alloy);rod(g,[.1,.23,-.2],[.1,.13,-.40],.018,alloy);
  cyl(g,.077,.07,rubber,0,.08,-.405,'x');cyl(g,.027,.08,alloy,0,.08,-.405,'x');

  // Turntable, exposed waist column, and shoulder frame.
  const waist=cyl(g,.138,.072,black,0,.45,-.035);
  cyl(waist,.115,.08,alloy,0,.05,0);
  const body=new T.Group();body.position.set(0,.52,-.035);g.add(body);
  box(body,.20,.32,.14,edge,0,.16,0);
  for(const s of [-1,1])rod(body,[s*.09,0,.065],[s*.16,.39,.065],.023,chrome);
  box(body,.38,.095,.21,pale,0,.395,0);
  box(body,.30,.25,.13,blue,0,.245,-.03);
  box(body,.255,.15,.04,alloy,0,.23,.062);
  box(body,.19,.078,.018,black,0,.26,.09);
  for(let i=0;i<6;i++)box(body,.018,.041,.008,edge,(i-2.5)*.029,.26,.104);
  box(body,.12,.025,.014,black,0,.165,.09);
  for(const x of [-.075,0,.075])box(body,.025,.014,.014,led,x,.338,.085);
  for(const x of [-.12,.12])for(const y of [.18,.29])bolt(body,x,y,.091);
  // Side electronics, fasteners and exposed service loops.
  for(const s of [-1,1]){
    box(body,.06,.14,.10,black,s*.174,.25,-.015);
    cyl(body,.024,.076,brass,s*.199,.285,-.015,'x');
    rod(body,[s*.08,.04,-.05],[s*.135,.29,-.115],.016,wire);
    const loop=add(body,new T.TorusGeometry(.081,.013,8,20,Math.PI*1.5),wire,s*.08,.15,-.095);loop.rotation.y=Math.PI/2;
  }
  // Short Circuit 2-inspired rear tool case, lid seam and carrying handle.
  box(body,.215,.16,.095,blue,0,.31,-.155);box(body,.23,.019,.11,alloy,0,.401,-.155);
  box(body,.095,.017,.018,black,0,.427,-.16);
  for(const x of [-.043,.043])box(body,.013,.04,.018,chrome,x,.411,-.16);

  // Neck gimbal: long parallel exposed pistons, cross shaft and small cables.
  rod(body,[-.078,.43,-.035],[-.075,.70,.015],.024,edge);
  rod(body,[.078,.43,-.035],[.075,.70,.015],.024,edge);
  for(const s of [-1,1])rod(body,[s*.075,.55,-.005],[s*.075,.74,.03],.012,chrome);
  cyl(body,.042,.23,alloy,0,.68,.015,'x');
  rod(body,[0,.43,-.073],[0,.74,-.055],.017,wire);
  for(let i=0;i<9;i++){const ring=add(body,new T.TorusGeometry(.021,.004,6,12),black,0,.46+i*.026,-.070+i*.0015);ring.rotation.x=Math.PI/2;}
  // Small hydraulic fittings and curved service hoses along the chassis.
  for(const s of [-1,1]){const hose=add(body,new T.TorusGeometry(.10,.009,8,24,Math.PI*1.4),black,s*.16,.14,.02);hose.rotation.y=Math.PI/2;hose.rotation.z=.4;
    cyl(body,.018,.045,brass,s*.19,.34,.055,'x');
    rod(body,[s*.14,.29,.075],[s*.14,.12,.095],.008,wire);
    box(body,.034,.031,.021,edge,s*.14,.11,.095);
  }
  const head=new T.Group();head.position.set(0,.735,.015);body.add(head);head.name='binocular-head';
  cyl(head,.032,.18,chrome,0,0,0,'x');box(head,.40,.047,.13,edge,0,.052,0);
  // Lens housings retain real binoculars instead of cartoon eyeballs.
  const optics=[];
  for(const s of [-1,1]){
    const eye=new T.Group();eye.position.set(s*.119,.12,.016);head.add(eye);optics.push(eye);
    box(eye,.218,.204,.18,pale,0,0,0);
    box(eye,.19,.172,.015,edge,0,0,.099);
    cyl(eye,.081,.058,black,0,0,.128,'z');
    cyl(eye,.073,.015,chrome,0,0,.16,'z');
    for(const z of [.118,.132,.146])add(eye,new T.TorusGeometry(.080,.004,6,24),edge,0,0,z);
    cyl(eye,.064,.017,black,0,0,.174,'z');
    add(eye,oval(.058,.058,.014),glass,0,0,.188);
    cyl(eye,.027,.012,black,0,0,.200,'z');
    add(eye,oval(.020,.009,.003),glint,-.018,.025,.204).rotation.z=-.4;
    for(const x of [-.087,.087])for(const y of [-.078,.078])bolt(eye,x,y,.112);
    box(eye,.031,.086,.082,black,s*.123,.015,-.022);
    cyl(eye,.024,.018,chrome,s*.145,.015,-.022,'x');
  }
  box(head,.044,.077,.065,edge,0,.126,.076);
  box(head,.15,.036,.085,black,0,-.026,.058);
  for(let i=0;i<5;i++)box(head,.014,.02,.011,alloy,(i-2)*.023,-.026,.106);

  // Five complete prebuilt mechanical expression sets. Only neutral is visible.
  const expressions={};
  const settings={neutral:{angle:0,y:.243,open:0,mouth:0},happy:{angle:-.18,y:.259,open:0,mouth:1},surprised:{angle:.02,y:.297,open:0,mouth:2},annoyed:{angle:.27,y:.214,open:.028,mouth:3},sleepy:{angle:-.04,y:.222,open:.071,mouth:4}};
  for(const [name,state] of Object.entries(settings)){
    const pieces=[];
    for(const s of [-1,1]){
      const brow=box(head,.229,.033,.19,pale,s*.119,state.y,.015);brow.rotation.z=s*state.angle;pieces.push(brow);
      if(state.open){const lid=box(head,.148,state.open,.014,edge,s*.119,.182-state.open/2,.209);pieces.push(lid);}
    }
    if(state.mouth===2){const ring=add(head,new T.TorusGeometry(.023,.006,6,16),chrome,0,-.03,.118);pieces.push(ring);}
    else {const bar=box(head,state.mouth===4?.045:.10,.012,.012,chrome,0,-.033,.12);pieces.push(bar);
      if(state.mouth===1){for(const s of [-1,1]){const tip=box(head,.032,.012,.012,chrome,s*.054,-.023,.12);tip.rotation.z=s*.55;pieces.push(tip);}}
    }
    pieces.forEach(m=>m.visible=name==='neutral');expressions[name]=pieces;
  }

  // Shoulder -> upper arm -> elbow -> forearm -> wrist -> three-finger gripper.
  const arms=[],elbows=[],wrists=[],fingers=[];
  for(const s of [-1,1]){
    cyl(body,.052,.085,edge,s*.225,.39,0,'x');
    const geo=new T.CylinderGeometry(.031,.031,.23,12);geo.translate(0,-.115,0);
    const arm=add(body,geo,alloy,s*.269,.39,0);arms.push(arm);arm.rotation.z=s*.12;
    cyl(arm,.043,.075,black,0,0,0,'x');
    rod(arm,[s*.033,-.02,0],[s*.033,-.21,0],.012,chrome);
    box(arm,.081,.061,.088,pale,0,-.105,0);
    const foreGeo=new T.BoxGeometry(.073,.19,.073);foreGeo.translate(0,-.095,0);
    const fore=add(arm,foreGeo,edge,0,-.23,0);elbows.push(fore);fore.rotation.x=-.55;
    cyl(fore,.043,.095,chrome,0,0,0,'x');
    rod(fore,[-.035,-.016,.044],[-.035,-.175,.044],.010,chrome);
    rod(fore,[.035,-.016,.044],[.035,-.175,.044],.010,chrome);
    const wrist=new T.Group();wrist.position.y=-.206;fore.add(wrist);wrists.push(wrist);
    cyl(wrist,.034,.042,black,0,0,0);
    box(wrist,.105,.061,.073,pale,0,-.044,0);
    for(const [fx,fz,angle] of [[-.041,.019,-.22],[.041,.019,.22],[0,-.035,0]]){
      const fingerGeo=new T.BoxGeometry(.025,.075,.025);fingerGeo.translate(0,-.0375,0);
      const finger=add(wrist,fingerGeo,alloy,fx,-.072,fz);finger.rotation.z=angle;finger.userData.restZ=angle;
      const tip=box(finger,.025,.036,.031,black,0,-.084,.012);tip.rotation.x=-.4;fingers.push(finger);
    }
  }

  const states=Object.keys(expressions);let expression='neutral',time=0,offsets=[0,0],disposed=false;
  function setExpression(name){if(!expressions[name])throw new Error('Unknown Johnny 5 expression: '+name);for(const [key,list] of Object.entries(expressions))list.forEach(m=>m.visible=key===name);expression=name;g.userData.expression=name;}
  // Also detect visibility changes made by the engine's existing switcher.
  function currentExpression(){return states.find(e=>expressions[e][0].visible)||expression;}
  function update(dt,state={}){
    if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;time+=dt;
    if(state.expression&&state.expression!==g.userData.expression)setExpression(state.expression);
    expression=currentExpression();g.userData.expression=expression;
    const speed=Number.isFinite(state.speed)?state.speed:0,turn=Number.isFinite(state.turn)?state.turn:0;
    for(let i=0;i<2;i++){const v=speed+(i===0?-turn:turn)*.285;offsets[i]+=v*dt;setBelt(beltMeshes[i],offsets[i]);for(let j=0;j<2;j++)wheels[i*2+j].rotation.x=offsets[i]/.118;}
    // The root is never moved; Bot Farm owns navigation and world placement.
    const sleepy=expression==='sleepy',energy=sleepy?.23:1;
    head.rotation.y=Number.isFinite(state.lookYaw)?T.MathUtils.clamp(state.lookYaw,-.65,.65):Math.sin(time*.61)*.12*energy;
    head.rotation.x=Number.isFinite(state.lookPitch)?T.MathUtils.clamp(state.lookPitch,-.35,.35):(sleepy?.18:expression==='surprised'?-.08:0)+Math.sin(time*1.1)*.028*energy;
    head.rotation.z=expression==='happy'?Math.sin(time*1.5)*.055:Math.sin(time*.47)*.02*energy;
    body.rotation.y=Math.sin(time*.4)*.024*energy;
    if(state.animateArms!==false){
      // Surprise takes priority over waving: both hands rise beside the head.
      // Smooth every controlled joint back to idle when the expression changes.
      const startled=expression==='surprised',mix=dt>0?1-Math.exp(-dt*12):1;
      const approach=(current,target)=>current+(target-current)*mix;
      arms.forEach((arm,i)=>{
        const side=i===0?-1:1;
        let shoulderX=Math.sin(time*1.2+i)*.09*energy,shoulderZ=side*.12;
        let elbowX=-.55+Math.sin(time*.8+i)*.10*energy,wristY=Math.sin(time*.7+i)*.11*energy;
        if(startled){shoulderX=-2.55;shoulderZ=side*.40;elbowX=-.35;wristY=side*.22;}
        else if(state.wave&&i===1){shoulderX=-2.3;shoulderZ=.12+Math.sin(time*5)*.2;elbowX=-.3;}
        arm.rotation.x=approach(arm.rotation.x,shoulderX);arm.rotation.z=approach(arm.rotation.z,shoulderZ);
        elbows[i].rotation.x=approach(elbows[i].rotation.x,elbowX);wrists[i].rotation.y=approach(wrists[i].rotation.y,wristY);
      });
      fingers.forEach((f,i)=>{
        const fingerX=startled?-.30:(sleepy?.12:.05)+Math.sin(time*1.3+i*.3)*.07*energy;
        const fingerZ=f.userData.restZ*(startled?1.75:1);
        f.rotation.x=approach(f.rotation.x,fingerX);f.rotation.z=approach(f.rotation.z,fingerZ);
      });
    }
  }
  g.userData={displayName:'Johnny 5',intro:'Johnny 5 is alive! More input, please.',arms,legs:[],tracks:belts,head,elbows,wrists,fingers,expressions,expression,locomotion:'tracks',update,setExpression,
    dispose(){disposed=true;g.removeFromParent();const gs=new Set(),ms=new Set();g.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);if(o.isInstancedMesh)o.dispose();});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());}};
  g.scale.setScalar(.85);update(0);return g;
}


export { createJohnny5 }

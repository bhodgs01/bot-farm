/**
 * The companions.
 *
 * Seven procedural characters delivered to the Bot Farm avatar standard: each is a factory
 * returning a THREE.Group that faces +z at root scale 0.85, carries the five moods (neutral,
 * happy, surprised, annoyed, sleepy) on `userData.setExpression`, and drives its own limbs
 * from `userData.animate(elapsedSeconds, walking)`.
 *
 * They arrived expecting a global THREE, the way the earlier mascot packs did. Rather than
 * leave a global lying about, the import below is what they close over — the bodies are
 * otherwise exactly as delivered, so a redelivery can be dropped in beside them.
 *
 * Do not animate the same joints from two systems at once: the walk loop gives each one a
 * speed and a heading and leaves the posing to its own animate().
 */
import * as THREE from 'three'

function createR2D2() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.12,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const ball=(name,xr,yr,zr,m,p,x=0,y=0,z=0)=>{const a=new THREE.SphereGeometry(1,16,10);a.scale(xr,yr,zr);return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const a=new THREE.Group();a.name=name;a.position.set(x,y,z);p.add(a);return a;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.TorusGeometry(r,t,6,24),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalk=false;

  const white=mat('Ivory shell',0xe8ece9),blue=mat('Cobalt panels',0x2453a6),silver=mat('Dome alloy',0xa4b0b6),black=mat('Optic black',0x14202a),red=mat('Status red',0xd84934,.5);
  cyl('Barrel body',.235,.48,white,g,0,.43,0);
  const head=mesh('Silver dome',new THREE.SphereGeometry(.237,20,10,0,Math.PI*2,0,Math.PI/2),silver,g,0,.675,0);g.userData.head=head;
  cyl('Blue dome band',.24,.041,blue,head,0,.014,0);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh('Dome blue panel',new THREE.SphereGeometry(.239,6,4,a,.29,.23,.77),blue,head);}
  box('Camera housing',.085,.081,.048,blue,head,-.067,.102,.211);
  ball('Camera lens',.030,.030,.015,black,head,-.067,.103,.242);
  ball('Red indicator',.021,.021,.012,red,head,.061,.056,.238);
  const projector=cyl('Holo projector',.027,.043,silver,head,.09,.113,.20);projector.rotation.x=Math.PI/2;
  for(let i=0;i<3;i++)box('Front blue strip',.27,.038,.023,blue,g,0,.58-i*.065,.232);
  for(const x of [-.053,.053]){box('Utility grille surround',.073,.135,.025,silver,g,x,.30,.233);for(let i=0;i<2;i++)box('Utility slot',.05,.025,.012,black,g,x,.28+i*.05,.251);}
  for(const s of [-1,1]){ball('Shoulder',.069,.088,.071,silver,g,s*.275,.59,0);box('Side leg',.076,.34,.084,white,g,s*.29,.355,0);box('Leg blue insert',.042,.20,.012,blue,g,s*.29,.37,.05);box('Side foot',.16,.09,.24,white,g,s*.29,.045,.07);}
  box('Third leg',.065,.20,.075,silver,g,0,.16,.06);box('Third foot',.13,.08,.18,white,g,0,.04,.13);
  function pose(e,t,w){head.rotation.y=[0,.24,0,-.35,.06][e]+Math.sin(t*(e===1?3:1.2))*(e===4?.015:.06);head.rotation.z=[0,.055,0,-.06,.08][e];head.position.y=.675+[0,.015,.045,0,-.006][e];projector.scale.y=e===2?1.7:1;red.emissiveIntensity=[.5,.9,.95,.25,.12][e];}

  g.userData.expressionNames=names.slice();
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalk=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalk);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createBB8() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.12,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const ball=(name,xr,yr,zr,m,p,x=0,y=0,z=0)=>{const a=new THREE.SphereGeometry(1,16,10);a.scale(xr,yr,zr);return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const a=new THREE.Group();a.name=name;a.position.set(x,y,z);p.add(a);return a;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.TorusGeometry(r,t,6,24),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalk=false;

  const white=mat('White enamel',0xf0efdf),orange=mat('Orange rings',0xd7802c),grey=mat('Mechanisms',0x727d82),black=mat('Camera black',0x0c1720),glint=mat('Optic glint',0x7baabc,.25);
  const body=ball('Rolling sphere',.31,.31,.31,white,g,0,.35,0);g.userData.ball=body;
  for(const dir of [[0,0,1],[1,0,0],[-1,0,0],[0,0,-1],[0,1,0],[0,-1,0]]){
    const hub=joint('Circular panel',body,...dir.map(v=>v*.290));hub.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...dir));
    ring('Orange ring',.142,.025,orange,hub);const plate=cyl('Panel center',.112,.018,grey,hub,0,0,.028);plate.rotation.x=Math.PI/2;
    box('Panel rib',.033,.15,.027,white,hub,0,0,.045);
  }
  const head=mesh('Dome head',new THREE.SphereGeometry(.205,20,10,0,Math.PI*2,0,Math.PI/2),white,g,0,.657,0);g.userData.head=head;
  cyl('Lower grey band',.205,.028,grey,head);
  const stripe=ring('Orange head stripe',.177,.014,orange,head,0,.084,0);stripe.rotation.x=Math.PI/2;
  ball('Main optic rim',.075,.075,.033,grey,head,-.05,.094,.163);
  ball('Main black optic',.060,.060,.032,black,head,-.05,.094,.188);
  ball('Optic catchlight',.013,.017,.008,glint,head,-.073,.116,.217);
  ball('Small optic',.028,.028,.022,black,head,.079,.059,.187);
  rod('Tall antenna',[.058,.13,-.06],[.058,.30,-.06],.007,grey,head);rod('Short antenna',[-.065,.15,-.03],[-.065,.24,-.03],.009,grey,head);
  function pose(e,t,w){body.rotation.x=w?t*Math.PI/2:0;body.position.y=.35+(w?.006:0);head.rotation.z=[0,.19,0,-.20,.23][e]+Math.sin(t*1.5)*.018;head.rotation.x=[0,-.08,-.18,.08,.18][e];head.rotation.y=[0,.12,0,-.23,.05][e];head.position.y=.657+(w?.006:0)+[0,.012,.035,0,0][e];}

  g.userData.expressionNames=names.slice();
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalk=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalk);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createRocky() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.12,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const ball=(name,xr,yr,zr,m,p,x=0,y=0,z=0)=>{const a=new THREE.SphereGeometry(1,16,10);a.scale(xr,yr,zr);return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const a=new THREE.Group();a.name=name;a.position.set(x,y,z);p.add(a);return a;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.TorusGeometry(r,t,6,24),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalk=false;

  const stone=mat('Stone carapace',0x857665),dark=mat('Joint shadows',0x504a41),patch=mat('Mineral patches',0x548b78);
  const body=ball('Fivefold carapace',.25,.17,.25,stone,g,0,.55,0);g.userData.head=body;
  const limbs=[];
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;const limb=joint('Limb '+i,g,Math.sin(a)*.19,.55,Math.cos(a)*.19);limb.rotation.y=a;limbs.push(limb);
    ball('Shoulder',.077,.081,.077,dark,limb);
    const upper=ball('Upper stone segment',.075,.075,.18,stone,limb,0,-.055,.14);upper.rotation.x=.38;
    ball('Outer joint',.064,.068,.068,dark,limb,0,-.13,.28);
    const lower=ball('Lower stone segment',.069,.20,.072,stone,limb,0,-.31,.32);lower.rotation.x=-.18;
    ball('Mineral marking',.027,.015,.043,patch,limb,.025,.012,.13);
  }
  for(const x of [-.09,.06])ball('Shell mineral',.033,.018,.05,patch,body,x,.153,.025);
  g.userData.limbs=limbs;
  // Rocky has no face: five moods are expressed with stance, shell height and limb gestures.
  function pose(e,t,w){const lift=[0,.035,.07,0,-.028][e];body.position.y=.55+lift;body.scale.y=[1,1,1.14,.92,.82][e];body.rotation.y=Math.sin(t*(e===1?3:1))*.025;limbs.forEach((l,i)=>{l.position.y=.55+lift+(w?Math.max(0,Math.sin(t*5+i*2.5))*.045:0);l.rotation.x=[0,-.07,-.13,.10,.035][e]+(w?Math.sin(t*5+i*2.5)*.04:0);l.rotation.z=e===1?Math.sin(t*3+i)*.065:0;});}

  g.userData.expressionNames=names.slice();
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalk=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalk);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createNekoBus() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.12,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const ball=(name,xr,yr,zr,m,p,x=0,y=0,z=0)=>{const a=new THREE.SphereGeometry(1,16,10);a.scale(xr,yr,zr);return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const a=new THREE.Group();a.name=name;a.position.set(x,y,z);p.add(a);return a;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.TorusGeometry(r,t,6,24),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalk=false;

  const fur=mat('Golden fur',0xc68d43),dark=mat('Brown stripes',0x65442d),cream=mat('Cream muzzle',0xffe4a0),glass=mat('Warm cabin windows',0xffd278,.25),black=mat('Eyes and smile',0x251d19),white=mat('Teeth',0xfff5d3);
  const body=box('Long bus body',.61,.43,1.12,fur,g,0,.43,-.08);
  ball('Rounded bus roof',.31,.10,.57,fur,g,0,.64,-.08);
  const head=ball('Cat face',.35,.25,.20,fur,g,0,.51,.53);g.userData.head=head;
  for(const s of [-1,1]){
    mesh('Pointed ear',new THREE.ConeGeometry(.105,.23,4),fur,head,s*.245,.235,-.02);
    ball('Eye',.087,.071,.025,cream,head,s*.15,.055,.171);
    ball('Slit pupil',.020,.056,.014,black,head,s*.15,.055,.194);
  }
  const mouth=ball('Wide cat grin',.234,.075,.028,black,head,0,-.096,.182);
  box('Toothy grin',.395,.068,.025,white,mouth,0,0,.026);
  ball('Pink nose',.043,.026,.029,dark,head,0,.005,.202);
  for(const s of [-1,1])for(let i=0;i<4;i++)box('Passenger window',.018,.19,.16,glass,g,s*.306,.48,-.46+i*.225);
  const legs=[];
  for(const s of [-1,1])for(let i=0;i<6;i++){
    const geo=new THREE.SphereGeometry(1,10,6);geo.scale(.073,.115,.10);geo.translate(s*.028,-.105,.027);
    legs.push(mesh('Cat paw '+s+' '+i,geo,fur,g,s*.28,.22,-.53+i*.20));
  }
  const tailGeo=new THREE.SphereGeometry(1,12,8);tailGeo.scale(.065,.075,.24);tailGeo.rotateX(-.4);tailGeo.translate(0,.07,-.20);
  const tail=mesh('Tail',tailGeo,dark,g,0,.44,-.60);g.userData.tail=tail;
  for(let i=0;i<3;i++)ball('Roof stripe',.25,.022,.045,dark,g,0,.724,-.39+i*.24);
  g.userData.legs=legs;
  function pose(e,t,w){head.rotation.z=[0,.10,0,-.12,.16][e];head.rotation.x=[0,-.06,-.16,.07,.18][e];mouth.scale.y=[1,1.3,1.8,.5,.25][e];tail.rotation.y=Math.sin(t*(e===1?3:1.4))*(e===4?.06:.22);legs.forEach((l,i)=>{l.rotation.x=w?Math.sin(t*8+i*1.8)*.18:0;l.position.y=.22+(w?.005:0);});}

  g.userData.expressionNames=names.slice();
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalk=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalk);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createPitDroid() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.12,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const ball=(name,xr,yr,zr,m,p,x=0,y=0,z=0)=>{const a=new THREE.SphereGeometry(1,16,10);a.scale(xr,yr,zr);return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.CylinderGeometry(r,r,h,16),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const a=new THREE.Group();a.name=name;a.position.set(x,y,z);p.add(a);return a;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.TorusGeometry(r,t,6,24),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalk=false;

  const tan=mat('Worn ochre',0xc9b16a),teal=mat('Teal panels',0x4c827e),metal=mat('Dark joints',0x3f4844),black=mat('Optic',0x111c23),lens=mat('Lens glint',0x799daf,.3);
  box('Torso',.20,.23,.15,tan,g,0,.58,0);box('Chest panel',.13,.14,.012,teal,g,0,.61,.082);
  ball('Hip joint',.12,.075,.075,metal,g,0,.435,0);
  rod('Neck',[0,.69,0],[0,.82,0],.032,metal,g);
  const geo=new THREE.SphereGeometry(.22,16,8,0,Math.PI*2,0,Math.PI/2);geo.scale(1,.50,.92);
  const head=mesh('Saucer head',geo,tan,g,0,.82,0);g.userData.head=head;
  const rim=cyl('Saucer rim',.225,.023,teal,head);rim.scale.z=.92;
  const optic=cyl('Large eye rim',.084,.065,tan,head,0,.035,.185);optic.rotation.x=Math.PI/2;
  ball('Black camera',.065,.065,.030,black,head,0,.035,.228);
  ball('Camera reflection',.014,.018,.008,lens,head,-.024,.06,.256);
  rod('Antenna',[.105,.07,-.07],[.13,.27,-.07],.009,metal,head);
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const arm=joint('Arm '+s,g,s*.14,.65,0);arms.push(arm);
    ball('Shoulder',.045,.045,.045,teal,arm);
    rod('Upper arm',[0,0,0],[s*.035,-.14,.025],.024,tan,arm);
    ball('Elbow',.033,.033,.033,metal,arm,s*.035,-.14,.025);
    rod('Forearm',[s*.035,-.14,.025],[s*.045,-.26,.075],.029,tan,arm);
    for(const f of [-1,1])box('Pincer',.022,.068,.028,tan,arm,s*.045+f*.034,-.285,.075);
    const leg=joint('Leg '+s,g,s*.074,.43,0);legs.push(leg);
    rod('Thigh',[0,0,0],[s*.018,-.16,.015],.029,tan,leg);
    ball('Knee',.038,.038,.038,teal,leg,s*.018,-.16,.015);
    rod('Shin',[s*.018,-.16,.015],[s*.033,-.345,.025],.026,tan,leg);
    box('Broad foot',.105,.07,.19,tan,leg,s*.033,-.395,.065);
  }
  g.userData.arms=arms;g.userData.legs=legs;
  function pose(e,t,w){head.rotation.z=[0,.20,0,-.20,.22][e]+Math.sin(t*1.3)*.018;head.rotation.x=[0,-.08,-.25,.14,.31][e];head.position.y=[.82,.85,.88,.80,.76][e];arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[.04,.45,.85,-.06,.01][e];a.rotation.x=w?Math.sin(t*6+i*Math.PI)*.18:0;});legs.forEach((l,i)=>{l.rotation.x=w?Math.sin(t*6+i*Math.PI)*.10:0;l.position.y=.43+(w?.022:0);});}

  g.userData.expressionNames=names.slice();
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalk=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalk);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createWallE() {
  const g = new THREE.Group();
  const mat = (name,color,roughness=.7,metalness=.05,emissive=0) => { const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:false});m.name=name;if(emissive){m.emissive.set(color);m.emissiveIntensity=emissive;}return m; };
  const mesh=(name,geo,material,parent=g,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,material);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const rounded=(w,h,d,r=.02)=>{r=Math.min(r,w*.49,h*.49,d*.49);const a=new THREE.BoxGeometry(w,h,d,6,6,6),p=a.attributes.position,n=a.attributes.normal;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),c=new THREE.Vector3(Math.max(-w/2+r,Math.min(w/2-r,v.x)),Math.max(-h/2+r,Math.min(h/2-r,v.y)),Math.max(-d/2+r,Math.min(d/2-r,v.z))),u=v.clone().sub(c).normalize();v.copy(c).addScaledVector(u,r);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,u.x,u.y,u.z);}return a;};
  const B=(name,w,h,d,material,parent=g,x=0,y=0,z=0,r=.015)=>mesh(name,rounded(w,h,d,r),material,parent,x,y,z);
  const ellipsoid=(x,y,z)=>{const a=new THREE.SphereGeometry(1,24,16);a.scale(x,y,z);return a;};
  const combined=geos=>{const p=[],n=[],uv=[];for(const src of geos){const a=src.index?src.toNonIndexed():src;for(const v of a.attributes.position.array)p.push(v);for(const v of a.attributes.normal.array)n.push(v);if(a.attributes.uv)for(const v of a.attributes.uv.array)uv.push(v);else for(let i=0;i<a.attributes.position.count;i++)uv.push(0,0);}const a=new THREE.BufferGeometry();a.setAttribute('position',new THREE.Float32BufferAttribute(p,3));a.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));a.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return a;};

  g.name='WallE';
  const yellow=mat('Weathered golden yellow',0xc8932b,.72,.15),edge=mat('Yellow edge trim',0xe5b246,.65,.12),dark=mat('Dark mechanics',0x30373a,.69,.3),rubber=mat('Rubber tracks',0x161c20,.94,0),steel=mat('Warm silver',0xa3a5a0,.38,.6),shadow=mat('Recesses',0x141b20,.55),lens=mat('Optical glass',0x194253,.25,.25),blue=mat('Lens reflection',0x55abc9,.26,.1,.25),white=mat('Eye glints',0xd2eef0,.3),rust=mat('Scuffs',0x7f5630,.89),red=mat('Status lamp',0xe57142,.5,.1,.35);
  B('Compactor body',.49,.38,.40,yellow,g,0,.43,0,.035);
  B('Top rim',.52,.07,.42,edge,g,0,.625,0,.015);
  B('Compactor front door',.40,.245,.035,edge,g,0,.428,.218,.015);
  B('Door recess',.30,.13,.014,yellow,g,0,.425,.242,.007);
  B('Upper chest strip',.32,.041,.014,dark,g,0,.564,.23,.004);
  const lamps=[];for(let i=0;i<4;i++)lamps.push(new THREE.BoxGeometry(.029,.017,.013).translate(-.064+i*.043,.565,.243));mesh('Charge indicators',combined(lamps),red);
  const trim=[];for(const x of [-.19,.19])for(const y of [.34,.515])trim.push(new THREE.CylinderGeometry(.012,.012,.012,8).rotateX(Math.PI/2).translate(x,y,.24));trim.push(new THREE.CylinderGeometry(.018,.018,.32,12).rotateZ(Math.PI/2).translate(0,.29,.209));mesh('Door hinge and bolts',combined(trim),steel);
  const marks=[];for(const [x,y,w]of [[-.17,.32,.06],[.12,.48,.035],[-.07,.50,.045],[.16,.37,.025]])marks.push(new THREE.BoxGeometry(w,.006,.005).translate(x,y,.242));mesh('Small worn edges',combined(marks),rust);
  // Treads run fore/aft along Z. Each belt is one solid extruded shape.
  const belt=()=>{const s=new THREE.Shape();s.moveTo(-.235,0);s.lineTo(.23,0);s.quadraticCurveTo(.31,0,.315,.075);s.lineTo(.315,.13);s.quadraticCurveTo(.31,.175,.26,.205);s.lineTo(.18,.25);s.lineTo(-.20,.25);s.quadraticCurveTo(-.31,.235,-.315,.13);s.lineTo(-.315,.075);s.quadraticCurveTo(-.31,0,-.235,0);s.closePath();const a=new THREE.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false,curveSegments:8});a.translate(0,0,-.075);a.rotateY(Math.PI/2);return a;};
  const wheels=[],treads=[],hubs=[];
  for(const side of [-1,1]){
    mesh(side<0?'Left track':'Right track',belt(),rubber,g,side*.32,0,0);
    for(const z of [-.19,.19]){
      const wheel=mesh('Track wheel',new THREE.CylinderGeometry(.094,.094,.016,20).rotateZ(Math.PI/2),dark,g,side*.403,.116,z);wheels.push(wheel);
      const spokes=[];for(let i=0;i<5;i++){const a=i*Math.PI*2/5;spokes.push(new THREE.BoxGeometry(.02,.10,.015).rotateX(a).translate(side*.012,0,0));}mesh('Wheel hub spokes',combined(spokes),steel,wheel);}
    for(let i=0;i<11;i++){const z=-.245+i*.049; treads.push(new THREE.BoxGeometry(.159,.021,.026).translate(side*.32,.0105,z));treads.push(new THREE.BoxGeometry(.159,.021,.025).translate(side*.32,.249-Math.max(0,Math.abs(z)-.18)*.62,z));}
    for(const z of [-.314,.314])for(const y of [.058,.108,.158])treads.push(new THREE.BoxGeometry(.158,.022,.018).translate(side*.32,y,z));
  }
  mesh('Chunky tread cleats',combined(treads),dark);
  B('Neck lift',.085,.16,.10,dark,g,0,.727,-.055,.012);
  mesh('Neck piston',new THREE.CylinderGeometry(.025,.025,.15,12),steel,g,0,.73,.011);
  // The head mesh is the neck joint. All optics are children, so looking moves the whole face.
  const head=mesh('Head pivot',rounded(.105,.060,.10,.012).translate(0,.025,0),dark,g,0,.78,.008);
  const pods=[],lids=[];
  for(const side of [-1,1]){
    const pod=new THREE.Group();pod.name=side<0?'Left optic pivot':'Right optic pivot';pod.position.set(side*.145,.067,.045);head.add(pod);
    mesh('Binocular housing',rounded(.275,.205,.19,.055),steel,pod);
    mesh('Black lens gasket',new THREE.CylinderGeometry(.084,.084,.024,24).rotateX(Math.PI/2),shadow,pod,0,0,.102);
    mesh('Camera lens',new THREE.CylinderGeometry(.067,.067,.017,24).rotateX(Math.PI/2),lens,pod,0,0,.120);
    const rim=new THREE.TorusGeometry(.045,.008,6,24).translate(0,0,.133),glint=ellipsoid(.012,.018,.006).translate(-.023,.026,.136);
    mesh('Lens rim and reflection',combined([rim,glint]),blue,pod);
    const lid=B('Mechanical eyelid',.253,.111,.018,steel,pod,0,0,0,.008);
    pods.push(pod);lids.push(lid);
  }
  const arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.name=side<0?'Left arm pivot':'Right arm pivot';arm.position.set(side*.27,.56,.035);g.add(arm);
    // Both arm and hand geometries are translated away from the shoulder joint.
    mesh('Arm shaft',rounded(.21,.072,.08,.012).translate(side*.085,-.025,.02),steel,arm);
    mesh('Shoulder axle',new THREE.CylinderGeometry(.048,.048,.09,12).rotateZ(Math.PI/2),dark,arm,0,0,0);
    B('Palm',.12,.065,.105,yellow,arm,side*.18,-.045,.087,.013);
    const fingers=[];for(const dx of [-.034,.034])fingers.push(rounded(.027,.037,.12,.009).translate(side*.18+dx,-.047,.18));mesh('Two grabber fingers',combined(fingers),steel,arm);
    arms.push(arm);
  }
  const expressionNames=['neutral','happy','surprised','annoyed','sleepy'];
  let expression='neutral',lastSeconds=0,lastMoving=false;
  g.userData.head=head;g.userData.arms=arms;g.userData.wheels=wheels;g.userData.eyes=pods;
  g.userData.expressionNames=expressionNames.slice();g.userData.expression='neutral';
  const settings={
    neutral:{roll:.10,lidY:0,lidZ:0,headX:0,headZ:0,headY:.78,spread:.145,armX:0},
    happy:{roll:-.20,lidY:-.058,lidZ:.151,headX:-.035,headZ:.08,headY:.78,spread:.145,armX:-.20},
    surprised:{roll:0,lidY:0,lidZ:0,headX:-.14,headZ:0,headY:.802,spread:.164,armX:-.52},
    annoyed:{roll:.26,lidY:.063,lidZ:.151,headX:.045,headZ:-.035,headY:.78,spread:.145,armX:.04},
    sleepy:{roll:.13,lidY:.024,lidZ:.151,headX:.14,headZ:.07,headY:.77,spread:.145,armX:.17}
  };
  g.userData.animate=(seconds,moving=false)=>{
    lastSeconds=seconds;lastMoving=moving;const s=settings[expression],phase=seconds*Math.PI/2;
    head.rotation.set(s.headX,.10*Math.sin(phase),s.headZ+.02*Math.sin(phase));head.position.y=s.headY;
    pods.forEach((pod,i)=>{const side=i===0?-1:1;pod.position.x=side*s.spread;pod.rotation.z=side*s.roll;lids[i].position.set(0,s.lidY,s.lidZ);});
    arms.forEach((arm,i)=>{arm.rotation.x=s.armX+(moving?.15:.045)*Math.sin(phase+i*Math.PI);arm.rotation.z=(i===0?1:-1)*.08;});
    wheels.forEach(w=>w.rotation.x=moving?-seconds*Math.PI*2:0);
  };
  g.userData.setExpression=(name)=>{
    if(!expressionNames.includes(name))throw new Error('Unknown expression: '+name);
    expression=name;g.userData.expression=name;g.userData.animate(lastSeconds,lastMoving);return g;
  };
  g.userData.expressions=Object.fromEntries(expressionNames.map(name=>[name,()=>g.userData.setExpression(name)]));
  g.userData.setExpression('neutral');
  g.scale.setScalar(.85);return g;
}

function createEve() {
  const g = new THREE.Group();
  const mat = (name,color,roughness=.7,metalness=.05,emissive=0) => { const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:false});m.name=name;if(emissive){m.emissive.set(color);m.emissiveIntensity=emissive;}return m; };
  const mesh=(name,geo,material,parent=g,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,material);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const rounded=(w,h,d,r=.02)=>{r=Math.min(r,w*.49,h*.49,d*.49);const a=new THREE.BoxGeometry(w,h,d,6,6,6),p=a.attributes.position,n=a.attributes.normal;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),c=new THREE.Vector3(Math.max(-w/2+r,Math.min(w/2-r,v.x)),Math.max(-h/2+r,Math.min(h/2-r,v.y)),Math.max(-d/2+r,Math.min(d/2-r,v.z))),u=v.clone().sub(c).normalize();v.copy(c).addScaledVector(u,r);p.setXYZ(i,v.x,v.y,v.z);n.setXYZ(i,u.x,u.y,u.z);}return a;};
  const B=(name,w,h,d,material,parent=g,x=0,y=0,z=0,r=.015)=>mesh(name,rounded(w,h,d,r),material,parent,x,y,z);
  const ellipsoid=(x,y,z)=>{const a=new THREE.SphereGeometry(1,24,16);a.scale(x,y,z);return a;};
  const combined=geos=>{const p=[],n=[],uv=[];for(const src of geos){const a=src.index?src.toNonIndexed():src;for(const v of a.attributes.position.array)p.push(v);for(const v of a.attributes.normal.array)n.push(v);if(a.attributes.uv)for(const v of a.attributes.uv.array)uv.push(v);else for(let i=0;i<a.attributes.position.count;i++)uv.push(0,0);}const a=new THREE.BufferGeometry();a.setAttribute('position',new THREE.Float32BufferAttribute(p,3));a.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));a.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return a;};

  g.name='Eve';
  const shell=mat('Pearl white shell',0xecf1ee,.28,.18),shade=mat('Shell seams',0xb6c4c9,.45,.15),black=mat('Glossy black visor',0x09141c,.22,.25),cyan=mat('Cyan eyes',0x14cfff,.30,.05,.8),blue=mat('Lower thruster',0x70dafa,.38,.1,.35);
  // Body and head float together. Root origin remains on the ground for navigation.
  const hover=new THREE.Group();hover.name='Hover pivot';g.add(hover);
  const body=mesh('Egg body',ellipsoid(.235,.285,.18),shell,hover,0,.425,0);
  const head=mesh('Head pivot',ellipsoid(.253,.160,.19),shell,hover,0,.89,0);
  // Shallow front visor follows the oval head silhouette; finished white reverse side.
  mesh('Face visor',ellipsoid(.212,.111,.045),black,head,0,-.002,.168);
  const expressionNames=['neutral','happy','surprised','annoyed','sleepy'];
  if ('morphTargets' in cyan) cyan.morphTargets = true; // Three.js r128 compatibility.
  const eyes=[];
  for(const side of [-1,1]){
    const geo=ellipsoid(.053,.064,.007),base=geo.attributes.position;
    geo.morphAttributes.position=expressionNames.map(name=>{
      const a=base.clone();for(let i=0;i<a.count;i++){
        const x=base.getX(i),y=base.getY(i),z=base.getZ(i);let xx=x,yy=y;
        if(name==='happy'){xx=x*1.08;yy=y*.16+.039*(1-Math.pow(x/.053,2))-.012;}
        if(name==='surprised'){xx=x*1.12;yy=y*1.15;}
        if(name==='annoyed'){xx=x*1.05;yy=y*.30+side*.40*x;}
        if(name==='sleepy'){xx=x*.92;yy=y*.075-.015;}
        a.setXYZ(i,xx,yy,z);
      }return a;
    });
    const eye=mesh(side<0?'Left eye':'Right eye',geo,cyan,head,side*.088,.002,.210);eyes.push(eye);
  }
  const arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.name=side<0?'Left arm pivot':'Right arm pivot';arm.position.set(side*.24,.65,0);hover.add(arm);
    const fin=ellipsoid(.064,.205,.116);fin.rotateZ(-side*.08);fin.translate(side*.018,-.145,.007);mesh('Floating arm shell',fin,shell,arm);arms.push(arm);
  }
  // Recessed chest hatch and a small illuminated drive point, not extra floating props.
  const seam=new THREE.TorusGeometry(.081,.006,5,28);seam.scale(1,.78,1);mesh('Chest hatch seam',seam,shade,hover,0,.49,.175);
  mesh('Chest hatch',ellipsoid(.077,.060,.009),shell,hover,0,.49,.178);
  mesh('Thruster recess',new THREE.CylinderGeometry(.054,.054,.012,20),black,hover,0,.15,0);
  mesh('Soft thruster light',new THREE.CylinderGeometry(.034,.034,.013,20),blue,hover,0,.141,0);
  let expression='neutral',lastSeconds=0,lastMoving=false;
  g.userData.head=head;g.userData.arms=arms;g.userData.hover=hover;g.userData.eyes=eyes;
  g.userData.expressionNames=expressionNames.slice();g.userData.expression='neutral';
  const settings={neutral:{headX:0,headZ:0,spread:.08},happy:{headX:-.03,headZ:.10,spread:.20},surprised:{headX:-.14,headZ:0,spread:.29},annoyed:{headX:.035,headZ:-.035,spread:.04},sleepy:{headX:.11,headZ:.06,spread:.035}};
  g.userData.animate=(seconds,moving=false)=>{
    lastSeconds=seconds;lastMoving=moving;const phase=seconds*Math.PI/2,s=settings[expression];
    hover.position.y=.027*Math.sin(phase);hover.rotation.x=moving?.10:0;
    head.rotation.set(s.headX,.10*Math.sin(phase),s.headZ);
    arms.forEach((arm,i)=>{arm.rotation.z=(i===0?-1:1)*(s.spread+.03*Math.sin(phase));arm.rotation.x=.05*Math.sin(phase+i*Math.PI);});
    const p=((seconds%4)+4)%4,blink=Math.max(0,1-Math.abs(p-3.2)/.11);
    eyes.forEach(eye=>{eye.morphTargetInfluences.fill(0);eye.morphTargetInfluences[expressionNames.indexOf(expression)]=1;eye.scale.y=1-.92*blink;});
  };
  g.userData.setExpression=(name)=>{
    if(!expressionNames.includes(name))throw new Error('Unknown expression: '+name);
    expression=name;g.userData.expression=name;g.userData.animate(lastSeconds,lastMoving);return g;
  };
  g.userData.expressions=Object.fromEntries(expressionNames.map(name=>[name,()=>g.userData.setExpression(name)]));
  g.userData.setExpression('neutral');
  g.scale.setScalar(.85);return g;
}

export { createR2D2, createBB8, createRocky, createNekoBus, createPitDroid, createWallE, createEve }

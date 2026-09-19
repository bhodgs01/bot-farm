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

function createBaymax() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const white=mat('Soft white vinyl',0xf4f2e9,.48),seam=mat('Vinyl seams',0xcbd0ca),black=mat('Black optics',0x111c24),silver=mat('Access port',0xa9b7bc,.42,.25);
  const bodyGeo=new THREE.SphereGeometry(1,28,20);
  const bp=bodyGeo.attributes.position;for(let i=0;i<bp.count;i++){const y=bp.getY(i),taper=1-.18*y;bp.setXYZ(i,bp.getX(i)*.265*taper,y*.35,bp.getZ(i)*.211*taper+.016*(1-y));}bodyGeo.computeVertexNormals();
  mesh('Continuous pear-shaped inflatable body',bodyGeo,white,g,0,.425,0);
  const head=ball('Small oval head',.19,.127,.135,white,g,0,.84,.033);g.userData.head=head;
  const eyes=[];for(const s of [-1,1]){eyes.push(ball('Eye '+s,.023,.023,.009,black,head,s*.076,.007,.128));}
  box('Eye connector',.15,.008,.008,black,head,0,.007,.132);
  const port=cyl('Chest access disc',.030,.009,silver,g,-.098,.625,.185);port.rotation.x=Math.PI/2;
  const inset=cyl('Chest disc inset',.021,.012,white,g,-.098,.625,.191);inset.rotation.x=Math.PI/2;
  box('Disc seam',.032,.004,.008,seam,g,-.098,.625,.201);
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=joint('Arm '+s,g,s*.225,.655,0);arms.push(a);
    const upper=ball('Upper inflatable arm',.096,.18,.095,white,a,s*.065,-.105,.005);upper.rotation.z=s*.22;
    ball('Elbow seam',.08,.049,.079,seam,a,s*.105,-.25,.012);
    ball('Forearm',.091,.13,.087,white,a,s*.12,-.325,.035);
    ball('Palm',.082,.072,.065,white,a,s*.118,-.438,.052);
    for(let i=0;i<3;i++)ball('Rounded finger',.021,.047,.025,white,a,s*.118+(i-1)*.043,-.481,.055);
    ball('Thumb',.030,.050,.03,white,a,s*.058,-.435,.079);
    const l=joint('Leg '+s,g,s*.113,.23,0);legs.push(l);
    ball('Short leg',.098,.15,.102,white,l,0,-.073,0);
    ball('Foot',.105,.051,.126,white,l,0,-.178,.036);
    ball('Hip seam',.092,.038,.091,seam,g,s*.128,.224,-.021);
  }
  g.userData.arms=arms;g.userData.legs=legs;g.userData.eyes=eyes;
  function pose(e,t,w){head.rotation.z=[0,.12,0,-.12,.20][e]+Math.sin(t*1.1)*.012;head.rotation.x=[0,-.05,-.16,.12,.22][e];head.position.y=[.84,.85,.875,.83,.81][e];eyes.forEach(q=>q.scale.y=[1,.55,1.25,.42,.10][e]);arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[.04,.36,.60,-.05,.02][e];a.rotation.x=w?Math.sin(t*4+i*Math.PI)*.10:0;});legs.forEach((l,i)=>{l.rotation.x=w?Math.sin(t*4+i*Math.PI)*.13:0;l.position.y=.23+(w?.020:0);});}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createGizmo() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const fur=mat('Chestnut fur',0x875737),light=mat('Cream fur',0xeedcb1),ear=mat('Pink inner ears',0xc58e7f),dark=mat('Dark muzzle',0x402d26),black=mat('Dark glossy eyes',0x171510,.25),white=mat('Eye highlights',0xfff7e5),nosemat=mat('Small nose',0x74534a);
  ball('Round furry body',.20,.265,.155,fur,g,0,.32,0);
  ball('Cream belly',.15,.22,.035,light,g,0,.33,.14);
  const head=ball('Large Mogwai head',.245,.224,.167,fur,g,0,.72,.013);g.userData.head=head;
  const ears=[];
  for(const s of [-1,1]){
    const a=joint('Ear '+s,head,s*.19,.048,0);ears.push(a);a.rotation.z=-s*.12;
    const outer=ball('Broad ear',.23,.115,.044,fur,a,s*.17,.015,-.005);outer.rotation.z=s*.22;
    const inner=ball('Ear membrane',.185,.083,.017,ear,a,s*.17,.015,.036);inner.rotation.z=s*.22;
    rod('Inner ear ridge',[s*.025,-.015,.055],[s*.25,.045,.047],.011,light,a);
  }
  ball('Cream forehead blaze',.085,.165,.034,light,head,0,.086,.128);
  const eyes=[];for(const s of [-1,1]){
    ball('Cream eye surround',.094,.110,.04,light,head,s*.105,.03,.143);
    const eye=ball('Brown black eye',.057,.074,.031,black,head,s*.105,.031,.175);eyes.push(eye);
    ball('Eye catchlight',.015,.020,.006,white,eye,-.017,.025,.029);
    ball('Furry cheek',.080,.066,.047,light,head,s*.113,-.077,.143);
    for(let i=0;i<3;i++){const tuft=cone('Cheek fur tuft',.024,.080,fur,head,s*(.204+i*.005),-.08+i*.046,.035);tuft.rotation.z=-s*(.75+i*.15);}
  }
  ball('Muzzle',.082,.052,.038,light,head,0,-.063,.185);
  ball('Nose',.032,.021,.020,nosemat,head,0,-.04,.221);
  const mouth=ball('Mouth',.032,.012,.010,dark,head,0,-.103,.207);
  for(let i=0;i<5;i++){const t=cone('Crown fur',.032,.085,light,head,(i-2)*.035,.207-Math.abs(i-2)*.01,0);t.rotation.z=-(i-2)*.14;}
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=joint('Arm '+s,g,s*.17,.45,0);arms.push(a);ball('Furry arm',.067,.15,.062,fur,a,s*.02,-.11,0);ball('Cream hand',.064,.054,.046,light,a,s*.025,-.24,.025);for(let i=0;i<3;i++)ball('Finger',.015,.03,.019,light,a,s*.025+(i-1)*.028,-.278,.028);
    const l=joint('Foot '+s,g,s*.105,.077,.036);legs.push(l);ball('Foot fur',.085,.075,.110,fur,l);for(let i=0;i<3;i++)ball('Cream toe',.023,.027,.043,light,l,(i-1)*.038,-.041,.088);
  }
  g.userData.arms=arms;g.userData.legs=legs;g.userData.ears=ears;
  function pose(e,t,w){head.rotation.z=[0,.12,0,-.14,.18][e]+Math.sin(t*1.2)*.012;head.rotation.x=[0,-.04,-.12,.06,.17][e];eyes.forEach(q=>q.scale.y=[1,.65,1.12,.48,.10][e]);mouth.scale.set([1,1.45,.85,1,.8][e],[1,2.2,4,.45,.4][e],1);ears.forEach((a,i)=>a.rotation.z=(i?1:-1)*[-.12,.08,.23,-.32,-.43][e]);arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[0,.40,.7,-.12,0][e];a.rotation.x=w?Math.sin(t*5+i*Math.PI)*.15:0;});legs.forEach((l,i)=>l.position.y=.077+(w?Math.max(0,Math.sin(t*5+i*Math.PI))*.03:0));}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createSpike() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const skin=mat('Olive reptile skin',0x557044),belly=mat('Ochre scales',0xb69c59),deep=mat('Scale shadows',0x30452d),ear=mat('Ear membrane',0xa07d51),ivory=mat('Ivory mohawk and teeth',0xeee3b6),red=mat('Amber red iris',0xc77332,.32),black=mat('Pupils and mouth',0x161c16),nail=mat('Dark claws',0x514932);
  ball('Lean scaled body',.145,.23,.112,skin,g,0,.36,0);ball('Belly armour',.105,.195,.035,belly,g,0,.36,.104);
  for(let i=0;i<5;i++)soft('Belly plate',.16-i*.006,.037,.022,.008,belly,g,0,.23+i*.065,.132);
  const head=ball('Gremlin skull',.205,.177,.153,skin,g,0,.725,.01);g.userData.head=head;
  for(const s of [-1,1]){
    const e=ball('Long pointed ear',.23,.067,.039,skin,head,s*.315,.07,-.045);e.rotation.z=s*.32;
    const q=ball('Inner ear',.19,.038,.015,ear,head,s*.31,.08,-.009);q.rotation.z=s*.32;
    ball('Cheek ridge',.083,.054,.043,deep,head,s*.127,-.063,.105);
  }
  const eyes=[],brows=[];
  for(const s of [-1,1]){
    ball('Eye socket',.073,.059,.040,deep,head,s*.09,.03,.125);
    const eye=ball('Amber iris',.047,.042,.023,red,head,s*.09,.03,.155);eyes.push(eye);ball('Vertical pupil',.013,.033,.007,black,eye,0,0,.022);
    const brow=soft('Heavy brow',.12,.037,.041,.012,skin,head,s*.091,.075,.155);brow.rotation.z=s*.22;brows.push(brow);
  }
  ball('Reptilian snout',.09,.045,.073,skin,head,0,-.027,.155);
  for(const s of [-1,1])ball('Nostril',.011,.008,.006,black,head,s*.027,-.02,.223);
  const jaw=joint('Jaw',head,0,-.081,.05);ball('Lower jaw',.127,.045,.11,skin,jaw,0,-.006,.05);const mouth=ball('Wide grin',.118,.025,.026,black,jaw,0,.020,.146);
  for(let i=0;i<8;i++){const tooth=cone('Sharp tooth',.012,.037,ivory,jaw,-.084+i*.024,.013,.158-Math.abs(i-3.5)*.003);tooth.rotation.z=Math.PI;}
  for(let i=0;i<7;i++){const tuft=cone('White mohawk',.037,.14+Math.sin(i*Math.PI/6)*.055,ivory,head,0,.165-i*.014,.095-i*.041);tuft.rotation.x=-.20-i*.08;}
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=joint('Arm '+s,g,s*.145,.49,0);arms.push(a);ball('Shoulder',.06,.07,.06,skin,a);rod('Upper arm',[0,0,0],[s*.065,-.10,.025],.043,skin,a);ball('Elbow',.037,.039,.037,deep,a,s*.065,-.10,.025);rod('Forearm',[s*.065,-.10,.025],[s*.075,-.23,.075],.034,skin,a);ball('Hand',.048,.043,.034,skin,a,s*.075,-.25,.08);for(let i=0;i<3;i++){rod('Long finger',[s*.075+(i-1)*.026,-.26,.08],[s*.075+(i-1)*.038,-.31,.10],.010,skin,a);const cl=cone('Finger claw',.009,.029,nail,a,s*.075+(i-1)*.038,-.325,.106);cl.rotation.z=Math.PI;}
    const l=joint('Leg '+s,g,s*.083,.20,-.025);legs.push(l);ball('Thigh',.062,.10,.061,skin,l,0,-.045,0);rod('Shin',[0,-.075,0],[s*.026,-.154,.05],.031,skin,l);ball('Long foot',.055,.041,.094,skin,l,s*.024,-.158,.092);for(let i=0;i<3;i++){const toe=cone('Toe claw',.012,.06,nail,l,s*.024+(i-1)*.030,-.164,.181);toe.rotation.x=Math.PI/2;}
  }
  g.userData.arms=arms;g.userData.legs=legs;g.userData.jaw=jaw;
  function pose(e,t,w){head.rotation.z=[0,.13,0,-.17,.20][e]+Math.sin(t*1.3)*.012;head.rotation.x=[0,-.06,-.13,.09,.18][e];eyes.forEach(q=>q.scale.y=[1,.8,1.25,.45,.10][e]);brows.forEach((q,i)=>q.rotation.z=(i?1:-1)*[.22,-.12,0,.36,.08][e]);jaw.rotation.x=[0,.12,.38,-.02,.04][e];arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[.03,.40,.66,.24,0][e];a.rotation.x=w?Math.sin(t*6+i*Math.PI)*.15:0;});legs.forEach((l,i)=>{l.rotation.x=w?Math.sin(t*6+i*Math.PI)*.10:0;l.position.y=.20+(w?.018:0);});}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createPixarLamp() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const paint=mat('Ivory enamel',0xe4e1d3,.35,.25),steel=mat('Polished steel',0x8d989d,.30,.65),dark=mat('Joint washers',0x343d40,.50,.4),bulbmat=mat('Warm bulb',0xffedbb,.25,.03,.8);
  const base=cyl('Weighted circular base',.23,.055,paint,g,0,.029,0);cyl('Base top bevel',.21,.020,paint,g,0,.065,0);cyl('Base bearing',.065,.071,dark,g,0,.105,-.035);
  const lower=joint('Lower arm pivot',g,0,.13,-.035);
  for(const s of [-1,1]){rod('Lower parallel arm',[s*.039,0,0],[s*.039,.28,-.13],.016,paint,lower);rod('Lower tension bar',[s*.018,.015,.026],[s*.018,.275,-.098],.007,steel,lower);}
  const axle=cyl('Lower hinge axle',.045,.125,steel,lower);axle.rotation.z=Math.PI/2;
  const upper=joint('Upper arm pivot',lower,0,.28,-.13);
  for(const s of [-1,1]){rod('Upper parallel arm',[s*.039,0,0],[s*.039,.285,.185],.015,paint,upper);const washer=cyl('Elbow washer',.04,.015,dark,upper,s*.068,0,0);washer.rotation.z=Math.PI/2;}
  // Each coil is primitive torus geometry; spring hardware follows its hinge group.
  for(let i=0;i<9;i++){const spring=ring('Tension spring coil',.021,.005,steel,upper,.066,.054+i*.014,.025+i*.010);spring.rotation.x=Math.PI/2-.6;}
  rod('Spring upper hook',[.066,.18,.11],[.04,.24,.155],.006,steel,upper);
  const profile=[[.05,-.14],[.058,-.10],[.085,-.065],[.145,.015],[.21,.14],[.215,.16],[.202,.16],[.197,.14],[.132,.018],[.072,-.06],[.048,-.10]].map(p=>new THREE.Vector2(...p));
  const shadeGeo=new THREE.LatheGeometry(profile,28);shadeGeo.rotateX(Math.PI/2);
  const head=mesh('Hollow bell shade',shadeGeo,paint,upper,0,.29,.205);g.userData.head=head;
  ring('Rolled shade rim',.208,.010,paint,head,0,0,.157);
  cyl('Rear ventilation cap',.048,.035,dark,head,0,0,-.155).rotation.x=Math.PI/2;
  for(let i=0;i<6;i++){const a=i*Math.PI/3;box('Vent slot',.008,.033,.007,dark,head,Math.sin(a)*.057,Math.cos(a)*.057,-.083);}
  ball('Visible warm bulb',.068,.068,.085,bulbmat,head,0,0,.07);ring('Bulb socket',.045,.009,steel,head,0,0,-.027);
  const knob=cyl('Shade adjustment knob',.024,.028,steel,head,.073,0,-.10);knob.rotation.z=Math.PI/2;
  g.userData.lowerArm=lower;g.userData.upperArm=upper;
  function pose(e,t,w){lower.rotation.x=[0,.14,-.22,-.06,.35][e]+(w?Math.sin(t*5)*.06:0);upper.rotation.x=[0,-.23,-.18,.25,.35][e];head.rotation.x=[.20,-.08,-.35,.38,.65][e];head.rotation.z=[0,.15,0,-.19,.12][e];head.rotation.y=Math.sin(t*(e===1?2:1))*.05;}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createLegoVader() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const black=mat('Black ABS',0x141a22,.32,.13),shine=mat('Helmet black',0x202832,.25,.23),grey=mat('Graphite details',0x606e78,.42,.25),silver=mat('Silver controls',0xaebcc2,.32,.45),red=mat('Red controls',0xc73d39),blue=mat('Blue controls',0x579bba),blade=mat('Red lightsaber blade',0xff493d,.23,.05,.85),capeMat=mat('Black fabric cape',0x262834,.86);
  const torsoGeo=new THREE.CylinderGeometry(.17,.21,.27,4);torsoGeo.rotateY(Math.PI/4);torsoGeo.scale(1,1,.64);mesh('Trapezoid minifigure torso',torsoGeo,black,g,0,.48,0);
  box('Hip block',.285,.072,.16,black,g,0,.301,0);
  const legs=[];for(const s of [-1,1]){const l=joint('Minifigure leg '+s,g,s*.077,.282,0);legs.push(l);soft('Squared leg',.132,.205,.142,.018,black,l,0,-.095,0);soft('Forward foot',.134,.07,.195,.012,black,l,0,-.244,.028);const socket=cyl('Leg socket inset',.042,.008,grey,l,0,-.068,-.077);socket.rotation.x=Math.PI/2;}
  cyl('Neck stud',.067,.060,black,g,0,.65,0);
  const head=ball('Helmet dome',.185,.169,.16,shine,g,0,.805,0);g.userData.head=head;
  const skirtGeo=new THREE.CylinderGeometry(.15,.213,.16,20,1,true);mesh('Flared helmet skirt',skirtGeo,shine,head,0,-.10,-.018);
  soft('Mask brow',.28,.057,.08,.020,black,head,0,.005,.132);
  for(const s of [-1,1]){const eye=soft('Dark angular eye',.09,.050,.015,.012,black,head,s*.069,-.018,.177);eye.rotation.z=s*.13;rod('Cheek ridge',[s*.11,-.045,.15],[s*.074,-.116,.177],.015,grey,head);ball('Respirator disc',.024,.024,.014,grey,head,s*.069,-.127,.182);}
  const mask=cone('Triangular respirator',.057,.080,black,head,0,-.092,.19);mask.rotation.x=Math.PI/2;
  for(let i=0;i<5;i++)box('Respirator vent',.008,.042,.012,grey,head,(i-2)*.015,-.09,.214);
  rod('Helmet centre ridge',[0,.145,.056],[0,.015,.166],.010,grey,head);
  soft('Chest control panel',.114,.096,.028,.008,grey,g,0,.466,.13);
  for(const [x,y,m]of [[-.032,.49,red],[0,.49,blue],[.032,.49,silver],[-.032,.455,silver],[0,.455,silver],[.032,.455,silver]])box('Control button',.022,.018,.012,m,g,x,y,.15);
  for(const s of [-1,1])rod('Chest armour stripe',[s*.135,.575,.098],[s*.085,.515,.142],.013,silver,g);
  box('Belt',.28,.038,.18,grey,g,0,.325,0);box('Belt buckle',.062,.043,.014,silver,g,0,.325,.10);
  for(const s of [-1,1]){box('Belt pack',.051,.06,.028,black,g,s*.09,.335,.10);box('Belt light',.024,.012,.012,red,g,s*.09,.343,.12);}
  // Cape stays behind the torso; a broad tapered shell retains a toy-like cloth silhouette.
  const capeGeo=new THREE.CylinderGeometry(.155,.29,.55,20,1,true,Math.PI/2,Math.PI);capeGeo.scale(1,1,.55);mesh('Flowing cape',capeGeo,capeMat,g,0,.367,-.07);
  const arms=[];
  for(const s of [-1,1]){const a=joint('Arm '+s,g,s*.175,.565,0);arms.push(a);const u=soft('ABS upper arm',.09,.18,.09,.03,black,a,s*.026,-.073,0);u.rotation.z=s*.17;ball('Elbow',.045,.043,.044,black,a,s*.05,-.16,.015);cyl('Wrist',.025,.055,black,a,s*.05,-.207,.031);const hand=ring('C-shaped minifigure hand',.039,.014,black,a,s*.05,-.244,.033,Math.PI*1.55);hand.rotation.z=s*.35;if(s===1){const hilt=cyl('Saber hilt',.020,.15,silver,a,s*.05,-.218,.082);for(let i=0;i<4;i++)ring('Hilt grip ridge',.021,.004,black,a,s*.05,-.27+i*.025,.082).rotation.x=Math.PI/2;cyl('Energy blade',.011,.48,blade,a,s*.05,.095,.082);ball('Blade tip',.011,.011,.011,blade,a,s*.05,.335,.082);}}
  g.userData.arms=arms;g.userData.legs=legs;
  function pose(e,t,w){head.rotation.x=[0,-.06,-.16,.15,.27][e];head.rotation.z=[0,.10,0,-.13,.15][e];head.rotation.y=[0,.12,0,-.16,0][e]+Math.sin(t)*.018;arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[.07,.38,.64,.20,.01][e];a.rotation.x=w?Math.sin(t*5+i*Math.PI)*.12:0;});legs.forEach((l,i)=>{l.rotation.x=w?Math.sin(t*5+i*Math.PI)*.10:0;l.position.y=.282+(w?.022:0);});}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createYoda() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const green=mat('Sage green skin',0x8fa16c),deep=mat('Wrinkle shadows',0x667751),inner=mat('Warm ear interiors',0xb4a081),robe=mat('Sand linen robe',0xc8b997,.90),brown=mat('Brown tunic',0x675847,.88),hair=mat('Wispy silver hair',0xd8dac7),black=mat('Dark eyes',0x202b1c,.32),white=mat('Catchlights',0xf1efd9),wood=mat('Walking stick',0x746044,.82);
  mesh('Robe silhouette',new THREE.CylinderGeometry(.14,.23,.46,18),robe,g,0,.285,0);box('Inner tunic',.13,.34,.025,brown,g,0,.32,.188);
  for(const s of [-1,1]){const lapel=soft('Robe lapel',.065,.35,.045,.013,robe,g,s*.090,.365,.165);lapel.rotation.z=s*.13;for(let i=0;i<3;i++)rod('Robe fold',[s*(.09+i*.035),.12,.155],[s*(.06+i*.03),.30,.147],.008,brown,g);}
  const head=ball('Wise broad head',.225,.176,.159,green,g,0,.715,.021);g.userData.head=head;
  const ears=[];for(const s of [-1,1]){const a=joint('Ear '+s,head,s*.18,.02,-.017);ears.push(a);const ear=ball('Long pointed ear',.215,.052,.042,green,a,s*.15,.025,-.018);ear.rotation.z=s*.21;const lining=ball('Ear interior',.17,.029,.015,inner,a,s*.15,.025,.021);lining.rotation.z=s*.21;rod('Ear ridge',[s*.015,0,.036],[s*.28,.058,.018],.011,deep,a);}
  const eyes=[],brows=[];for(const s of [-1,1]){
    ball('Eye socket',.067,.044,.026,deep,head,s*.083,.020,.142);const eye=ball('Eye',.030,.024,.013,black,head,s*.083,.022,.164);eyes.push(eye);ball('Catchlight',.007,.008,.004,white,eye,-.008,.006,.012);
    const b=ball('Heavy brow',.076,.027,.034,green,head,s*.084,.059,.151);b.rotation.z=-s*.1;brows.push(b);
    ball('Cheek',.064,.044,.033,green,head,s*.118,-.058,.126);
    for(let i=0;i<3;i++)rod('Temple wrinkle',[s*.145,.035-i*.021,.126],[s*.178,.047-i*.021,.09],.005,deep,head);
  }
  ball('Nose',.043,.042,.049,green,head,0,-.013,.160);const mouth=ball('Mouth',.043,.009,.007,deep,head,0,-.086,.158);ball('Chin',.068,.037,.034,green,head,0,-.119,.119);
  for(let i=0;i<3;i++){const wrinkle=ring('Forehead wrinkle',.087+i*.015,.004,deep,head,0,.081+i*.012,.126,Math.PI*.76);wrinkle.rotation.z=.12*Math.PI;wrinkle.scale.y=.25;}
  for(const s of [-1,1])for(let i=0;i<4;i++)rod('Fine silver hair',[s*(.13+i*.012),.11-i*.02,-.064],[s*(.175+i*.012),.15-i*.025,-.045],.005,hair,head);
  const arms=[];for(const s of [-1,1]){const a=joint('Sleeved arm '+s,g,s*.153,.465,0);arms.push(a);const sleeve=ball('Loose sleeve',.091,.145,.087,robe,a,s*.034,-.09,.01);sleeve.rotation.z=s*.3;ball('Three-finger hand',.041,.033,.037,green,a,s*.071,-.19,.067);for(let i=0;i<3;i++)ball('Finger',.013,.034,.014,green,a,s*.071+(i-1)*.024,-.214,.08);}
  for(const s of [-1,1]){ball('Foot',.075,.039,.077,green,g,s*.114,.041,.092);for(let i=0;i<3;i++)ball('Toe',.017,.017,.038,green,g,s*.114+(i-1)*.033,.025,.145);}
  rod('Gnarled cane',[.26,.012,.18],[.25,.33,.19],.019,wood,g);rod('Cane handle',[.25,.33,.19],[.19,.36,.20],.022,wood,g);
  g.userData.arms=arms;g.userData.ears=ears;
  function pose(e,t,w){head.rotation.z=[0,.11,0,-.14,.18][e]+Math.sin(t*.9)*.008+(w?Math.sin(t*4)*.02:0);head.rotation.x=[0,-.06,-.13,.07,.20][e];eyes.forEach(q=>q.scale.y=[1,.65,1.35,.42,.10][e]);brows.forEach((q,i)=>q.rotation.z=(i?1:-1)*[-.1,-.18,0,.22,.06][e]);mouth.scale.y=[1,1.8,3.5,.5,.5][e];ears.forEach((q,i)=>q.rotation.z=(i?1:-1)*[0,.10,.17,-.08,-.23][e]);arms.forEach((a,i)=>a.rotation.z=(i?1:-1)*[.02,.25,.48,.14,0][e]);}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

function createPikachu() {

  const g=new THREE.Group();
  const names=['neutral','happy','surprised','annoyed','sleepy'];
  const mat=(name,color,roughness=.62,metalness=.04,glow=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,flatShading:true,emissive:glow?color:0,emissiveIntensity:glow});m.name=name;return m;};
  const mesh=(name,geo,m,p,x=0,y=0,z=0)=>{const q=new THREE.Mesh(geo,m);q.name=name;q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;p.add(q);return q;};
  const ball=(name,rx,ry,rz,m,p,x=0,y=0,z=0)=>{const geo=new THREE.SphereGeometry(1,20,12);geo.scale(rx,ry,rz);return mesh(name,geo,m,p,x,y,z);};
  const box=(name,w,h,d,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.BoxGeometry(w,h,d),m,p,x,y,z);
  const soft=(name,w,h,d,r,m,p,x=0,y=0,z=0)=>{const a=new THREE.BoxGeometry(w,h,d,5,5,5),v=a.attributes.position;for(let i=0;i<v.count;i++){const px=v.getX(i),py=v.getY(i),pz=v.getZ(i),cx=Math.max(-w/2+r,Math.min(w/2-r,px)),cy=Math.max(-h/2+r,Math.min(h/2-r,py)),cz=Math.max(-d/2+r,Math.min(d/2-r,pz));const n=new THREE.Vector3(px-cx,py-cy,pz-cz).normalize().multiplyScalar(r);v.setXYZ(i,cx+n.x,cy+n.y,cz+n.z);}a.computeVertexNormals();return mesh(name,a,m,p,x,y,z);};
  const cyl=(name,r,h,m,p,x=0,y=0,z=0,seg=20)=>mesh(name,new THREE.CylinderGeometry(r,r,h,seg),m,p,x,y,z);
  const joint=(name,p,x=0,y=0,z=0)=>{const q=new THREE.Group();q.name=name;q.position.set(x,y,z);p.add(q);return q;};
  const rod=(name,a,b,r,m,p)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const q=cyl(name,r,d.length(),m,p,...av.clone().add(bv).multiplyScalar(.5).toArray());q.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return q;};
  const ring=(name,r,t,m,p,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(name,new THREE.TorusGeometry(r,t,8,28,arc),m,p,x,y,z);
  const cone=(name,r,h,m,p,x=0,y=0,z=0)=>mesh(name,new THREE.ConeGeometry(r,h,12),m,p,x,y,z);
  let expression='neutral',lastT=0,lastWalking=false;

  const yellow=mat('Golden yellow fur',0xf1c842),black=mat('Black ear tips and eyes',0x272723,.38),red=mat('Red cheeks',0xcc5542),brown=mat('Brown back stripes',0x8b6242),white=mat('Eye glints',0xfff5d4),pink=mat('Mouth interior',0xa2574d);
  ball('Plump body',.205,.255,.15,yellow,g,0,.32,0);
  const head=ball('Broad rounded head',.248,.207,.168,yellow,g,0,.65,.025);g.userData.head=head;
  const ears=[];for(const s of [-1,1]){
    const a=joint('Long ear '+s,head,s*.133,.156,-.005);ears.push(a);
    const geo=new THREE.SphereGeometry(1,16,10);geo.scale(.045,.19,.030);geo.translate(0,.15,0);mesh('Yellow ear',geo,yellow,a);
    const tipGeo=new THREE.SphereGeometry(1,16,10);tipGeo.scale(.041,.075,.031);tipGeo.translate(0,.275,0);mesh('Black ear tip',tipGeo,black,a);
  }
  const eyes=[];for(const s of [-1,1]){const e=ball('Dark eye',.038,.046,.014,black,head,s*.104,.023,.157);eyes.push(e);ball('Eye glint',.011,.014,.004,white,e,-.010,.015,.014);ball('Red cheek',.049,.047,.018,red,head,s*.191,-.053,.104);}
  ball('Nose',.014,.010,.012,black,head,0,-.025,.190);
  const mouth=joint('Mouth',head,0,-.067,.179);
  for(const s of [-1,1]){const smile=ring('Smile curl',.024,.005,black,mouth,s*.020,0,0,Math.PI);smile.rotation.z=Math.PI;smile.scale.y=.6;}
  const openMouth=ball('Open happy mouth',.032,.024,.007,pink,mouth,0,-.013,-.001);
  const arms=[],legs=[];for(const s of [-1,1]){const a=joint('Arm '+s,g,s*.168,.41,.06);arms.push(a);const geo=new THREE.SphereGeometry(1,16,10);geo.scale(.055,.111,.05);geo.translate(s*.021,-.064,0);mesh('Short arm',geo,yellow,a);for(let i=0;i<3;i++)ball('Paw digit',.010,.016,.012,yellow,a,s*.021+(i-1)*.015,-.159,.007);const foot=ball('Long foot',.075,.047,.111,yellow,g,s*.116,.047,.075);legs.push(foot);}
  for(const y of [.26,.36]){const stripe=soft('Back stripe',.245,.055,.022,.008,brown,g,0,y,-.144);stripe.rotation.z=y<.3?-.1:.1;}
  // One merged primitive-derived mesh keeps the zigzag tail on a single wag pivot.
  const pieces=[];for(const [w,h,x,y]of [[.11,.18,0,.06],[.20,.075,.075,.155],[.10,.19,.13,.235],[.25,.095,.205,.335]]){const a=new THREE.BoxGeometry(w,h,.035);a.translate(x,y,-.10);pieces.push(a.toNonIndexed());}
  const tailGeo=pieces[0].clone();for(const key of ['position','normal','uv']){const arrays=pieces.map(p=>p.attributes[key].array),size=arrays.reduce((s,a)=>s+a.length,0),buf=new Float32Array(size);let k=0;arrays.forEach(a=>{buf.set(a,k);k+=a.length;});tailGeo.setAttribute(key,new THREE.BufferAttribute(buf,pieces[0].attributes[key].itemSize));}tailGeo.clearGroups();
  const tail=mesh('Lightning-bolt tail',tailGeo,yellow,g,.13,.25,-.10);tail.rotation.y=-.18;g.userData.tail=tail;soft('Brown tail root',.075,.10,.055,.006,brown,g,.13,.275,-.17);
  g.userData.arms=arms;g.userData.ears=ears;g.userData.legs=legs;
  function pose(e,t,w){head.rotation.z=[0,.11,0,-.14,.18][e];head.rotation.x=[0,-.05,-.10,.08,.17][e];eyes.forEach(q=>q.scale.y=[1,.4,1.25,.42,.10][e]);openMouth.scale.y=[.03,1,1.5,.03,.03][e];mouth.scale.x=[1,1.15,.75,.85,1][e];ears.forEach((a,i)=>a.rotation.z=(i?1:-1)*[-.28,-.18,-.08,-.44,-.70][e]);arms.forEach((a,i)=>{a.rotation.z=(i?1:-1)*[0,.50,.70,.10,0][e];a.rotation.x=w?Math.sin(t*6+i*Math.PI)*.16:0;});tail.rotation.y=-.18+Math.sin(t*(e===1?3:1.4))*(e===4?.04:.16);legs.forEach((l,i)=>l.position.y=.047+(w?Math.max(0,Math.sin(t*6+i*Math.PI))*.028:0));}

  g.userData.expressionNames=names.slice();g.userData.expression='neutral';
  g.userData.animate=(t,walking=false)=>{lastT=t;lastWalking=walking;pose(names.indexOf(expression),t,walking);};
  g.userData.setExpression=name=>{if(!names.includes(name))throw new Error('Unknown expression: '+name);expression=name;g.userData.expression=name;g.userData.animate(lastT,lastWalking);return g;};
  g.userData.expressions=Object.fromEntries(names.map(n=>[n,()=>g.userData.setExpression(n)]));
  g.userData.setExpression('neutral');g.scale.setScalar(.85);return g;
}

export { createR2D2, createBB8, createRocky, createNekoBus, createPitDroid, createWallE, createEve, createBaymax, createGizmo, createSpike, createPixarLamp, createLegoVader, createYoda, createPikachu }

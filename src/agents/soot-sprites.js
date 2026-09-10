/**
 * Soot sprites (susuwatari) — the little fuzzy black balls with big white eyes. From ChatGPT's
 * Soot_Sprites batch, made into an ES module fed the colony's THREE. Driven by a swarm manager
 * in mascots.js, not by this.list: they blanket the colony when nap time drops the lights, then
 * freeze and scatter like roaches when the wake-up automation brings the lights back.
 */
import * as THREE from 'three'
globalThis.THREE = globalThis.THREE || THREE

/* Global THREE; procedural geometry; no textures. Forward +Z, ground y=0. */
function createSootSprite(options={}){
 const T=globalThis.THREE;if(!T)throw new Error('THREE must be global');
 const g=new T.Group(),motion=new T.Group();g.add(motion);g.name='Soot Sprite';
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:1,metalness:0});
 const soot=mat(0x121318),white=mat(0xfff9e9),ink=mat(0x08090c);
 const add=(p,geo,m,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
 const oval=(x,y,z)=>{const a=new T.SphereGeometry(1,20,14);a.scale(x,y,z);return a;};
 const core=add(motion,oval(.18,.175,.16),soot,0,.235,0);
 // Merge deterministic tapered fibers into one geometry to avoid hundreds of draw calls.
 const positions=[],normals=[];const up=new T.Vector3(0,1,0);
 let seed=(options.seed??1)>>>0;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<320;i++){
  const y=1-2*(i+.5)/320,a=i*2.3999632297,r=Math.sqrt(1-y*y),d=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
  if(d.z>.65&&d.y>-.3&&d.y<.65)continue;
  const len=.035+rand()*.035,geo=new T.ConeGeometry(.0035+rand()*.002,len,4).toNonIndexed();
  geo.translate(0,len/2,0);geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,d));geo.translate(d.x*.166,d.y*.164+.235,d.z*.148);
  positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);geo.dispose();
 }
 const fur=new T.BufferGeometry();fur.setAttribute('position',new T.Float32BufferAttribute(positions,3));fur.setAttribute('normal',new T.Float32BufferAttribute(normals,3));add(motion,fur,soot);
 const head=motion;
 for(const side of [-1,1]){add(head,oval(.057,.068,.019),white,side*.060,.273,.149);add(head,oval(.015,.020,.009),ink,side*.060,.274,.168);}
 const expressions={neutral:[],happy:[],surprised:[],annoyed:[],sleepy:[]};
 const bar=(x,y,z,w,angle=0)=>{const o=add(head,new T.BoxGeometry(w,.012,.014),soot,x,y,z);o.rotation.z=angle;return o;};
 for(const side of [-1,1]){
  expressions.neutral.push(bar(side*.061,.349,.15,.034));
  // Lower lids form happy crescents without changing the fixed eye whites or pupils.
  expressions.happy.push(add(head,oval(.06,.033,.020),soot,side*.060,.222,.172));
  expressions.happy.push(bar(side*.06,.35,.153,.039,-side*.18));
  expressions.surprised.push(bar(side*.064,.376,.14,.044,-side*.24));
  const angry=add(head,new T.BoxGeometry(.12,.040,.025),soot,side*.06,.322,.172);angry.rotation.z=side*.30;expressions.annoyed.push(angry);
  expressions.sleepy.push(add(head,oval(.061,.053,.022),soot,side*.060,.295,.175));
 }
 function setExpression(name){if(!expressions[name])throw new Error('Unknown expression: '+name);for(const [key,parts]of Object.entries(expressions))parts.forEach(m=>m.visible=key===name);g.userData.expression=name;}
 let time=options.phase??0,air=0,disposed=false;
 function update(dt,state={}){if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;time+=dt;if(state.expression)setExpression(state.expression);const moving=(state.speed??0)>0;const target=moving?Math.abs(Math.sin(time*9))*.105:0;air+=(target-air)*(dt?1-Math.exp(-dt*22):1);motion.position.y=air;motion.rotation.z=Math.sin(time*4)* (moving?.045:.008);}
 g.userData={displayName:'Soot Sprite',intro:'We were absolutely not in the printer.',head,arms:[],legs:[],expressions,setExpression,update,dispose(){disposed=true;g.removeFromParent();const gs=new Set(),ms=new Set();g.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material)});gs.forEach(x=>x.dispose());ms.forEach(x=>x.dispose());}};
 g.scale.setScalar(options.scale??.85);setExpression('neutral');return g;
}


// Add to your scene at the center of the roaming area. Night state comes from your app.
function createNightSootSprites(options={}){
 const T=globalThis.THREE,g=new T.Group();g.name='Night soot sprites';
 const count=options.count??6,radius=options.radius??1.5;
 if(!Number.isInteger(count)||count<1||count>24||!Number.isFinite(radius)||radius<=0)throw new Error('Use count 1–24 and positive radius');
 let seed=(options.seed??73)>>>0;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const point=()=>{const a=rand()*Math.PI*2,r=Math.sqrt(rand())*radius;return new T.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);};
 const sprites=[],states=[];let night=options.isNight??false;
 for(let i=0;i<count;i++){const sprite=createSootSprite({seed:i+11,phase:i*.61,scale:.7+rand()*.2});sprite.position.copy(point());g.add(sprite);sprites.push(sprite);states.push({target:point(),pause:rand(),speed:.16+rand()*.16});}
 g.visible=night;
 function update(dt,state={}){
  dt=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
  if(typeof state.isNight==='boolean')night=state.isNight;
  g.visible=night;if(!night)return;
  sprites.forEach((s,i)=>{const a=states[i];if(a.pause>0){a.pause-=dt;s.userData.update(dt,{speed:0});return;}
   const d=a.target.clone().sub(s.position),distance=d.length();
   if(distance<.025){a.target.copy(point());a.pause=.2+rand()*1.2;s.userData.update(dt,{speed:0});return;}
   s.position.addScaledVector(d,Math.min(distance,a.speed*dt)/distance);s.rotation.y=Math.atan2(d.x,d.z);s.userData.update(dt,{speed:1});
  });
 }
 g.userData={sprites,update,setNight(value){night=!!value;g.visible=night;},setExpression(name){sprites.forEach(s=>s.userData.setExpression(name));},dispose(){sprites.forEach(s=>s.userData.dispose());g.removeFromParent();}};return g;
}


export { createSootSprite, createNightSootSprites }

/**
 * Bot Farm robot crew hardware — rig units, +Y up, +Z front, +X left.
 * Engine provides THREE, BufferGeometryUtils and roundedBox.
 * Only PARTS and MANIFEST are exported. No scene objects or palette colours.
 * All translations are baked into the returned BONE-LOCAL geometry; manifest
 * transforms are deliberately identity, so the engine must not add them twice.
 * Assumed joint spans: upper arm .34, forearm .32, thigh .40, shin .38.
 * Those spans need checking against the live rig, whose rest matrices were not
 * supplied. Head reference centre remains .46 above its bone.
 * trim must provide the dark sensor/actuator finish; gloss is engine-controlled.
 */
const PI = Math.PI;

// Contoured shell loft: bevelled rectangular sections, eight vertices per ring.
function shell(w,h,d,x,y,z) {
  const contour=[[-.72,-1],[.72,-1],[1,-.72],[1,.72],[.72,1],[-.72,1],[-1,.72],[-1,-.72]];
  const rings=[[-.5,.72],[-.43,.94],[.20,1],[.43,.91],[.5,.70]];
  const pos=[],idx=[];
  rings.forEach(([v,k])=>contour.forEach(([a,b])=>pos.push(x+a*w*.5*k,y+v*h,z+b*d*.5*k)));
  for(let r=0;r<4;r++)for(let j=0;j<8;j++){const a=r*8+j,b=r*8+(j+1)%8,c=b+8,e=a+8;idx.push(a,c,b,a,e,c);}
  for(let j=1;j<7;j++){idx.push(0,j,j+1);idx.push(32,32+j+1,32+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function bolts(p,x,y,z,radius,count=6,axis='z') {
  for(let i=0;i<count;i++){const a=i*2*PI/count;
    p.push(cylinder(.009,.009,.010,x+(axis==='x'?0:Math.cos(a)*radius),y+Math.sin(a)*radius,z+(axis==='x'?Math.cos(a)*radius:0),axis,5));
  }
}
function cable(x,y,z,length){return cylinder(.009,.009,length,x,y,z,'y',5);}

function box(w,h,d,x=0,y=0,z=0,r=.015) {
  const g=roundedBox(w,h,d,Math.min(r,w/2,h/2,d/2));
  g.translate(x,y,z);return g;
}
function slab(w,h,d,x=0,y=0,z=0) {
  const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;
}
function cylinder(rt,rb,h,x=0,y=0,z=0,axis='y',segments=8) {
  const g=new THREE.CylinderGeometry(rt,rb,h,segments,1,false);
  if(axis==='x')g.rotateZ(PI/2);
  if(axis==='z')g.rotateX(PI/2);
  g.translate(x,y,z);return g;
}
function loop(radius,tube,x,y,z,arc=2*PI,turn=0) {
  const g=new THREE.TorusGeometry(radius,tube,4,10,arc);
  g.rotateZ(turn);g.translate(x,y,z);return g;
}
// All inputs are normalised to matching non-indexed position/normal/uv data.
// Each temporary allocation is released, including on a merge failure.
function merge(parts,mirror=false) {
  const normalized=[];let result;
  try {
    for(const source of parts) {
      const g=source.index?source.toNonIndexed():source.clone();
      for(const name of Object.keys(g.attributes))
        if(name!=='position'&&name!=='normal'&&name!=='uv')g.deleteAttribute(name);
      if(!g.attributes.normal)g.computeVertexNormals();
      if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      normalized.push(g);
    }
    result=BufferGeometryUtils.mergeGeometries(normalized,false);
    if(!result)throw new Error('Robot part geometry merge failed');
    if(mirror) {
      result.scale(-1,1,1);
      // A reflection reverses winding. Restore front faces, including UV order.
      for(const attr of Object.values(result.attributes)) {
        for(let i=0;i<attr.count;i+=3)for(let j=0;j<attr.itemSize;j++) {
          const a=(i+1)*attr.itemSize+j,b=(i+2)*attr.itemSize+j,t=attr.array[a];
          attr.array[a]=attr.array[b];attr.array[b]=t;
        }
        attr.needsUpdate=true;
      }
    }
    result.computeBoundingBox();result.computeBoundingSphere();
    return result;
  } finally {
    parts.forEach(g=>g.dispose());normalized.forEach(g=>g.dispose());
  }
}

// Circular sensor housing with radial cooling ribs and rear service hatch.
function headShell(){
 const p=[cylinder(.255,.273,.13,0,.46,-.047,'z',16),loop(.259,.025,0,.46,.027),cylinder(.159,.182,.035,0,.46,-.13,'z',12)];
 for(let i=0;i<8;i++){const a=i*PI/4;const rib=slab(.035,.061,.08,0,0,0);rib.rotateZ(-a);rib.translate(Math.sin(a)*.255,.46+Math.cos(a)*.255,-.064);p.push(rib);}
 bolts(p,0,.46,-.151,.13,6);p.push(box(.15,.095,.013,0,.47,-.155,.008));for(const x of [-.053,.053])for(const y of [.442,.498])p.push(cylinder(.008,.008,.007,x,y,-.165,'z',5));
 return merge(p);
}

function headVisor(){
 const p=[cylinder(.235,.235,.02,0,.46,.049,'z',20),box(.193,.058,.025,0,.386,.071,.008)];
 for(const x of [-.068,.068])p.push(cylinder(.017,.017,.015,x,.386,.09,'z',10),loop(.021,.004,x,.386,.096));
 p.push(cylinder(.026,.026,.016,0,.53,.068,'z',12),loop(.030,.006,0,.53,.079));for(const x of [-.021,.021])p.push(cylinder(.008,.008,.009,x,.385,.09,'z',6));
 return merge(p);
}

function headLamp(){const g=new THREE.TorusGeometry(.248,.009,4,20);g.translate(0,.46,.06);return merge([g]);}

function earPods(){const p=[];for(const side of [-1,1]){
 p.push(cylinder(.070,.07,.042,side*.254,.40,-.048,'x',12),cylinder(.045,.045,.015,side*.283,.40,-.048,'x',10));
 bolts(p,side*.295,.40,-.048,.053,6,'x');}return merge(p);}

function neckStack(){const p=[cylinder(.068,.078,.34,0,.035,0),cylinder(.105,.105,.065,0,.16,0)];
 for(let i=0;i<5;i++)p.push(cylinder(.078,.078,.012,0,-.11+i*.041,0));
 for(const x of [-.041,0,.041])p.push(cable(x,.018,-.084,.20));
 p.push(loop(.065,.012,0,.125,-.076,PI));for(const y of [-.055,.066])p.push(slab(.105,.017,.022,0,y,-.096));
 return merge(p);}

function chestPlate(){const p=[shell(.52,.52,.30,0,.015,0),shell(.66,.11,.235,0,.233,-.026),shell(.12,.36,.027,-.196,-.017,.147),shell(.12,.36,.027,.196,-.017,.147)];
 for(const x of [-.20,.20])for(const y of [-.145,.15])p.push(cylinder(.011,.011,.009,x,y,.163,'z',6));
 p.push(shell(.20,.13,.14,0,-.294,-.035));
 for(let i=0;i<7;i++)p.push(slab(.013,.069,.025,-.066+i*.022,-.29,.05));p.push(box(.19,.093,.017,0,-.075,.155,.01));for(const x of [-.076,.076])for(const y of [-.10,-.048])p.push(cylinder(.008,.008,.01,x,y,.169,'z',5));for(const side of [-1,1])for(let i=0;i<3;i++)p.push(slab(.02,.012,.082,side*.244,.09-i*.031,-.01));
 return merge(p);}

function chestCore(){return merge([box(.075,.014,.014,0,.115,.158,.004)]);}

function backPack(){const p=[shell(.43,.43,.20,0,.035,-.244),box(.25,.29,.025,0,.035,-.35,.013)];
 for(let i=0;i<9;i++)p.push(slab(.29,.011,.021,0,-.113+i*.035,-.367));
 for(const side of [-1,1]){p.push(cylinder(.027,.027,.056,side*.14,-.202,-.252));for(let i=0;i<3;i++)p.push(cable(side*(.17+i*.015),.015,-.285,.24));}
 for(const x of [-.143,.143])for(const y of [-.12,.175])p.push(cylinder(.011,.011,.012,x,y,-.368,'z',6));for(const x of [-.08,.08])p.push(box(.04,.022,.025,x,.22,-.24,.005));
 return merge(p);}

function shoulderPod(left){const p=[cylinder(.144,.144,.155,.025,0,0,'x',12),cylinder(.123,.123,.025,.115,0,0,'x',12),cylinder(.103,.103,.01,.134,0,0,'x',12)];
 bolts(p,.143,0,0,.113,8,'x');p.push(cylinder(.067,.067,.014,.148,0,0,'x',12));for(let i=0;i<6;i++){const a=i*PI/3;const q=slab(.092,.016,.025,0,0,0);q.rotateX(a);q.translate(.027,Math.sin(a)*.142,Math.cos(a)*.142);p.push(q);}
 return merge(p,!left);}

function upperArmPlate(left){const p=[shell(.163,.251,.162,.017,-.165,.018),shell(.082,.125,.182,.077,-.08,.005),cylinder(.060,.060,.167,0,-.334,0,'x',10)];
 for(const x of [-.034,0,.034])p.push(cable(x,-.178,-.089,.207));
 p.push(cylinder(.025,.025,.135,.084,-.14,-.038),cylinder(.011,.011,.115,.084,-.252,-.038));
 for(const y of [-.08,-.235])p.push(cylinder(.009,.009,.009,.055,y,.104,'z',6));for(const y of [-.10,-.25])p.push(slab(.103,.015,.016,0,y,-.100));p.push(cylinder(.042,.042,.014,.093,-.334,0,'x',10));
 return merge(p,!left);}

function foreArmPlate(left){const p=[shell(.17,.22,.175,.015,-.13,.008),cylinder(.063,.063,.038,0,-.273,0),cylinder(.055,.055,.02,0,-.307,0)];
 for(let i=0;i<5;i++)p.push(slab(.083,.008,.015,.016,-.065-i*.022,.10));
 for(const x of [-.045,-.015,.015,.045])p.push(cable(x,-.18,-.084,.20));
 bolts(p,.012,-.15,.102,.049,4);for(const y of [-.08,-.225])p.push(slab(.122,.014,.016,0,y,-.096));p.push(cylinder(.065,.065,.010,0,-.289,0));
 return merge(p,!left);}

function handUnit(left){const p=[shell(.14,.105,.071,0,-.055,0),cylinder(.049,.049,.036,0,.014,0)];
 for(const x of [-.041,.041]){p.push(cylinder(.019,.019,.036,x,-.114,.006,'x',8),box(.028,.062,.033,x,-.144,.013,.007),cylinder(.018,.018,.034,x,-.176,.02,'x',8),box(.028,.023,.057,x,-.19,.041,.006));}
 p.push(box(.032,.068,.033,-.079,-.082,.025,.008),cylinder(.018,.018,.032,-.076,-.12,.032,'x',8),box(.035,.025,.046,-.064,-.132,.052,.006));
 for(const x of [-.04,0,.04])p.push(cable(x,-.048,-.045,.084));bolts(p,0,-.05,.041,.042,4);for(const x of [-.041,.041])for(const y of [-.151,-.165])p.push(slab(.029,.008,.007,x,y,.033));p.push(slab(.117,.012,.013,0,-.043,-.055));
 return merge(p,!left);}

function hipBlock(){const p=[shell(.41,.195,.275,0,-.055,0)];for(const side of [-1,1])p.push(cylinder(.087,.087,.042,side*.224,-.08,0,'x',12),cylinder(.069,.069,.015,side*.25,-.08,0,'x',12));
 for(let i=0;i<9;i++){p.push(slab(.012,.056,.018,-.088+i*.022,-.034,.142));p.push(slab(.012,.052,.015,-.088+i*.022,-.034,-.143));}for(const x of [-.159,.159])for(const y of [-.013,-.092])p.push(cylinder(.009,.009,.014,x,y,.117,'z',6));
 return merge(p);}

function thighPlate(left){const p=[shell(.186,.28,.195,.018,-.175,.005),shell(.077,.128,.213,.08,-.074,.002),cylinder(.091,.091,.208,.014,-.392,0,'x',12),cylinder(.063,.063,.02,.129,-.392,0,'x',12)];
 for(const x of [-.037,0,.037])p.push(cable(x,-.18,-.096,.225));
 p.push(cylinder(.027,.027,.18,.106,-.189,-.037),cylinder(.013,.013,.10,.106,-.312,-.037));bolts(p,.143,-.392,0,.077,6,'x');for(const y of [-.10,-.27])p.push(slab(.107,.016,.016,0,y,-.109));p.push(cylinder(.040,.040,.012,.148,-.392,0,'x',10));
 return merge(p,!left);}

function shinPlate(left){const p=[shell(.122,.28,.116,.012,-.156,-.029),shell(.103,.175,.042,.012,-.14,.071),cylinder(.072,.072,.178,.017,-.359,0,'x',12),cylinder(.049,.049,.02,.119,-.359,0,'x',12)];
 for(const x of [-.031,0,.031])p.push(cable(x,-.167,-.096,.255));
 for(let i=0;i<5;i++)p.push(slab(.088,.012,.013,.012,-.08-i*.027,.097));
 bolts(p,.133,-.359,0,.058,6,'x');for(const y of [-.07,-.26])p.push(slab(.093,.015,.016,0,y,-.108));p.push(cylinder(.030,.030,.012,.137,-.359,0,'x',10));
 return merge(p,!left);}

function footPad(left){const p=[box(.19,.048,.145,.012,-.087,-.045,.01),box(.20,.048,.127,.012,-.087,.226,.01),box(.185,.072,.175,.012,-.062,.10,.015),cylinder(.053,.053,.115,0,-.009,0,'x',10)];
 for(let i=0;i<5;i++)p.push(slab(.199,.009,.025,.012,-.11,-.085+i*.075));
 for(const x of [-.061,.078])p.push(cylinder(.010,.010,.008,x,-.022,.145,'y',6));for(const side of [-1,1])for(let i=0;i<4;i++)p.push(slab(.015,.017,.032,.012+side*.092,-.094,-.043+i*.073));p.push(slab(.105,.011,.028,.012,-.028,.13));
 return merge(p,!left);}

function shoulderPodL(){return shoulderPod(true);}
function shoulderPodR(){return shoulderPod(false);}
function upperArmPlateL(){return upperArmPlate(true);}
function upperArmPlateR(){return upperArmPlate(false);}
function foreArmPlateL(){return foreArmPlate(true);}
function foreArmPlateR(){return foreArmPlate(false);}
function handUnitL(){return handUnit(true);}
function handUnitR(){return handUnit(false);}
function thighPlateL(){return thighPlate(true);}
function thighPlateR(){return thighPlate(false);}
function shinPlateL(){return shinPlate(true);}
function shinPlateR(){return shinPlate(false);}
function footPadL(){return footPad(true);}
function footPadR(){return footPad(false);}

export const PARTS={
  headShell,headVisor,headLamp,earPods,neckStack,chestPlate,chestCore,backPack,
  'shoulderPod.l':shoulderPodL,'shoulderPod.r':shoulderPodR,
  'upperArmPlate.l':upperArmPlateL,'upperArmPlate.r':upperArmPlateR,
  'foreArmPlate.l':foreArmPlateL,'foreArmPlate.r':foreArmPlateR,
  'handUnit.l':handUnitL,'handUnit.r':handUnitR,
  hipBlock,
  'thighPlate.l':thighPlateL,'thighPlate.r':thighPlateR,
  'shinPlate.l':shinPlateL,'shinPlate.r':shinPlateR,
  'footPad.l':footPadL,'footPad.r':footPadR
};
export const MANIFEST={
  headShell:{bone:'head',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Circular sensor housing with rear service hatch.
  headVisor:{bone:'head',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Dark sensor face with stereo cameras and upper range sensor.
  headLamp:{bone:'head',role:'glow',offset:[0,0,0],rot:[0,0,0]}, // Thin illuminated perimeter halo.
  earPods:{bone:'head',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Mirrored temple actuator hubs and jaw links.
  neckStack:{bone:'head',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Neck rings and rear cable below head pivot.
  chestPlate:{bone:'chest',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Sternum armour and shoulder yoke.
  chestCore:{bone:'chest',role:'glow',offset:[0,0,0],rot:[0,0,0]}, // Small chest status strip.
  backPack:{bone:'chest',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Rear compute battery with cooling fins.
  'shoulderPod.l':{bone:'upperarm.l',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Left shoulder joint housing.
  'shoulderPod.r':{bone:'upperarm.r',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored shoulder joint housing.
  'upperArmPlate.l':{bone:'upperarm.l',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Left bicep plate and exposed piston.
  'upperArmPlate.r':{bone:'upperarm.r',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored bicep plate and piston.
  'foreArmPlate.l':{bone:'lowerarm.l',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Left tapered forearm and wrist collar.
  'foreArmPlate.r':{bone:'lowerarm.r',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored tapered forearm.
  'handUnit.l':{bone:'hand.l',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Left closed three-finger gripper extending -Y.
  'handUnit.r':{bone:'hand.r',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored three-finger gripper extending -Y.
  hipBlock:{bone:'hips',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Split pelvis housing and hip axles.
  'thighPlate.l':{bone:'upperleg.l',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Left thigh armour, piston and knee hub.
  'thighPlate.r':{bone:'upperleg.r',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored thigh and knee hub.
  'shinPlate.l':{bone:'lowerleg.l',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Left shin armour with exposed ankle hardware.
  'shinPlate.r':{bone:'lowerleg.r',role:'suit',offset:[0,0,0],rot:[0,0,0]}, // Right mirrored shin and ankle.
  'footPad.l':{bone:'foot.l',role:'trim',offset:[0,0,0],rot:[0,0,0]}, // Left segmented foot with toe gap and heel pad.
  'footPad.r':{bone:'foot.r',role:'trim',offset:[0,0,0],rot:[0,0,0]} // Right mirrored segmented foot.
};

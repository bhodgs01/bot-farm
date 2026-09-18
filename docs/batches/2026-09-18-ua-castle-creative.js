// Extracted from Unlimited_Campus_49_Pieces / campus_batch_a.js (Six Castles of Human
// Flourishing). Creative is Unlimited Awesome's castle for the making disciplines.
const PIECES = {
  castlecreative(c, rand) {
    const B=(w,h,d,k,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),k,o);
    const C=(r,h,k,o={},n=12)=>c.geom(new THREE.CylinderGeometry(r,r,h,n),k,o);
    const P=(pts,d,k,o={})=>{const s=new THREE.Shape();pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:12});g.translate(0,0,-d/2);c.geom(g,k,o);};
    const A=(w,h,t,d,k,o={})=>{const r=w/2,cy=h-r-t,s=new THREE.Shape();s.moveTo(-r-t,0);s.lineTo(-r-t,cy);s.absarc(0,cy,r+t,Math.PI,0,true);s.lineTo(r+t,0);s.lineTo(r,0);s.lineTo(r,cy);s.absarc(0,cy,r,0,Math.PI,false);s.lineTo(-r,0);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:12});g.translate(0,0,-d/2);c.geom(g,k,o);};
    const pack=(geos,k,o={})=>{const p=[],n=[];for(const a of geos){const g=a.index?a.toNonIndexed():a;p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));c.geom(g,k,o);};
    const roof=(w,d,h,o={})=>P([[-w/2,0],[w/2,0],[0,h]],d,CELL.RED,o);
    const dome=(r,h,k,o={})=>{const a=new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI/2);a.scale(1,h/r,1);c.geom(a,k,o);};
    const pane=(w,h,o={},lit=false)=>{B(w+.10,h+.10,.055,CELL.SLATE,o);B(w,h,.025,lit?CELL.TRIM:CELL.SOLAR_A,{...o,z:(o.z||0)+Math.cos(o.ry||0)*.035,x:(o.x||0)+Math.sin(o.ry||0)*.035,emissive:lit?.55:0});};
    const archpane=(w,h,o={})=>{const r=w/2,s=new THREE.Shape();s.moveTo(-r,0);s.lineTo(-r,h-r);s.absarc(0,h-r,r,Math.PI,0,true);s.lineTo(r,0);s.closePath();const a=new THREE.ExtrudeGeometry(s,{depth:.025,bevelEnabled:false,curveSegments:12});c.geom(a,CELL.SOLAR_A,o);A(w,h+.065,.065,.085,CELL.SLATE,o);};
    const hedge=(length,o={})=>{const s=new THREE.Shape();s.moveTo(-.25,0);s.lineTo(.25,0);s.lineTo(.25,.60);s.quadraticCurveTo(.25,.70,.15,.70);s.lineTo(-.15,.70);s.quadraticCurveTo(-.25,.70,-.25,.60);s.closePath();const a=new THREE.ExtrudeGeometry(s,{depth:length,bevelEnabled:false,curveSegments:6});a.translate(0,0,-length/2);a.rotateY(Math.PI/2);c.geom(a,CELL.ROCK,o);};
    const flag=(x,y,z,k=CELL.TRIM)=>{C(.022,.85,CELL.GREY,{x,y:y+.425,z});P([[0,0],[.47,-.02],[.42,-.35],[0,-.32]],.024,k,{x,y:y+.77,z});};
    // Fixed offset centres the full footprint, including moving parts.
    c.group('footprint',{x:-0.03,z:-0.20500004});

    C(1.50,2.55,CELL.WHITE,{y:1.275,z:-.75,label:'Round keep'},24);for(const y of [.15,1.45,2.53])C(1.55,.12,CELL.SLATE,{y,z:-.75},24);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;archpane(.29,.70,{x:1.505*Math.sin(a),y:1.63,z:-.75+1.505*Math.cos(a),ry:a});}
    c.group('dome',{y:2.61,z:-.75});dome(1.48,1.10,CELL.SOLAR_A,{label:'Observatory dome'});for(let i=0;i<4;i++){const g=new THREE.TorusGeometry(1.5,.025,6,48,Math.PI);g.rotateY(i*Math.PI/4);c.geom(g,CELL.GREY);}B(.085,.22,1.13,CELL.GREY,{y:1.06,z:.1});c.end();
    const rings=[];for(const a of [-.55,.55]){const r=new THREE.TorusGeometry(1.92,.055,8,56);r.rotateX(a);rings.push(r);}const orb=new THREE.SphereGeometry(.17,10,8);orb.translate(1.92,0,0);rings.push(orb);pack(rings,CELL.GREY,{y:3.0,z:-.75,spin:.15,label:'Great orrery'});
    for(const x of [-2.5,2.5]){B(.64,1.55,1.65,CELL.WHITE,{x,y:.775,z:-.4});roof(.82,1.83,.80,{x,y:1.55,z:-.4});}
    for(const x of [-2.5,2.5])for(const z of [-.88,-.10])pane(.23,.45,{x:x+Math.sign(x)*.327,y:.93,z,ry:Math.sign(x)*Math.PI/2});
    B(5.5,.07,2.8,CELL.ROCK,{y:.035,z:1.75,label:'Maze forecourt'});
    for(const x of [-2.4,-1.4,1.4,2.4])hedge(1,{x,y:.07,z:2.67});for(const x of [-2.65,2.65])for(const z of [.75,1.75,2.75])hedge(1,{x,y:.07,z,ry:Math.PI/2});
    for(const x of [-1.3,1.3]){hedge(1,{x,y:.07,z:1.68});hedge(1,{x:x+Math.sign(x)*.28,y:.07,z:1.12,ry:Math.PI/2});}
    A(.70,1.28,.22,.45,CELL.WHITE,{z:1.05,label:'Gear gate'});B(.065,.8,.055,CELL.TRIM,{x:.3,y:.44,z:1.30,emissive:.6});
    for(const x of [-.49,.49]){const geos=[new THREE.TorusGeometry(.46,.09,6,20)];for(let i=0;i<12;i++){const a=i*Math.PI/6,q=new THREE.BoxGeometry(.14,.17,.13);q.translate(0,.47,0);q.rotateZ(a);geos.push(q);}for(let i=0;i<3;i++)geos.push(new THREE.BoxGeometry(.75,.07,.10).rotateZ(i*Math.PI/3));pack(geos,CELL.BLACK,{x,y:1.64,z:1.19,rz:x<0?0:Math.PI/12,label:x<0?'Meshing gear pair':undefined});}
    B(.045,1.95,.03,CELL.TRIM,{x:-2.5,y:1.10,z:.442,emissive:.6,label:'Rune strip'});flag(2.5,2.36,-.4,CELL.TRIM);
    c.end();
    return {label:"Castle of Creative Problem Solving",kind:'hero',pose(t,p){p.dome.rotation.y=t*Math.PI/2;}};
  },
}

/**
 * Totoro's umbrella. From ChatGPT's Totoro_Umbrella batch, made into an ES module fed the
 * colony's THREE. Held over Totoro's head when the weather desk says it's actually raining in
 * KC — the bus-stop pose. Origin is the bottom of the J-hook grip; shaft is +Y, forward +Z.
 */
import * as THREE from 'three'
globalThis.THREE = globalThis.THREE || THREE

/* Self-contained Totoro umbrella. +Y up, +Z forward, handle bottom at y=0.
   Diameter 0.9; height 1.1; root scale remains (1,1,1). */
function createUmbrella({color = '#c0392b'} = {}) {
  const THREE = globalThis.THREE;
  if (!THREE) throw new Error('createUmbrella requires globalThis.THREE');
  const g = new THREE.Group();
  g.name = 'Totoro umbrella';
  const material = (color) => new THREE.MeshStandardMaterial({
    color, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide
  });
  const base = new THREE.Color(color);
  const panels = [material(base), material(base.clone().multiplyScalar(0.84))];
  const steel = material(0x45444a), handle = material(0x322b29);
  const seam = material(base.clone().multiplyScalar(0.66));
  const add = (geometry, mat, x=0, y=0, z=0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
    g.add(mesh); return mesh;
  };
  const radius = 0.45, segments = 8;
  const dome = (r) => 1.055 - 0.24 * Math.pow(r/radius, 1.65);
  // Each panel is a curved surface with a gently scalloped perimeter.
  for(let panel=0;panel<segments;panel++) {
    const vertices=[], indices=[], rings=14, slices=8;
    for(let row=0;row<=rings;row++) for(let col=0;col<=slices;col++) {
      const u=col/slices, t=row/rings;
      const angle=(panel+u)*Math.PI*2/segments;
      const scallop=Math.sin(u*Math.PI);
      const r=radius*t*(1-0.045*scallop*Math.pow(t,6));
      vertices.push(Math.sin(angle)*r, dome(radius*t)+0.018*scallop*Math.pow(t,8), Math.cos(angle)*r);
    }
    for(let row=0;row<rings;row++) for(let col=0;col<slices;col++) {
      const a=row*(slices+1)+col,b=a+slices+1;
      if(row>0) indices.push(a,b,a+1);
      indices.push(a+1,b,b+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    add(geometry,panels[panel%2]).name='canopy-panel-'+(panel+1);
  }
  const tube = (points,r,mat) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,r,6,false),mat);
  const rod = (a,b,r,mat) => {
    const d=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
    const mesh=add(new THREE.CylinderGeometry(r,r,d.length(),10),mat,...mid.toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;
  };
  for(let i=0;i<segments;i++) {
    const angle=i*Math.PI*2/segments;
    const points=Array.from({length:15},(_,j)=>{
      const r=radius*j/14;
      return new THREE.Vector3(Math.sin(angle)*r,dome(r)-.008,Math.cos(angle)*r);
    });
    tube(points,.0035,steel).name='underside-rib-'+(i+1);
    const r=.235;
    rod(new THREE.Vector3(0,.68,0),new THREE.Vector3(Math.sin(angle)*r,dome(r)-.012,Math.cos(angle)*r),.003,steel);
    const trim=Array.from({length:13},(_,j)=>{
      const u=j/12,a=(i+u)*Math.PI*2/segments,s=Math.sin(u*Math.PI),r=radius*(1-.045*s);
      return new THREE.Vector3(Math.sin(a)*r,.815+.018*s,Math.cos(a)*r);
    });
    tube(trim,.003,seam);
  }
  add(new THREE.CylinderGeometry(.008,.008,1.00,12),steel,0,.556,0).name='central-shaft';
  add(new THREE.CylinderGeometry(.016,.016,.032,12),steel,0,.68,0).name='runner';
  add(new THREE.ConeGeometry(.013,.055,12),steel,0,1.0725,0).name='top-ferrule';
  // Lower half circle: its tube bottom is exactly y=0.
  class HookCurve extends THREE.Curve {
    getPoint(t,target=new THREE.Vector3()) {
      const a=Math.PI+t*Math.PI;
      return target.set(-.045+.045*Math.cos(a),.056+.045*Math.sin(a),0);
    }
  }
  add(new THREE.TubeGeometry(new HookCurve(),24,.011,8,false),handle).name='J-hook';
  add(new THREE.CylinderGeometry(.011,.011,.043,12),handle,-.09,.0775,0);
  add(new THREE.SphereGeometry(.011,12,8),handle,-.09,.099,0);
  let disposed=false;
  g.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    g.removeFromParent();
    const geometries=new Set(),materials=new Set();
    g.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of [].concat(o.material))materials.add(m);}});
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());
  };
  return g;
}
globalThis.createUmbrella = createUmbrella;

export { createUmbrella }

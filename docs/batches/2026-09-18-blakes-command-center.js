const PIECES = {
  blakesDesk(c, rand) {
    // Coherent assemblies share geometry; every color remains an engine palette role.
    const bins = new Map();
    const add = (key, cell, geo, x=0, y=0, z=0, rx=0, ry=0, rz=0, glow=0) => {
      geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x,y,z);
      let b=bins.get(key+'|'+cell); if(!b){b={cell,glow,geos:[]};bins.set(key+'|'+cell,b);} b.geos.push(geo);
    };
    const B=(k,cell,w,h,d,x,y,z,rx=0,ry=0,rz=0,glow=0)=>add(k,cell,new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz,glow);
    const C=(k,cell,r,h,x,y,z,rx=0,ry=0,rz=0,glow=0)=>add(k,cell,new THREE.CylinderGeometry(r,r,h,12),x,y,z,rx,ry,rz,glow);
    const E=(k,cell,w,h,d,x,y,z,ry=0)=>{const a=new THREE.SphereGeometry(1,12,8);a.scale(w,h,d);add(k,cell,a,x,y,z,0,ry);};
    const R=(k,cell,r,t,x,y,z,glow=0)=>add(k,cell,new THREE.TorusGeometry(r,t,6,16),x,y,z,0,0,0,glow);
    const rod=(k,cell,a,b,r)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const g=new THREE.CylinderGeometry(r,r,d.length(),7);g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())));p.add(q).multiplyScalar(.5);add(k,cell,g,p.x,p.y,p.z);};
    const shape=(k,cell,pts,thick,x,y,z)=>{const s=new THREE.Shape();pts.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:false});g.translate(0,0,-thick/2);add(k,cell,g,x,y,z);};
    const screen=(x,y,z,w,h,tilt=0,yaw=0)=>{
      const transform=(g,depth)=>{g.translate(0,0,depth);g.rotateX(tilt);g.rotateY(yaw);g.translate(x,y,z);return g;};
      add('monitor housings',CELL.BLACK,transform(new THREE.BoxGeometry(w+.075,h+.075,.095),0));
      add('screen glass',CELL.SOLAR_A,transform(new THREE.BoxGeometry(w,h,.018),.056));
      const bars=3+Math.floor(rand()*3);
      for(let i=0;i<bars;i++){const line=new THREE.BoxGeometry(w*(.36+(i%3)*.16),Math.max(.025,h*.042),.012);line.translate(-w*.08,h*.32-i*h*.13,0);add('screen graphics',CELL.WHITE,transform(line,.074),0,0,0,0,0,0,.23);}
    };
    // Open front, shallow back wall, a raised display panel above the desk.
    B('floor',CELL.SLATE,6.2,.14,6.2,0,.07,0);
    B('back wall',CELL.ROCK,6.05,3.75,.09,0,2.015,-2.96);
    B('display backboard',CELL.ROCK,2.24,1.43,.11,1.80,4.115,-2.86);
    B('display frame',CELL.GREY,.075,1.52,.11,.66,4.16,-2.78);B('display frame',CELL.GREY,.075,1.52,.11,2.94,4.16,-2.78);
    // Two open steel racks; deliberately chunky enough to survive the game camera.
    const rack=(key,x,w)=>{for(const dx of [-w/2,w/2])for(const z of [-2.73,-1.62])B(key+' frame',CELL.GREY,.065,4.04,.065,x+dx,2.16,z);for(const y of [.25,1.25,2.28,3.42,4.16]){B(key+' shelves',CELL.SLATE,w+.06,.055,1.18,x,y,-2.175);B(key+' frame',CELL.GREY,w+.07,.055,.055,x,y+.035,-1.575);}};
    rack('printer rack',-2.12,1.47);rack('server rack',-.43,1.62);
    // Orange/red printer frame accents, a visible bed and extruder on each machine.
    for(const y of [.30,2.33]){
      B('printers black',CELL.BLACK,1.12,.08,.85,-2.12,y+.04,-2.13);
      for(const dx of [-.49,.49])B('printers black',CELL.BLACK,.065,.81,.065,-2.12+dx,y+.48,-2.31);
      B('printers black',CELL.BLACK,1.05,.065,.065,-2.12,y+.865,-2.31);
      B('printers rails',CELL.GREY,1.02,.045,.06,-2.12,y+.44,-2.29);
      B('printers black',CELL.BLACK,.17,.18,.14,-2.19,y+.40,-2.20);
      B('printer accents',CELL.RED,.79,.07,.64,-2.12,y+.105,-2.03);
      B('printer beds',CELL.SOLAR_B,.70,.035,.56,-2.12,y+.16,-2.02);
      for(const dx of [-.49,.49])for(const dy of [.12,.86])B('printer accents',CELL.RED,.14,.13,.14,-2.12+dx,y+dy,-2.30);
      B('printer accents',CELL.RED,.26,.10,.16,-1.72,y+.08,-1.64);
    }
    C('filament reels',CELL.BLACK,.23,.15,-2.50,3.78,-2.27,Math.PI/2);
    C('filament centers',CELL.SOLAR_B,.18,.17,-2.50,3.78,-2.27,Math.PI/2);
    screen(-1.68,1.83,-1.52,.44,.92);
    // Two open PC cases, visible fan rings and a three-fan GPU shelf.
    for(const x of [-.86,.01]){
      B('PC cases',CELL.BLACK,.68,.85,.75,x,2.76,-2.11);
      B('PC interiors',CELL.SLATE,.57,.70,.055,x,2.76,-1.695);
      for(const dx of [-.31,.31])B('PC trim',CELL.TRIM,.045,.82,.055,x+dx,2.76,-1.64,0,0,0,.48);
      for(const y of [2.37,3.15])B('PC trim',CELL.TRIM,.65,.045,.055,x,y,-1.64,0,0,0,.48);
      for(const y of [2.59,2.94]){R('PC trim',CELL.TRIM,.125,.024,x-.10,y,-1.61,.48);C('PC fan hubs',CELL.GREY,.034,.025,x-.10,y,-1.58,Math.PI/2);}
      B('PC fan hubs',CELL.GREY,.12,.44,.05,x+.16,2.75,-1.63);
    }
    B('GPU bank',CELL.BLACK,.92,.38,.56,-.07,1.61,-1.94);
    for(const x of [-.34,-.07,.20]){R('PC trim',CELL.TRIM,.10,.021,x,1.61,-1.635,.48);C('PC fan hubs',CELL.GREY,.03,.03,x,1.61,-1.62,Math.PI/2);}
    B('server tower',CELL.BLACK,.55,.95,.65,-.94,.76,-1.92);
    for(const y of [.45,.73,1.01]){B('server vents',CELL.RED,.44,.19,.035,-.94,y,-1.575);for(const dx of [-.14,0,.14])B('server slots',CELL.BLACK,.06,.095,.015,-.94+dx,y,-1.548);}
    for(const x of [-.31,.17])B('storage boxes',CELL.GREY,.37,.41,.66,x,.50,-2.07);
    for(const x of [-.87,-.22,.43])screen(x,3.77,-1.64,.57,.44,0,x>.2?-.12:0);
    // Lava lamp sits beside the upper printers.
    C('lava base',CELL.SLATE,.11,.10,-1.50,3.51,-1.98);
    add('lava glass',CELL.SOLAR_B,new THREE.CylinderGeometry(.07,.115,.44,10),-1.50,3.78,-1.98);
    E('lava blobs',CELL.RED,.046,.085,.035,-1.50,3.80,-1.873);E('lava blobs',CELL.RED,.055,.052,.035,-1.51,3.65,-1.868);
    add('lava base',CELL.SLATE,new THREE.ConeGeometry(.078,.14,10),-1.50,4.06,-1.98);
    // Black L-shaped desk, an open knee space and the blueprint pedestal.
    B('desk',CELL.BLACK,2.37,.11,1.06,1.68,1.29,-1.01);B('desk',CELL.BLACK,.75,.11,1.72,2.49,1.29,.19);
    for(const x of [.60,2.74])for(const z of [-1.39,-.56])B('desk supports',CELL.SLATE,.10,1.10,.10,x,.69,z);
    B('desk supports',CELL.SLATE,.64,1.10,.67,2.48,.69,.67);
    B('blueprint board',CELL.WHITE,.59,.83,.045,2.49,.79,1.035,-.10);
    for(let i=0;i<5;i++)B('blueprint marks',CELL.GREY,.37-i*.035,.027,.015,2.47,.52+i*.12,1.09);
    // Wraparound monitor cockpit, including the overhead tilted display.
    screen(1.66,2.21,-1.52,1.18,.71,0,0);
    screen(1.61,2.93,-1.65,1.16,.56,.43,0);
    screen(.66,2.13,-1.34,.40,.98,0,.24);
    screen(2.64,2.12,-1.29,.41,1.02,0,-.35);
    for(const x of [.67,1.66,2.64])B('monitor supports',CELL.GREY,.055,.33,.055,x,1.50,-1.40);
    screen(1.62,1.58,-.91,.61,.35,-.17,0);screen(.94,1.54,-.91,.40,.27,-.17,.05);
    B('keyboard',CELL.GREY,.85,.045,.23,1.55,1.37,-.55);
    for(let j=0;j<3;j++)for(let i=0;i<8;i++)B('keyboard keys',i===0?CELL.RED:CELL.BLACK,.075,.018,.05,1.22+i*.091,1.402,-.62+j*.061);
    E('mouse',CELL.BLACK,.085,.05,.115,2.14,1.39,-.50);
    rod('white monitor arm',CELL.WHITE,[2.78,1.36,.40],[2.78,2.13,.40],.035);rod('white monitor arm',CELL.WHITE,[2.78,2.13,.40],[2.42,2.35,-.05],.035);
    for(let i=0;i<5;i++)B('books',i%2?CELL.SOLAR_B:CELL.ROCK,.14,.49+(i%2)*.09,.40,2.13+i*.17,3.20,-2.42);
    // Two decorative firearm silhouettes only: no functional/internal components.
    const gun=(x,y,z,w,scoped)=>{
      B('display guns',CELL.BLACK,w*.57,.105,.08,x-w*.02,y,z);C('display guns',CELL.BLACK,.028,w*.31,x-w*.45,y+.027,z,0,0,Math.PI/2);
      shape('display guns',CELL.BLACK,[[0,.045],[.38,.07],[.39,-.22],[.29,-.23],[.08,-.075]],.09,x+w*.29,y,z);
      B('display guns',CELL.BLACK,.075,.21,.075,x+w*.17,y-.12,z,0,0,.30);
      if(scoped){C('display guns',CELL.BLACK,.05,.46,x,y+.15,z,0,0,Math.PI/2);shape('display guns',CELL.BLACK,[[0,0],[.13,0],[.12,-.29],[.02,-.32],[-.015,-.26]],.075,x-.02,y-.065,z);}
      else for(let i=0;i<4;i++)B('shell accents',CELL.RED,.055,.14,.04,x-.06+i*.071,y+.015,z+.055);
    };
    gun(1.79,4.53,-2.72,1.70,false);gun(1.79,4.12,-2.72,1.61,true);
    // Exactly one sheathed katana beneath both guns.
    const sheath=new THREE.CatmullRomCurve3([new THREE.Vector3(.83,3.63,-2.70),new THREE.Vector3(1.34,3.59,-2.70),new THREE.Vector3(2.15,3.59,-2.70)]);
    add('single katana',CELL.BLACK,new THREE.TubeGeometry(sheath,10,.041,7,false));
    C('single katana',CELL.BLACK,.043,.45,2.39,3.59,-2.70,0,0,Math.PI/2);
    C('sword fittings',CELL.GREY,.078,.035,2.15,3.59,-2.70,0,0,Math.PI/2);
    for(const x of [.85,1.04,2.61])C('sword fittings',CELL.GREY,.046,.05,x,3.60,-2.70,0,0,Math.PI/2);
    // Both round-backed armchairs face +x; the rear chair is beside the printer.
    const chair=(key,x,z,yaw)=>{
      const put=(g,cell,dx,dy,dz)=>{g.translate(dx,dy,dz);g.rotateY(yaw);g.translate(x,0,z);add(key,cell,g);};
      const box=(w,h,d,dx,y,dz)=>put(new THREE.BoxGeometry(w,h,d),CELL.ROCK,dx,y,dz);
      const oval=(w,h,d,dx,y,dz)=>{const g=new THREE.SphereGeometry(1,12,8);g.scale(w,h,d);put(g,CELL.ROCK,dx,y,dz);};
      box(.91,.33,.90,0,.39,0);oval(.43,.10,.39,0,.61,.05);oval(.54,.50,.17,0,.83,-.41);
      for(const dx of [-.49,.49]){box(.19,.34,.84,dx,.53,.01);oval(.15,.17,.49,dx,.76,.03);}
      for(const dx of [-.34,.34])for(const dz of [-.31,.31])box(.10,.11,.10,dx,.195,dz);
    };
    chair('printer-side chair',-2.02,-.35,Math.PI/2-.08);
    chair('front-edge chair',-1.79,1.82,Math.PI/2+.07);
    // Round table between the inner arms, laptop turned toward the chairs.
    C('round table',CELL.BLACK,.58,.07,-.86,.77,.82);C('round table',CELL.BLACK,.075,.56,-.86,.455,.82);C('round table',CELL.BLACK,.33,.07,-.86,.175,.82);
    B('laptop shell',CELL.GREY,.56,.035,.39,-.89,.824,.85,0,Math.PI/2);
    screen(-.66,1.02,.85,.51,.34,-.15,-Math.PI/2);
    B('laptop keys',CELL.BLACK,.30,.009,.37,-.98,.848,.85);
    // Three deliberate cable routes, not a tangle of sub-pixel wires.
    for(const x of [-1.31,.40,2.8])rod('cables',CELL.BLACK,[x,.20,-2.79],[x,3.35,-2.79],.018);
    // Bake half-scale into vertices; only c.geom and the documented options reach Composer.
    for(const b of bins.values()){
      const pos=[],normal=[];
      for(const src of b.geos){const g=src.index?src.toNonIndexed():src;const p=g.attributes.position.array,n=g.attributes.normal.array;for(let i=0;i<p.length;i++)pos.push(p[i]*.5);for(let i=0;i<n.length;i++)normal.push(n[i]);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));
      c.geom(g,b.cell,b.glow?{emissive:b.glow}:{});
    }
    return 'Blake\'s Command Center';
  },
};

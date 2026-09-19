const PIECES = {
arcadehall(c, rand) {
  const box = (w,h,d,cell,o={}) => c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  const cyl = (r,h,cell,o={}) => c.geom(new THREE.CylinderGeometry(r,r,h,12),cell,o)
  box(5.4,1.68,3.82,CELL.WHITE,{y:.84,z:-.12,label:'Main hall'})
  box(5.52,.13,3.94,CELL.RED,{y:1.745,z:-.12,label:'Flat roof'})
  for(const x of [-2.61,2.61]) {
    box(.17,1.82,3.94,CELL.SLATE,{x,y:.91,z:-.12})
    box(.055,1.47,.065,CELL.TRIM,{x,y:.84,z:1.82,emissive:.8})
    box(.18,.18,3.96,CELL.WHITE,{x,y:1.89,z:-.12})
  }
  box(5.4,.18,.16,CELL.WHITE,{y:1.89,z:-2.02})
  for(const [w,y] of [[4.7,1.96],[3.65,2.16],[2.35,2.36]]) {
    box(w,.20,.24,CELL.SLATE,{y,z:1.62})
    box(w,.035,.045,CELL.TRIM,{y:y+.072,z:1.763,emissive:.85})
  }
  box(1.05,.16,.22,CELL.WHITE,{y:2.52,z:1.62,label:'Stepped crown'})
  box(.65,.045,.025,CELL.TRIM,{y:2.53,z:1.745,emissive:.8})
  box(4.1,.40,.54,CELL.BLACK,{y:1.48,z:1.80,label:'Marquee'})
  box(3.88,.25,.035,CELL.TRIM,{y:1.48,z:2.065,emissive:.85})
  for(const y of [1.285,1.675])box(4.12,.04,.56,CELL.TRIM,{y,z:1.8,emissive:.7})
  for(let i=0;i<13;i++)cyl(.028,.022,CELL.TRIM,{x:-1.86+i*.31,y:1.26,z:1.96,emissive:1})
  for(const x of [-.64,0,.64])box(.37,.105,.035,CELL.BLACK,{x,y:1.49,z:2.080,rz:x===0?0:.18})
  box(1.54,1.16,.055,CELL.BLACK,{y:.58,z:1.747,label:'Entrance reveal'})
  box(1.30,.91,.025,CELL.TRIM,{y:.56,z:1.782,emissive:.65,label:'Warm entrance'})
  for(const x of [-.345,.345]) {
    box(.63,.91,.035,CELL.SOLAR_A,{x,y:.56,z:1.812})
    box(.64,.035,.05,CELL.GREY,{x,y:1.02,z:1.84})
    box(.028,.84,.038,CELL.GREY,{x:x<0?-.055:.055,y:.56,z:1.843})
    box(.035,.20,.045,CELL.GREY,{x:x<0?-.11:.11,y:.49,z:1.865})
  }
  box(1.45,.025,.32,CELL.WHITE,{y:.0125,z:1.94,label:'Flush threshold'})
  for(const x of [-1.58,1.58]) {
    box(.58,.86,.06,CELL.SLATE,{x,y:.55,z:1.755})
    box(.43,.55,.018,CELL.SOLAR_A,{x,y:.66,z:1.797})
    box(.34,.055,.022,CELL.TRIM,{x,y:.87,z:1.812,emissive:rand()<.5?.65:.9})
    box(.30,.12,.022,CELL.TRIM,{x,y:.60,z:1.812,emissive:.7})
    box(.38,.045,.10,CELL.GREY,{x,y:.37,z:1.80})
  }
  for(const x of [-2.30,2.30]) {
    box(.16,.32,.16,CELL.BLACK,{x,y:1.02,z:1.80,label:x<0?'Wall lantern':undefined})
    box(.11,.21,.04,CELL.TRIM,{x,y:1.02,z:1.90,emissive:.9})
  }
  for(const x of [-1.5,1.5]) {
    box(.62,.18,.63,CELL.BLACK,{x,y:1.9,z:-.8})
    for(let i=0;i<4;i++)box(.48,.025,.055,CELL.GREY,{x,y:2.003,z:-1+i*.13})
  }
  return {label:'Arcade Hall',kind:'hero'}
},
carousel(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  const cyl=(r,h,cell,o={})=>c.geom(new THREE.CylinderGeometry(r,r,h,24),cell,o)
  cyl(2.20,.14,CELL.ROCK,{y:.07,label:'Boarded platform'})
  cyl(2.23,.065,CELL.BLACK,{y:.17})
  cyl(.16,2.18,CELL.GREY,{y:1.25,label:'Centre mast'})
  cyl(.50,1.48,CELL.SLATE,{y:1.03,label:'Organ housing'})
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4
    box(.20,.81,.025,CELL.TRIM,{x:Math.sin(a)*.502,y:1.02,z:Math.cos(a)*.502,ry:a,emissive:.65})
  }
  c.geom(new THREE.ConeGeometry(2.247,.67,24),CELL.RED,{y:2.545,label:'Conical canopy'})
  // Decorative fabric gores lie over a continuous roofing shell.
  for(let i=0;i<8;i++)c.geom(new THREE.ConeGeometry(2.25,.671,3,1,true,i*Math.PI/4,.29),CELL.RED,{y:2.548})
  cyl(2.25,.14,CELL.ROCK,{y:2.20,label:'Scalloped fascia'})
  for(let i=0;i<24;i++) {
    const a=i*Math.PI/12
    c.geom(new THREE.SphereGeometry(.043,8,6),CELL.TRIM,{x:2.20*Math.sin(a),y:2.19,z:2.20*Math.cos(a),emissive:.85})
  }
  c.geom(new THREE.SphereGeometry(.08,10,8),CELL.TRIM,{y:2.92,emissive:.8,label:'Crown beacon',spin:.5})
  c.group('ride',{y:.205})
  cyl(2.05,.05,CELL.ROCK,{y:.025})
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,x=1.46*Math.sin(a),z=1.46*Math.cos(a)
    cyl(.025,1.91,CELL.GREY,{x,y:1.00,z,label:i===0?'Ride poles':undefined})
    box(.43,.11,.37,CELL.ROCK,{x,y:.46,z,ry:a,label:i===0?'Empty ride seats':undefined})
    box(.43,.30,.065,CELL.RED,{x:x-Math.sin(a)*.155,y:.66,z:z-Math.cos(a)*.155,ry:a})
    for(const s of [-1,1])box(.045,.14,.35,CELL.GREY,{x:x+s*Math.cos(a)*.21,y:.57,z:z-s*Math.sin(a)*.21,ry:a})
  }
  c.end()
  return {label:'Carousel',kind:'hero',loop:24,pose(t,parts){parts.ride.rotation.y=t*Math.PI*2}}
},
arcadecabinet(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  box(.42,.53,.34,CELL.BLACK,{y:.265,z:0})
  for(const x of [-.21,.21])box(.025,1.11,.35,CELL.ROCK,{x,y:.555,z:0})
  box(.40,.12,.37,CELL.BLACK,{y:1.09})
  box(.35,.066,.02,CELL.TRIM,{y:1.09,z:.19,emissive:.9})
  box(.38,.37,.075,CELL.BLACK,{y:.845,z:.045,rx:-.17})
  box(.32,.26,.023,CELL.SOLAR_A,{y:.845,z:.09,rx:-.17})
  box(.23,.04,.014,CELL.TRIM,{y:.895,z:.109,rx:-.17,emissive:.85})
  box(.11,.06,.014,CELL.TRIM,{x:rand()<.5?-.065:.065,y:.79,z:.102,emissive:.75})
  box(.43,.065,.23,CELL.GREY,{y:.61,z:.075,rx:.10})
  for(const x of [-.115,.075]) {
    c.geom(new THREE.CylinderGeometry(.012,.012,.055,8),CELL.GREY,{x,y:.673,z:.10})
    c.geom(new THREE.SphereGeometry(.026,8,6),CELL.BLACK,{x,y:.708,z:.10})
  }
  c.geom(new THREE.CylinderGeometry(.020,.020,.012,10),CELL.RED,{x:.15,y:.652,z:.10})
  box(.11,.17,.02,CELL.BLACK,{y:.29,z:.18})
  box(.07,.012,.012,CELL.GREY,{y:.33,z:.19})
  box(.35,.04,.025,CELL.TRIM,{y:.08,z:.18,emissive:.6})
  return {label:'Arcade Cabinet',kind:'furniture'}
},
neonarch(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  for(const x of [-1.88,1.88]) {
    box(.24,.15,.42,CELL.WHITE,{x,y:.075})
    box(.16,2.12,.23,CELL.BLACK,{x,y:1.18})
    box(.045,1.91,.035,CELL.TRIM,{x,y:1.20,z:.132,emissive:.85})
    box(.24,.12,.30,CELL.GREY,{x,y:2.24})
  }
  box(4,.18,.26,CELL.BLACK,{y:2.31})
  box(3.80,.045,.025,CELL.TRIM,{y:2.35,z:.147,emissive:1})
  box(3.80,.04,.025,CELL.TRIM,{y:2.25,z:.147,emissive:.8})
  for(const x of [-.45,0,.45])box(.24,.065,.025,CELL.TRIM,{x,y:2.305,z:.15,emissive:.8})
  return {label:'Neon Arch',kind:'furniture'}
},
ticketbooth(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  c.geom(new THREE.CylinderGeometry(.54,.54,.09,6),CELL.WHITE,{y:.045,ry:Math.PI/6})
  c.geom(new THREE.CylinderGeometry(.50,.50,.46,6),CELL.ROCK,{y:.32,ry:Math.PI/6})
  for(let i=0;i<6;i++) {
    const a=Math.PI/6+i*Math.PI/3
    box(.043,.73,.043,CELL.GREY,{x:.50*Math.sin(a),y:.90,z:.50*Math.cos(a)})
  }
  for(let i=1;i<6;i++) {
    const a=i*Math.PI/3
    box(.455,.54,.018,CELL.SOLAR_A,{x:.435*Math.sin(a),y:.85,z:.435*Math.cos(a),ry:a})
  }
  box(.46,.47,.023,CELL.BLACK,{y:.85,z:-.32})
  box(.36,.32,.018,CELL.TRIM,{y:.89,z:-.30,emissive:.7})
  box(.61,.045,.23,CELL.ROCK,{y:.57,z:.42})
  box(.09,.07,.09,CELL.BLACK,{x:.17,y:.625,z:.42})
  c.geom(new THREE.CylinderGeometry(.54,.54,.09,6),CELL.BLACK,{y:1.24,ry:Math.PI/6})
  c.geom(new THREE.ConeGeometry(.60,.25,6),CELL.RED,{y:1.41,ry:Math.PI/6})
  box(.50,.16,.06,CELL.BLACK,{y:1.51,z:.31})
  box(.42,.095,.016,CELL.TRIM,{y:1.51,z:.348,emissive:.9})
  box(.48,.025,.025,CELL.TRIM,{y:1.40,z:.35,emissive:.65})
  return {label:'Ticket Booth',kind:'furniture'}
},
clawmachine(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  box(.48,.38,.48,CELL.BLACK,{y:.19})
  box(.48,.13,.48,CELL.BLACK,{y:1.135})
  box(.40,.074,.018,CELL.TRIM,{y:1.14,z:.24,emissive:.9})
  for(const x of [-.222,.222])for(const z of [-.222,.222])box(.035,.70,.035,CELL.GREY,{x,y:.73,z})
  for(const x of [-.236,.236])box(.012,.65,.40,CELL.SOLAR_A,{x,y:.73})
  box(.40,.65,.012,CELL.SOLAR_A,{y:.73,z:-.236})
  // Open front glazing reveal keeps the crane legible with opaque palette glass.
  box(.39,.025,.025,CELL.TRIM,{y:1.043,z:.19,emissive:.85})
  box(.40,.025,.025,CELL.GREY,{y:.99,z:0})
  const sx=(rand()-.5)*.12
  box(.075,.055,.08,CELL.BLACK,{x:sx,y:.95})
  c.geom(new THREE.CylinderGeometry(.009,.009,.20,8),CELL.GREY,{x:sx,y:.83})
  c.geom(new THREE.SphereGeometry(.025,8,6),CELL.GREY,{x:sx,y:.72})
  for(const side of [-1,1])box(.016,.115,.018,CELL.GREY,{x:sx+side*.035,y:.669,rz:-side*.5})
  for(let i=0;i<5;i++)box(.085,.07,.08,i%2?CELL.RED:CELL.TRIM,{x:(i%3-1)*.12,y:.42,z:i<3?.10:-.07,ry:(rand()-.5)*.5})
  box(.17,.105,.02,CELL.BLACK,{x:-.10,y:.16,z:.24})
  box(.035,.013,.02,CELL.GREY,{x:.13,y:.26,z:.24})
  box(.065,.015,.025,CELL.RED,{x:.12,y:.39,z:.20})
  return {label:'Claw Machine',kind:'furniture'}
},
skeeballrun(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  for(const x of [-.225,.225]) {
    box(.42,.13,2.38,CELL.ROCK,{x,y:.065})
    box(.36,.055,1.55,CELL.ROCK,{x,y:.185,z:.39,rx:.075})
    box(.36,.045,.47,CELL.ROCK,{x,y:.335,z:-.59,rx:.50})
    box(.40,.53,.055,CELL.BLACK,{x,y:.625,z:-1.14})
    box(.33,.38,.023,CELL.TRIM,{x,y:.66,z:-1.10})
    for(const [yy,rr] of [[.71,.088],[.52,.062]]) {
      c.geom(new THREE.TorusGeometry(rr,.014,6,16),CELL.GREY,{x,y:yy,z:-1.075})
      c.geom(new THREE.CylinderGeometry(rr-.016,rr-.016,.014,16),CELL.BLACK,{x,y:yy,z:-1.087,rx:Math.PI/2})
    }
    for(const side of [-1,1])box(.025,.15,2.38,CELL.GREY,{x:x+side*.198,y:.185})
    box(.18,.06,.03,CELL.TRIM,{x,y:.855,z:-1.10,emissive:.75})
    box(.14,.085,.24,CELL.BLACK,{x:x+.10,y:.17,z:.99})
    for(let i=0;i<2;i++)c.geom(new THREE.SphereGeometry(.034,8,6),CELL.TRIM,{x:x+.10,y:.226,z:.94+i*.09})
  }
  return {label:'Skee-ball Lanes',kind:'furniture'}
},
boardwalkrail(c, rand) {
  const box=(w,h,d,cell,o={})=>c.geom(new THREE.BoxGeometry(w,h,d),cell,o)
  // Half-open repeating module: posts at -0.95 and 0.05; no doubled endpoint post.
  for(const x of [-.95,.05]) {
    box(.10,.62,.10,CELL.ROCK,{x,y:.31})
    box(.10,.045,.12,CELL.GREY,{x,y:.6425})
  }
  for(const y of [.26,.55])box(2,.065,.055,CELL.ROCK,{y})
  for(const x of [-.65,-.35,.35,.65])box(.025,.28,.025,CELL.GREY,{x,y:.405})
  box(.04,.28,.04,CELL.GREY,{x:.05,y:.80})
  box(.14,.13,.14,CELL.SOLAR_A,{x:.05,y:1.005})
  box(.17,.04,.17,CELL.BLACK,{x:.05,y:1.09})
  return {label:'Boardwalk Railing',kind:'segment'}
},
}

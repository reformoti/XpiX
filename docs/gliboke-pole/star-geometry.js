import * as THREE from './vendor/three.module.js';

// Shared sculpture geometry: used by the immersive scene and the XpiX homepage.
function starOutline(L, t) {
  const pts = [
    [0, L], [-t, t], [-L, 0], [-t, -t],
    [0, -L], [t, -t], [L, 0], [t, t],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

export function buildStarSculpture(m, L, t, depth) {
  const g = new THREE.Group();

  const bodyGeo = new THREE.ExtrudeGeometry(starOutline(L, t), {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.14,
    bevelSize: t * 0.18,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 1,
  });
  bodyGeo.translate(0, 0, -depth / 2);
  g.add(new THREE.Mesh(bodyGeo, [m.face, m.edge]));

  const inlayGeo = new THREE.ExtrudeGeometry(starOutline(L * 0.3, t * 0.3), {
    depth: depth * 0.14,
    bevelEnabled: true,
    bevelThickness: depth * 0.05,
    bevelSize: t * 0.06,
    bevelSegments: 1,
    curveSegments: 1,
  });
  for (const s of [1, -1]) {
    const inlay = new THREE.Mesh(inlayGeo, m.inlay);
    inlay.position.z = s * (depth / 2 + depth * 0.13);
    if (s < 0) inlay.rotation.y = Math.PI;
    g.add(inlay);
  }

  return g;
}


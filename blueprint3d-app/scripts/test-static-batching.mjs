import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function load(relative) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(app,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require(name){return name==='three'?THREE:name.includes('BufferGeometryUtils')?geometryUtils:{};}});
  return exports;
}
const {batchStaticMeshes}=load('src/scene/batchStaticMeshes.ts');
const room=new THREE.Group();
room.position.set(10,0,20); room.rotation.y=.7;
const nested=new THREE.Group(); nested.rotation.x=.35; room.add(nested);
const material=new THREE.MeshStandardMaterial();
for(let n=0;n<8;n++) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.2,.5),material);
  mesh.position.set(n*.4,.8,n*.1); mesh.scale.set(1.2,1,1); mesh.castShadow=true; nested.add(mesh);
}
const noShadow=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.6),material); room.add(noShadow);
const glass=new THREE.Mesh(new THREE.BoxGeometry(1,1,.02),new THREE.MeshStandardMaterial({transparent:true,opacity:.5})); room.add(glass);
room.updateWorldMatrix(true,true);
const beforeBounds=new THREE.Box3().setFromObject(room,true);
function triangles(group){let count=0;group.traverse(o=>{if(o.isMesh)count+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return count;}
const beforeTriangles=triangles(room);
batchStaticMeshes(room);
room.updateWorldMatrix(true,true);
const afterBounds=new THREE.Box3().setFromObject(room,true);
assert.equal(room.getObjectsByProperty('isMesh',true).length,3,'eight fixed opaque objects must become one batch');
assert.equal(triangles(room),beforeTriangles,'batching must preserve all triangles');
assert.ok(beforeBounds.min.distanceTo(afterBounds.min)<1e-5 && beforeBounds.max.distanceTo(afterBounds.max)<1e-5,'nested transforms and world bounds must be preserved');
assert.equal(glass.parent,room,'transparent meshes retain their own sorting');
assert.equal(noShadow.parent,room,'different shadow flags remain separate');

const {ArchitecturalStaging}=load('src/scene/ArchitecturalStaging.ts');
const seminar={id:'seminar',x:22,y:10,width:6,height:7};
for(const hasDoor of [true,false]) {
  const parent=new THREE.Group();
  const plan={defaultInteriorThickness:.2,doors:hasDoor?[{x:25,y:10,width:.9}]:[]};
  const staging=new ArchitecturalStaging(plan,parent,{});
  staging.stageSeminarRoom(seminar);
  parent.updateWorldMatrix(true,true);
  const display=parent.getObjectByName('seminar-display-seminar');
  const box=new THREE.Box3().setFromObject(display);
  if(hasDoor) {
    assert.ok(box.min.x>=22.1-1e-6,'display must sit outside the west wall face');
    const doorway=new THREE.Box3(new THREE.Vector3(24.55,0,9.8),new THREE.Vector3(25.45,2.1,10.2));
    assert.equal(box.intersectsBox(doorway),false,'display must never cover the north doorway');
  } else assert.ok(box.min.z>=10.1-1e-6,'north-wall display must face into the room and clear the wall surface');
}
console.log('PASS: static batching preserves geometry, transforms, transparency and shadow flags; seminar screens clear walls and doorways.');

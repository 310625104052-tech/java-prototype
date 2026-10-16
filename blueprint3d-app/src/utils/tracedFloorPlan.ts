import type { FloorPlanData, PlanPolygon, WallData, DoorData } from '../types/floorplan';

export type Point = [number, number];
export function tracedFloorPlan(outline: Point[], partitions: [Point,Point][], gaps: Point[], widthMeters: number): FloorPlanData {
  const minX=Math.min(...outline.map(p=>p[0])), minY=Math.min(...outline.map(p=>p[1]));
  const ppm=(Math.max(...outline.map(p=>p[0]))-minX)/widthMeters;
  const map=([x,y]:Point):Point=>[(x-minX)/ppm,(y-minY)/ppm];
  const ring=outline.map(map);
  const segments:[Point,Point][] = outline.map((p,i)=>[p,outline[(i+1)%outline.length]]);
  segments.push(...partitions);
  const walls:WallData[]=segments.map(([a,b],i)=>({id:`traced-${i}`,x1:map(a)[0],y1:map(a)[1],x2:map(b)[0],y2:map(b)[1],thickness:.18,height:3.2}));
  const doors:DoorData[]=[];
  for(const gap of gaps) {
    const [x,y]=map(gap);
    const choices=walls.map(w=>{
      const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy);
      const t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/(len*len)));
      const px=w.x1+dx*t,py=w.y1+dy*t;
      return {w,len,px,py,d:Math.hypot(px-x,py-y),t};
    }).sort((a,b)=>a.d-b.d);
    const c=choices[0];
    if(c && c.len>.95 && c.d<.6 && c.t*c.len>.45 && (1-c.t)*c.len>.45) {
      doors.push({id:`trace-door-${doors.length}`,wallId:c.w.id,x:c.px,y:c.py,width:.9,height:2.3,angle:Math.atan2(c.w.y2-c.w.y1,c.w.x2-c.w.x1),orientation:Math.abs(c.w.y2-c.w.y1)>Math.abs(c.w.x2-c.w.x1)?'vertical':'horizontal',isOpen:true});
    }
  }
  function slab(w:WallData,start:number,end:number):PlanPolygon {
    const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy*.09,ny=ux*.09;
    const a:Point=[w.x1+ux*start,w.y1+uy*start],b:Point=[w.x1+ux*end,w.y1+uy*end];
    return {outer:[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],holes:[]};
  }
  const lower:PlanPolygon[]=[], upper:PlanPolygon[]=[];
  for(const wall of walls) {
    const length=Math.hypot(wall.x2-wall.x1,wall.y2-wall.y1);
    if(length<.01)continue;
    upper.push(slab(wall,-.09,length+.09));
    const cuts=doors.filter(d=>d.wallId===wall.id).map(d=>{
      const s=((d.x-wall.x1)*(wall.x2-wall.x1)+(d.y-wall.y1)*(wall.y2-wall.y1))/length;
      return [s-.45,s+.45];
    }).sort((a,b)=>a[0]-b[0]);
    let start=-.09;
    for(const [a,b] of cuts) {if(a>start)lower.push(slab(wall,start,a));start=Math.max(start,b);}
    if(start<length+.09)lower.push(slab(wall,start,length+.09));
  }
  const maxX=Math.max(...ring.map(p=>p[0])),maxY=Math.max(...ring.map(p=>p[1]));
  function inside(x:number,y:number) {
    let hit=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  }
  let spawn={x:ring[0][0],y:ring[0][1]},best=-1;
  for(let ix=1;ix<40;ix++)for(let iy=1;iy<40;iy++) {
    const x=maxX*ix/40,y=maxY*iy/40;if(!inside(x,y))continue;
    const distance=Math.min(...walls.map(w=>{
      const dx=w.x2-w.x1,dy=w.y2-w.y1;
      const t=Math.max(0,Math.min(1,((x-w.x1)*dx+(y-w.y1)*dy)/(dx*dx+dy*dy)));
      return Math.hypot(x-w.x1-t*dx,y-w.y1-t*dy);
    }));
    if(distance>best){best=distance;spawn={x,y};}
  }
  return {source:'detected',reconstruction:'traced',name:'Traced floor plan',description:'User traced footprint and walls; scale set by footprint width.',unit:'meters',
    bounds:{minX:-.1,minY:-.1,maxX:maxX+.1,maxY:maxY+.1},defaultWallHeight:3.2,defaultExteriorThickness:.18,defaultInteriorThickness:.18,
    spawnPoint:{...spawn,z:1.65},walls,doors,windows:[],rooms:[],
    shell:{layers:[{bottom:0,top:2.3,polygons:lower},{bottom:2.3,top:3.2,polygons:upper}],collision:lower,footprint:[{outer:ring,holes:[]}],spawn}};
}

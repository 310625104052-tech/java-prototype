import { useState } from 'react';
import type { WallDetectionResult } from '../types/blueprint';
import type { FloorPlanData } from '../types/floorplan';
import { convertDetectionToFloorPlan } from '../utils/detectionToFloorPlan';
import { tracedFloorPlan, Point } from '../utils/tracedFloorPlan';

export function ImportReview({result,onReady,onBack}:{result:WallDetectionResult;onReady:(plan:FloorPlanData)=>void;onBack:()=>void}) {
  const [overlay,setOverlay]=useState(false);
  const [tracing,setTracing]=useState(false);
  const [outline,setOutline]=useState<Point[]>([]);
  const [closed,setClosed]=useState(false);
  const [partitions,setPartitions]=useState<[Point,Point][]>([]);
  const [pending,setPending]=useState<Point|null>(null);
  const [gaps,setGaps]=useState<Point[]>([]);
  const [tool,setTool]=useState<'walls'|'doors'>('walls');
  const [width,setWidth]=useState(12);
  const w=result.image_width,h=result.image_height;
  const source=result.preview_image || result.debug_layers?.original_image || result.debug_image;
  const display=overlay?(result.debug_layers?.final_2d_image || source):source;
  const warnings=result.import_info?.warnings || [];
  const area=Math.abs(outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
  const valid=area>10 && outline.length>=3 && Math.max(...outline.map(p=>p[0]))-Math.min(...outline.map(p=>p[0]))>5;
  return <div className="absolute inset-0 z-50 overflow-auto bg-slate-950 p-4 text-slate-100 sm:p-6">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-xl font-semibold">{result.mode==='reference'?'Reference imported':'Review imported plan'}</h1>
          <p className="mt-1 text-sm text-slate-400">{result.filename}</p></div>
        <button onClick={onBack} className="rounded-lg bg-slate-800 px-4 py-2 text-sm">Choose another file</button>
      </div>
      <div className="my-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
        {warnings.map((warning,i)=><p className="mb-1" key={i}>{warning}</p>)}
      </div>
      {result.import_info?.layers && <p className="mb-3 text-xs text-slate-400">DXF architectural layers: {Object.keys(result.import_info.layers).join(', ')}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        {result.mode!=='reference' && <>
          <button className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950" onClick={()=>onReady(convertDetectionToFloorPlan(result))}>Open approximate 3D</button>
          <button className="rounded-lg bg-slate-800 px-3 py-2" onClick={()=>setOverlay(!overlay)}>{overlay?'Show source':'Show detected overlay'}</button>
        </>}
        <button className="rounded-lg bg-slate-800 px-3 py-2" onClick={()=>{setTracing(!tracing);setOverlay(false);}}> {tracing?'Stop tracing':'Trace / correct walls'}</button>
      </div>
      {tracing && <div className="mb-3 rounded-xl bg-slate-900 p-3 text-sm">
        <p className="mb-3">{!closed?'Click the outside corners of the floor footprint in order, then finish it.':'Add interior walls by clicking their two ends. Door gaps snap to the nearest traced wall.'} Trace only a top-down floor layout.</p>
        <div className="flex flex-wrap items-center gap-3">
          {!closed?<button disabled={!valid} className="rounded bg-sky-600 px-3 py-2 disabled:opacity-30" onClick={()=>setClosed(true)}>Finish footprint</button>:<>
            <button className={`rounded px-3 py-2 ${tool==='walls'?'bg-sky-600':'bg-slate-800'}`} onClick={()=>{setTool('walls');setPending(null);}}>Interior walls</button>
            <button className={`rounded px-3 py-2 ${tool==='doors'?'bg-sky-600':'bg-slate-800'}`} onClick={()=>{setTool('doors');setPending(null);}}>Door gaps</button>
          </>}
          <button onClick={()=>{if(pending)setPending(null);else if(gaps.length)setGaps(gaps.slice(0,-1));else if(partitions.length)setPartitions(partitions.slice(0,-1));else {setClosed(false);setOutline(outline.slice(0,-1));}}}>Undo</button>
          <button onClick={()=>{setOutline([]);setClosed(false);setPartitions([]);setGaps([]);setPending(null);}}>Clear trace</button>
          <label>Footprint width (m) <input aria-label="Footprint width in meters" type="number" min="1" max="500" value={width} onChange={e=>setWidth(Number(e.target.value))} className="w-20 rounded bg-slate-800 p-2"/></label>
          <button disabled={!closed||!valid||!Number.isFinite(width)||width<1||width>500} onClick={()=>onReady(tracedFloorPlan(outline,partitions,gaps,width))} className="rounded bg-emerald-500 px-3 py-2 font-semibold text-slate-950 disabled:opacity-30">Build traced 3D</button>
        </div>
      </div>}
      <div className="overflow-auto rounded-xl border border-slate-700 bg-white">
        <svg aria-label="Imported plan and wall tracing canvas" viewBox={`0 0 ${w} ${h}`} className={`block max-h-[70vh] w-full ${tracing?'cursor-crosshair':''}`} onClick={e=>{
          if(!tracing)return;
          const box=e.currentTarget.getBoundingClientRect();
          const scale=Math.min(box.width/w,box.height/h),ox=(box.width-w*scale)/2,oy=(box.height-h*scale)/2;
          const p:Point=[(e.clientX-box.left-ox)/scale,(e.clientY-box.top-oy)/scale];
          if(p[0]<0||p[0]>w||p[1]<0||p[1]>h)return;
          if(!closed)setOutline([...outline,p]);
          else if(tool==='doors')setGaps([...gaps,p]);
          else if(pending){if(Math.hypot(p[0]-pending[0],p[1]-pending[1])>3)setPartitions([...partitions,[pending,p]]);setPending(null);}
          else setPending(p);
        }}>
          <image href={display} x="0" y="0" width={w} height={h}/>
          {outline.length>0 && <polyline points={[...outline,...(closed?[outline[0]]:[])].map(p=>p.join(',')).join(' ')} fill={closed?'#0ea5e922':'none'} stroke="#0284c7" strokeWidth={Math.max(2,w/350)}/>}
          {outline.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={w/200} fill="#0284c7"/>)}
          {partitions.map(([a,b],i)=><line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#0284c7" strokeWidth={w/200}/>)}
          {pending && <circle cx={pending[0]} cy={pending[1]} r={w/150} fill="#f59e0b"/>}
          {gaps.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={w/90} fill="#22c55e88" stroke="#16a34a" strokeWidth="2"/>)}
        </svg>
      </div>
      <p className="mt-3 text-xs text-slate-400">Importing a file does not establish architectural accuracy. Review estimates against the source; tracing uses the footprint width you enter.</p>
    </div>
  </div>;
}

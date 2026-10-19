import { ArrowLeft, ArrowUpRight, TriangleAlert } from 'lucide-react';
import { StudioMark } from './StudioMark';
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
  return <div className="studio-review" data-ui>
    <div className="studio-review-sheet">
      <div className="studio-review-header">
        <div><StudioMark compact/><h1>{result.mode==='reference'?'Reference imported':'Review imported plan'}</h1>
          <p className="studio-filename" title={result.filename}>{result.filename}</p></div>
        <button onClick={onBack} className="studio-secondary"><ArrowLeft size={16} aria-hidden="true"/> Choose another file</button>
      </div>
      <div className="studio-review-notice" role="status">
        <TriangleAlert size={19} aria-hidden="true"/><div><strong>Check against your drawing</strong>{warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>
      </div>
      {result.import_info?.layers && <p className="studio-layer-note">DXF architectural layers: {Object.keys(result.import_info.layers).join(', ')}</p>}
      <div className="studio-review-toolbar">
        {result.mode!=='reference' && <>
          <button className="studio-primary" onClick={()=>onReady(convertDetectionToFloorPlan(result))}>Open approximate 3D <ArrowUpRight size={16} aria-hidden="true"/></button>
          <button className="studio-secondary" aria-pressed={overlay} onClick={()=>setOverlay(!overlay)}>{overlay?'Show source':'Show detected overlay'}</button>
        </>}
        <button className="studio-secondary" aria-pressed={tracing} onClick={()=>{setTracing(!tracing);setOverlay(false);}}> {tracing?'Stop tracing':'Trace / correct walls'}</button>
      </div>
      {tracing && <div className="studio-trace-tools">
        <p className="studio-trace-instruction">{!closed?'Click the outside corners of the floor footprint in order, then finish it.':'Add interior walls by clicking their two ends. Door gaps snap to the nearest traced wall.'} Trace only a top-down floor layout.</p>
        <div className="studio-trace-actions">
          {!closed?<button disabled={!valid} className="studio-primary" onClick={()=>setClosed(true)}>Finish footprint</button>:<>
            <button aria-pressed={tool==='walls'} className={`rounded px-3 py-2 ${tool==='walls'?'is-active':''}`} onClick={()=>{setTool('walls');setPending(null);}}>Interior walls</button>
            <button aria-pressed={tool==='doors'} className={`rounded px-3 py-2 ${tool==='doors'?'is-active':''}`} onClick={()=>{setTool('doors');setPending(null);}}>Door gaps</button>
          </>}
          <button onClick={()=>{if(pending)setPending(null);else if(gaps.length)setGaps(gaps.slice(0,-1));else if(partitions.length)setPartitions(partitions.slice(0,-1));else {setClosed(false);setOutline(outline.slice(0,-1));}}}>Undo</button>
          <button onClick={()=>{setOutline([]);setClosed(false);setPartitions([]);setGaps([]);setPending(null);}}>Clear trace</button>
          <label>Footprint width (m) <input aria-label="Footprint width in meters" type="number" min="1" max="500" value={width} onChange={e=>setWidth(Number(e.target.value))} className="studio-width-input"/></label>
          <button disabled={!closed||!valid||!Number.isFinite(width)||width<1||width>500} onClick={()=>onReady(tracedFloorPlan(outline,partitions,gaps,width))} className="studio-primary">Build traced 3D</button>
        </div>
      </div>}
      <div className="studio-drawing-canvas">
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
          {pending && <circle cx={pending[0]} cy={pending[1]} r={w/150} fill="#a86f0c"/>}
          {gaps.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={w/90} fill="#22c55e88" stroke="#16a34a" strokeWidth="2"/>)}
        </svg>
      </div>
      <p className="studio-review-footnote">Importing a file does not establish architectural accuracy. Review estimates against the source; tracing uses the footprint width you enter.</p>
    </div>
  </div>;
}

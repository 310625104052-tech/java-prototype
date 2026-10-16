"""Read architectural DXF layers through nested INSERT transforms."""
import io
from collections import Counter
import cv2
import numpy as np
import ezdxf
from ezdxf import disassemble, path


def rasterize_dxf(data):
    try:
        doc=ezdxf.read(io.StringIO(data.decode('utf-8-sig',errors='surrogateescape').replace('\r\n','\n')))
    except Exception as exc:
        raise ValueError('This DXF could not be read. Export an ASCII DXF with embedded blocks.') from exc
    curves=[]
    layer_counts=Counter()
    for i,entity in enumerate(disassemble.recursive_decompose(doc.modelspace())):
        if i>150000: raise ValueError('DXF has too many expanded entities for this preview.')
        layer=entity.dxf.layer.upper()
        if not any(token in layer for token in ('WALL','PARTITION','GLASS','GLAZING','DOOR')): continue
        if any(token in layer for token in ('TEXT','-TX','HTH','-HA')): continue
        if entity.dxftype() not in ('LINE','LWPOLYLINE','POLYLINE','ARC','CIRCLE','ELLIPSE','SPLINE'): continue
        try:
            curve=path.make_path(entity)
            points=np.array([(v.x,v.y) for v in curve.flattening(2.,segments=8)],float)
            if len(points)<2:continue
            kind='door' if 'DOOR' in layer else 'window' if ('GLASS' in layer or 'GLAZING' in layer) else 'wall'
            curves.append((kind,points,bool(curve.is_closed)))
            layer_counts[layer]+=1
        except (TypeError,ValueError,NotImplementedError): continue
    walls=[points for kind,points,_ in curves if kind=='wall']
    if not walls: raise ValueError('No architectural wall or partition layers were found in the DXF.')
    all_points=np.concatenate(walls)
    lo,hi=all_points.min(axis=0),all_points.max(axis=0)
    extent=hi-lo
    factor=1800/max(extent)
    width,height=np.ceil(extent*factor).astype(int)+80
    img=np.full((max(80,height),max(80,width),3),255,np.uint8)
    for kind,points,closed in curves:
        p=(points-lo)*factor+40
        p[:,1]=height-p[:,1]
        # Preserve layer semantics in color while retaining readable black wall edges.
        color=(0,0,0) if kind=='wall' else (90,90,90)
        cv2.polylines(img,[p.round().astype(np.int32)],closed,color,3 if kind=='wall' else 1)
    notes=['DXF block transforms and architectural layers were imported; annotations, leaders, ducts and tables were excluded.']
    if doc.units==0: notes.append('DXF units are unspecified; metric scale is estimated and must be checked.')
    return img,{'method':'dxf_architectural_layers','warnings':notes,'layers':dict(layer_counts),
                'units':int(doc.units),'sourceSize':[int(width),int(height)]}

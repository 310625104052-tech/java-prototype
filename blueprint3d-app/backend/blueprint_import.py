"""File import is distinct from whether automatic reconstruction is complete."""
import cv2
import numpy as np
try:
    from .wall_detector import detect_walls_from_image_bytes, _encode_image_to_base64_png
except ImportError:
    from wall_detector import detect_walls_from_image_bytes, _encode_image_to_base64_png


def import_blueprint(data, filename):
    vector_info = None
    if filename.lower().endswith('.dxf'):
        try:
            from .dxf_import import rasterize_dxf
        except ImportError:
            from dxf_import import rasterize_dxf
        image, vector_info = rasterize_dxf(data)
        _, buffer=cv2.imencode('.png',image)
        raster=buffer.tobytes()
    else:
        raster=data
        try:
            image=cv2.imdecode(np.frombuffer(data,np.uint8),cv2.IMREAD_COLOR)
        except cv2.error:
            image=None
        if image is None: raise ValueError('The file is not a readable PNG or JPEG image.')
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    if float(gray.std())<1:
        raise ValueError('The image is blank; no drawing content was found.')
    # Very faint drawings can be elevations/sections or annotation-only sheets.
    # Keep them as editable references instead of inventing a 3D floor layout.
    if (gray<100).mean()<.003:
        result={'success':False,'error':'No clear floor footprint was found. A section or elevation does not define a top-down layout.'}
    else:
        result=detect_walls_from_image_bytes(raster)
    if result.get('success'):
        result['mode']='model'
        info=result.setdefault('import_info',{'warnings':[]})
        if vector_info:
            info['warnings']=vector_info['warnings']+info['warnings']
            info['layers']=vector_info['layers']
            info['method']=vector_info['method']
        if min(gray.shape)<250:
            info['warnings'].append('This thumbnail is accepted as an approximate reconstruction; fine internal walls may not be recovered.')
        if len(result.get('rooms',[]))>25:
            info['warnings'].append('The drawing has many small enclosed regions. Furniture or hatching may be included; review the overlay before using the model.')
        result['preview_image']=result['debug_layers']['original_image']
    else:
        if max(image.shape[:2])>2000:
            factor=2000/max(image.shape[:2])
            image=cv2.resize(image,None,fx=factor,fy=factor,interpolation=cv2.INTER_AREA)
        preview=_encode_image_to_base64_png(image)
        info=vector_info or {'method':'reference','warnings':[]}
        info['warnings'].append(result.get('error','Automatic reconstruction is uncertain.'))
        info['warnings'].append('The file is imported as a reference. Trace its floor footprint and walls to build a model, or use a clearer top-down drawing.')
        result={'success':True,'mode':'reference','walls':[],'rooms':[],'openings':[],
                'wall_count':0,'image_width':image.shape[1],'image_height':image.shape[0],
                'preview_image':preview,'debug_image':preview,'binary_image':'',
                'debug_layers':{'original_image':preview},'import_info':info}
    info['reviewRequired']=bool(info['warnings']) or result['mode']=='reference'
    return result

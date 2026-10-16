import io
import unittest
from PIL import Image, ImageDraw
import ezdxf
from blueprint_import import import_blueprint
from dxf_import import rasterize_dxf
from test_wall_detector import plan


def png(image):
    stream=io.BytesIO(); image.save(stream,format='PNG'); return stream.getvalue()


class BlueprintImportTests(unittest.TestCase):
    def test_thumbnail_imports_with_explicit_review(self):
        result=import_blueprint(png(plan(220)),'small.png')
        self.assertTrue(result['success'])
        self.assertTrue(result['import_info']['reviewRequired'])
        self.assertTrue(result['preview_image'].startswith('data:image/png'))

    def test_faint_section_imports_as_reference_without_invented_rooms(self):
        image=Image.new('RGB',(400,300),'white');d=ImageDraw.Draw(image)
        d.line([(30,140),(160,30),(300,140),(300,250),(30,250),(30,140)],fill=(190,190,190),width=1)
        result=import_blueprint(png(image),'section.png')
        self.assertEqual(result['mode'],'reference')
        self.assertEqual(result['walls'],[])
        self.assertEqual(result['rooms'],[])
        self.assertTrue(result['import_info']['reviewRequired'])

    def test_invalid_and_blank_files_are_not_fake_imports(self):
        for data in [b'',b'not an image',png(Image.new('RGB',(300,300),'white'))]:
            with self.assertRaises(ValueError):import_blueprint(data,'invalid.png')
        with self.assertRaises(ValueError):import_blueprint(b'not a dxf','invalid.dxf')

    def test_nested_dxf_blocks_layers_and_crlf(self):
        doc=ezdxf.new('R2013');doc.units=0
        block=doc.blocks.new('WALL_MODULE')
        block.add_lwpolyline([(0,0),(120,0),(120,80),(0,80)],close=True,dxfattribs={'layer':'A-WALLS'})
        outer=doc.blocks.new('NESTED')
        outer.add_blockref('WALL_MODULE',(10,15),dxfattribs={'xscale':2,'yscale':2,'rotation':90})
        doc.modelspace().add_blockref('NESTED',(100,200))
        # Non-architectural geometry far away must not change the drawing extent.
        doc.modelspace().add_line((1e6,1e6),(1e6+100,1e6+200),dxfattribs={'layer':'DUCTS'})
        out=io.StringIO();doc.write(out)
        data=out.getvalue().replace('\n','\r\n').encode('utf8')
        image,info=rasterize_dxf(data)
        self.assertEqual(info['layers'],{'A-WALLS':1})
        self.assertGreater(image.shape[0],image.shape[1])
        result=import_blueprint(data,'nested.dxf')
        self.assertTrue(result['success'])
        self.assertTrue(result['import_info']['reviewRequired'])
        self.assertEqual(result['import_info']['method'],'dxf_architectural_layers')


if __name__=='__main__':unittest.main()

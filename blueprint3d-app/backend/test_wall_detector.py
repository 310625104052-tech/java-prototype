"""Regression tests for the active Blueprint3D backend; no private fixtures required.
Run: python -m unittest discover -s backend -p test_wall_detector.py -v
"""
import io
import unittest
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from wall_detector import detect_walls_from_image_bytes

def suite_with_open_hall():
    """Five actual doors, short WC pier, and a dashed open hall boundary."""
    im=Image.new('RGB',(900,700),'white')
    d=ImageDraw.Draw(im)
    d.rectangle((60,60,840,640),fill=(255,242,230))
    d.rectangle((60,60,380,300),fill=(190,190,255))
    ink=(178,178,178)
    for box in [(60,60,840,74),(60,626,840,640),(60,60,74,640),(826,60,840,640),
                (373,60,387,300),(213,60,227,300),(213,173,380,187),
                (60,293,380,307),(60,433,840,447),(373,440,387,640)]:
        d.rectangle(box,fill=ink)
    for box in [(209,80,231,150),(120,289,190,311),(280,289,360,311),
                (270,429,340,451),(430,429,500,451)]:
        d.rectangle(box,fill=(255,242,230))
    # A frame supplies evidence where the right hand jamb is just a short pier.
    for y in (294,306): d.line((280,y,360,y),fill=(55,55,55),width=1)
    for x in (214,226): d.line((x,80,x,150),fill=(55,55,55),width=1)
    for y in range(309,430,12): d.line((380,y,380,y+6),fill=(55,55,55),width=1)
    return im


def plan(width=900, wall=25, symbol=True, blocked=False, neutral_floor=False):
    image = Image.new('RGB', (900, 700), 'white')
    draw = ImageDraw.Draw(image)
    draw.rectangle((60, 60, 450, 640), fill=(255, 242, 230))
    draw.rectangle((450, 60, 840, 430), fill=(190, 190, 255))
    draw.rectangle((450, 430, 840, 640), fill=(240, 250, 240))
    if neutral_floor:
        draw.rectangle((60,60,840,640),fill=(160,160,160))
    ink = (wall, wall, wall)
    draw.rectangle((60, 60, 840, 640), outline=ink, width=14)
    draw.rectangle((444, 60, 458, 640), fill=ink)
    draw.rectangle((444, 423, 840, 437), fill=ink)
    if not blocked:
        draw.rectangle((440, 290, 462, 370), fill=(255, 242, 230))
        draw.rectangle((575, 419, 655, 441), fill=(240, 250, 240))
        if symbol:
            draw.line((451, 290, 531, 290), fill=(55,55,55), width=2)
            draw.arc((371, 210, 531, 370), 0, 90, fill=(55,55,55), width=2)
            draw.line((575, 430, 575, 510), fill=(55,55,55), width=2)
            draw.arc((495, 350, 655, 510), 0, 90, fill=(55,55,55), width=2)
    draw.rectangle((200, 56, 280, 78), fill='white')
    draw.line((200, 61, 280, 61), fill=(65,65,65), width=1)
    draw.line((200, 73, 280, 73), fill=(65,65,65), width=1)
    for x, y, text in [(170,230,'LIVING'),(600,200,'BEDROOM'),(600,550,'BATH')]:
        draw.text((x,y),text,fill=(40,40,40))
    return image.resize((width, round(700*width/900)), Image.Resampling.LANCZOS)


def detect(image):
    buf=io.BytesIO()
    image.save(buf,format='PNG')
    return detect_walls_from_image_bytes(buf.getvalue())


class DetectorTests(unittest.TestCase):
    def test_narrow_t_junction_gap_warns_without_widening(self):
        image=Image.new('RGB',(1200,950),'white')
        draw=ImageDraw.Draw(image)
        draw.rectangle((100,100,1100,800),outline=(20,20,20),width=10)
        for box in [(595,100,605,385),(595,475,605,800),
                    (600,445,785,455),(875,445,1100,455)]:
            draw.rectangle(box,fill=(20,20,20))
        result=detect(image)
        self.assertTrue(result['success'])
        self.assertTrue(any(o['type']=='door' and o['width']<22 for o in result['openings']))
        self.assertTrue(any('too narrow for walking' in w for w in result['import_info']['warnings']))

    def test_thin_partitions_survive_thick_exterior_and_pale_symbols(self):
        image=Image.new('RGB',(900,700),'white')
        d=ImageDraw.Draw(image)
        d.rectangle((60,60,840,640),outline=(20,20,20),width=24)
        for box in [(447,75,453,625),(450,427,825,433)]:
            d.rectangle(box,fill=(20,20,20))
        for box in [(444,290,456,370),(575,424,655,436)]:
            d.rectangle(box,fill='white')
        d.line((450,290,530,290),fill=(175,175,175),width=1)
        d.line((575,430,575,510),fill=(175,175,175),width=1)
        d.rectangle((150,160,300,230),outline=(170,170,170),width=2)
        result=detect(image)
        self.assertTrue(result['success'],result.get('error'))
        self.assertEqual(len(result['rooms']),3)
        self.assertEqual(sum(o['type']=='door' for o in result['openings']),2)
        self.assertTrue(any('Thinner partitions' in w for w in result['import_info']['warnings']))

    def test_exterior_leaf_is_door_and_parallel_glazing_is_window(self):
        image = plan()
        draw = ImageDraw.Draw(image)
        draw.rectangle((200,622,280,645),fill='white')
        draw.line((200,560,200,640),fill=(55,55,55),width=2)
        draw.arc((120,480,280,640),0,90,fill=(55,55,55),width=2)
        result = detect(image)
        self.assertTrue(result['success'], result.get('error'))
        exterior_doors = [o for o in result['openings'] if o['type']=='door' and o.get('exterior')]
        self.assertEqual(len(exterior_doors),1)
        self.assertTrue(any(o['type']=='window' and o['y']<90 for o in result['openings']))


    def check_plan(self,image):
        result=detect(image)
        self.assertTrue(result['success'],result.get('error'))
        self.assertEqual(sum(o['type']=='door' for o in result['openings']),2)
        self.assertEqual(sum(o['type']=='window' for o in result['openings']),1)
        self.assertEqual(len(result['rooms']),3)
        self.assertTrue(result['walls'])
        ids={w['id'] for w in result['walls']}
        for op in result['openings']:
            self.assertIn(op['wallId'],ids)
            self.assertGreater(op['width'],0)
            self.assertTrue(0<=op['x']<=result['image_width'])
            self.assertTrue(0<=op['y']<=result['image_height'])
        self.assertTrue(result['debug_layers']['openings_image'].startswith('data:image/png;base64,'))
        return result

    def test_black_gray_empty_and_symbol_doors(self):
        for tone in (25,150,178,200,220,230):
            for symbol in (False,True):
                with self.subTest(tone=tone,symbol=symbol):
                    self.check_plan(plan(wall=tone,symbol=symbol))

    def test_resolution_rotation_mirror_invert(self):
        images=[plan(600,178),plan(1500),plan().transpose(Image.Transpose.ROTATE_90),
                ImageOps.mirror(plan()),ImageOps.invert(plan())]
        for index,image in enumerate(images):
            with self.subTest(index=index): self.check_plan(image)

    def test_gray_floor_is_not_wall(self):
        self.check_plan(plan(neutral_floor=True))

    def test_open_hall_and_real_short_pier_door_positions(self):
        result=detect(suite_with_open_hall())
        self.assertTrue(result['success'],result.get('error'))
        doors=[o for o in result['openings'] if o['type']=='door']
        self.assertEqual(len(doors),5)
        self.assertEqual(len(result['rooms']),6)
        for x,y in [(220,115),(155,300),(320,300),(305,440),(465,440)]:
            self.assertTrue(any(abs(o['x']-x)<20 and abs(o['y']-y)<20 for o in doors),(x,y))
        self.assertFalse(any(abs(o['x']-380)<20 and abs(o['y']-370)<40 for o in doors))

    def test_sealed_rooms_are_not_given_invented_doors(self):
        result=detect(plan(blocked=True))
        self.assertTrue(result['success'])
        self.assertFalse(any(o['type']=='door' for o in result['openings']))
        self.assertTrue(any('connected' in w for w in result['import_info']['warnings']))

    def test_unreadable_inputs_fail_instead_of_empty_success(self):
        outline=Image.new('RGB',(900,700),'white')
        ImageDraw.Draw(outline).rectangle((60,60,840,640),outline='black',width=1)
        tiny=detect(plan(220))
        self.assertTrue(tiny['success'])
        self.assertTrue(tiny['import_info']['warnings'])
        self.assertFalse(detect(Image.new('RGB',(900,700),'white'))['success'])
        for data in [b'',b'not an image']:
            self.assertFalse(detect_walls_from_image_bytes(data)['success'])





if __name__=='__main__':
    unittest.main()


"""Public synthetic fixtures; no private user drawings are required."""
import io
import unittest
import numpy as np
from PIL import Image, ImageDraw, ImageOps, ImageFilter
from blueprint_import import import_blueprint


def mixed_plan(tone=20, partition=7, floor=(255,255,255)):
    image=Image.new('RGB',(900,700),'white')
    draw=ImageDraw.Draw(image)
    draw.rectangle((60,60,840,640),fill=floor,outline=(tone,)*3,width=24)
    half=partition//2
    for box in [(450-half,75,450+half,625),(450,430-half,825,430+half)]:
        draw.rectangle(box,fill=(tone,)*3)
    for box in [(440,290,460,370),(575,420,655,440)]:
        draw.rectangle(box,fill=floor)
    draw.line((450,290,530,290),fill=(175,)*3,width=1)
    draw.line((575,430,575,510),fill=(175,)*3,width=1)
    draw.rectangle((150,160,300,230),outline=(170,)*3,width=2)
    draw.text((150,300),'LIVING',fill=(40,)*3)
    return image


class BlueprintVarietyTests(unittest.TestCase):
    def check_layout(self, image, encoding='PNG'):
        data=io.BytesIO()
        image.save(data,format=encoding)
        result=import_blueprint(data.getvalue(),'plan.'+('jpg' if encoding=='JPEG' else 'png'))
        self.assertEqual(result['mode'],'model',result['import_info'])
        self.assertEqual(len(result['rooms']),3)
        self.assertEqual(sum(o['type']=='door' for o in result['openings']),2)
        self.assertTrue(result['shell']['footprint'])
        self.assertTrue(result['import_info']['reviewRequired'])

    def test_mixed_width_colors_and_resolutions(self):
        for tone in (20,150,200,230):
            for size in (450,600,900,1500):
                with self.subTest(tone=tone,size=size):
                    self.check_layout(mixed_plan(tone).resize((size,round(700*size/900)),Image.Resampling.LANCZOS))

    def test_mixed_width_rotations(self):
        for width in (5,7,11,15):
            for angle in (0,90,180,270):
                with self.subTest(width=width,angle=angle):
                    self.check_layout(mixed_plan(partition=width).rotate(angle,expand=True))

    def test_backgrounds_and_scan_formats(self):
        images=[ImageOps.mirror(mixed_plan()),ImageOps.invert(mixed_plan()),
                mixed_plan(floor=(255,242,230)),mixed_plan(floor=(210,225,255))]
        for noise in (3,8):
            array=np.asarray(mixed_plan()).astype(float)
            array+=np.random.default_rng(42).normal(0,noise,array.shape[:2])[...,None]
            images.append(Image.fromarray(np.clip(array,0,255).astype(np.uint8)))
        for blur in (.4,.8):images.append(mixed_plan().filter(ImageFilter.GaussianBlur(blur)))
        for index,image in enumerate(images):
            with self.subTest(index=index):self.check_layout(image)
        for tone in (20,150,230):
            with self.subTest(jpeg_tone=tone):self.check_layout(mixed_plan(tone),'JPEG')

    def test_skew_and_paired_outlines_require_review(self):
        outline=Image.new('RGB',(900,700),'white')
        draw=ImageDraw.Draw(outline)
        for box in [(60,60,840,640),(450,60,460,640),(450,420,840,430)]:
            draw.rectangle(box,outline='black',width=2)
        images=[mixed_plan().rotate(angle,expand=True,fillcolor='white') for angle in (15,35)]
        images.append(outline)
        for index,image in enumerate(images):
            with self.subTest(index=index):
                data=io.BytesIO();image.save(data,format='PNG')
                result=import_blueprint(data.getvalue(),'uncertain.png')
                self.assertTrue(result['success'])
                self.assertTrue(result['import_info']['reviewRequired'])
                self.assertTrue(result['import_info']['warnings'])


if __name__=='__main__':unittest.main()

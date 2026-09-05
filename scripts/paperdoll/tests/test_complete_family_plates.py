import sys,tempfile,unittest,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from complete_family_plates import render,geometry,check_source,inside

class CompletePlatesTests(unittest.TestCase):
 def bottle(self,cap_top):
  im=Image.new('RGB',(300,500),'white');d=ImageDraw.Draw(im);d.rectangle((110,180,190,450),fill='#cccccc');d.rectangle((110,cap_top,190,179),fill='black');return im
 def test_cap_changes_keep_body_width_and_base(self):
  a,ta=render(self.bottle(70),180,950);b,tb=render(self.bottle(120),180,950)
  self.assertEqual(ta['outputGeometry']['bodyWidth'],tb['outputGeometry']['bodyWidth'])
  self.assertEqual(ta['outputGeometry']['base'],tb['outputGeometry']['base'])
  self.assertEqual(a.size,(1000,1100));self.assertEqual(b.size,a.size)
 def test_hanging_tassel_does_not_change_reviewed_body_base(self):
  im=Image.new('RGB',(300,500),'white');d=ImageDraw.Draw(im)
  d.rectangle((210,100,280,420),fill='#bbbbbb');d.rectangle((30,370,130,470),fill='black')
  region=[.65,0,1,1]
  self.assertEqual(geometry(im,region)['base'],420)
  self.assertEqual(geometry(im)['base'],470)
  output,t=render(im,160,800,780,region)
  self.assertLessEqual(abs(t['outputGeometry']['bodyCenter']-780),2)
  self.assertGreater(t['outputGeometry']['box'][3],t['outputGeometry']['base'])
  self.assertGreaterEqual(t['outputGeometry']['box'][0],30)
  self.assertLessEqual(t['outputGeometry']['box'][3],1070)
 def test_refuses_clipped_product(self):
  with self.assertRaisesRegex(ValueError,'clipped'):render(self.bottle(70),600,950)
 def test_blank_image_rejected(self):
  with self.assertRaisesRegex(ValueError,'Blank'):geometry(Image.new('RGB',(100,100),'white'))
 def test_symlink_cannot_escape_source_root(self):
  with tempfile.TemporaryDirectory() as td:
   base=Path(td);root=base/'source';root.mkdir();other=base/'other';other.write_bytes(b'x');(root/'link').symlink_to(other)
   with self.assertRaises(ValueError):inside(root/'link',root)
 def test_legacy_requires_exact_identity_link_hash_and_assembled_review(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);(root/'evidence').mkdir();(root/'sources/legacy').mkdir(parents=True)
   p=root/'evidence/page.html';p.write_text('<strong>SKU-A</strong><img src="https://www.bestbottles.com/images/store/A.png">')
   image=root/'sources/legacy/A.png';Image.new('RGB',(10,10),'red').save(image)
   sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
   row={'websiteSku':'SKU-A','evidence':{'returnedSku':'SKU-A','file':str(p),'sha256':sha(p),'url':'https://www.bestbottles.com/product/a'},'source':{'kind':'legacy','path':str(image),'url':'https://www.bestbottles.com/images/store/A.png','sha256':sha(image),'view':'assembled','reviewedBy':'reviewer'}}
   self.assertEqual(check_source(row,root),image.resolve())
   row['source']['url']='https://www.bestbottles.com/images/store/B.png'
   with self.assertRaisesRegex(ValueError,'not linked'):check_source(row,root)
   row['source']['url']='https://www.bestbottles.com/images/store/A.png';row['evidence']['returnedSku']='SKU-B'
   with self.assertRaisesRegex(ValueError,'differs'):check_source(row,root)
   row['evidence']['returnedSku']='SKU-A';row['source']['view']='cap-off'
   with self.assertRaisesRegex(ValueError,'reviewed'):check_source(row,root)
   row['source']['view']='assembled';image.write_bytes(b'changed')
   with self.assertRaisesRegex(ValueError,'bytes changed'):check_source(row,root)

if __name__=='__main__':unittest.main()

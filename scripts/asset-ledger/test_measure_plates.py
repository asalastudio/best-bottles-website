import importlib.util, tempfile, unittest, io, hashlib, os
from unittest.mock import patch
from PIL import Image
spec=importlib.util.spec_from_file_location('measure_plates',os.path.join(os.path.dirname(__file__),'measure-plates.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MeasurementEvidenceTests(unittest.TestCase):
 def image(self,color):
  data=io.BytesIO();Image.new('RGB',(10,10),color).save(data,format='PNG');return data.getvalue()
 def test_new_bytes_are_measured_instead_of_sku_cache(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(m,'CACHE',tmp):
   a,b=self.image('red'),self.image('blue');p={'sku':'opaque-id','image':'https://example.test/image'}
   with patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(a)):self.assertTrue(m.fetch(p))
   before=p['cachePath']
   with patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(b)):self.assertTrue(m.fetch(p))
   self.assertNotEqual(before,p['cachePath']);self.assertEqual(p['imageSha256'],hashlib.sha256(b).hexdigest())
   with patch.object(m.urllib.request,'urlopen',side_effect=OSError('offline')):self.assertFalse(m.fetch(p))
   self.assertNotIn('cachePath',p)
 def test_declared_hash_mismatch_is_rejected(self):
  p={'sku':'opaque-id','image':'https://example.test/'+('a'*64)+'.webp'}
  with patch.object(m.urllib.request,'urlopen',return_value=io.BytesIO(self.image('red'))):self.assertFalse(m.fetch(p))
  self.assertNotIn('cachePath',p)
 def test_cohort_uses_catalog_identity_only(self):
  self.assertEqual(m.bottle_key('GBTallMisleading','ignored',{'productGroupId':'physical-profile-A'}),'physical-profile-A')
  self.assertIsNone(m.bottle_key('GBLooksLikeBottle','family-10ml-clear-13-415'))
if __name__=='__main__':unittest.main()

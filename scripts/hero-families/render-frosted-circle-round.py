#!/usr/bin/env python3
"""Render prepared exact-SKU frost inputs through the existing Sunburst helper.
No credentials are stored; no publishing or registry mutation is performed.
Default mode is validation only. --execute requires explicit batch authorization.
"""
import argparse, hashlib, importlib.util, json, os, struct, time
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', default='output/imagegen/frosted-circle-round-family/manifest.json')
    ap.add_argument('--sku', action='append')
    ap.add_argument('--execute', action='store_true')
    args = ap.parse_args()
    manifest = Path(args.manifest).resolve()
    data = json.loads(manifest.read_text())
    selected = [r for r in data['rows'] if not args.sku or r['sku'] in args.sku]
    assert selected, 'No matching SKUs'
    for r in selected:
        assert digest(r['masterSource']) == r['masterSha256'], r['sku']
        for key, expected in r['inputSha256'].items():
            assert digest(r[key]) == expected, (r['sku'], key)
    if not args.execute:
        print(json.dumps({'validated': len(selected), 'model': data['model'], 'size': data['requestedSize'], 'quality': data['quality'], 'apiCalls': 0}))
        return
    if not os.environ.get('OPENAI_API_KEY'):
        raise SystemExit('OPENAI_API_KEY is not configured')
    helper = Path(__file__).resolve().parents[1] / 'hero-empire/sunburst.py'
    spec = importlib.util.spec_from_file_location('existing_sunburst_renderer', helper)
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    for r in selected:
        out = Path(r['rawOutput'])
        record = out.with_suffix('.render.json')
        if out.exists():
            if not record.exists():
                raise SystemExit(f'{r["sku"]}: existing output has no render record; inspect before retrying')
            saved = json.loads(record.read_text())
            assert saved['outputSha256'] == digest(out)
            assert saved['inputSha256'] == r['inputSha256']
            print(f'{r["sku"]}: preserved existing render', flush=True)
            continue
        print(f'{r["sku"]}: rendering native 2080x2288', flush=True)
        started = time.time()
        image_inputs = r.get('imageInputs') or [r['framedInput'], r['masterComposite'], r['materialReference']]
        api.edit(Path(r['promptFile']).read_text(), image_inputs, str(out), mask=r.get('maskFile'), size='2080x2288', quality='high')
        raw = out.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'Output is not PNG'
        dimensions = list(struct.unpack('>II', raw[16:24]))
        result = {'sku': r['sku'], 'model': data['model'], 'requestedSize': [2080, 2288], 'nativeSize': dimensions, 'elapsedSeconds': round(time.time()-started, 1), 'inputSha256': r['inputSha256'], 'masterSha256': r['masterSha256'], 'outputSha256': digest(out), 'status': 'rendered-needs-geometry-and-material-review' if dimensions == [2080,2288] else 'held-native-resolution-mismatch'}
        result['backgroundStandard'] = {'hex': api.BACKGROUND_STANDARD['hex'], 'colorSpace': api.BACKGROUND_STANDARD['colorSpace'], 'sha256': digest(api.BACKGROUND_STANDARD_PATH), 'pixelReview': 'required-not-yet-performed'}
        result['effectivePromptSha256'] = hashlib.sha256(api.generation_prompt(Path(r['promptFile']).read_text()).encode()).hexdigest()
        record.write_text(json.dumps(result, indent=2)+'\n')
        print(json.dumps(result | {'inputSha256': 'recorded'}), flush=True)
        if dimensions != [2080, 2288]:
            raise SystemExit('Native dimensions differ from request. Stop batch and inspect; do not substitute resampled previews.')


if __name__ == '__main__':
    main()

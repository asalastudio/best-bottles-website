// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import PdpStage, { type PdpStageProps } from '@/components/pdp/PdpStage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const original = 'https://cdn.shopify.com/s/files/1/product.png';
const backup = 'https://images.example.test/exact-sku.webp';
const props: PdpStageProps = {
    pickLine: 'Clear · Short Cap', view: 'sidecar', availableViews: ['sidecar'], onViewChange: () => {},
    kit: null, context: {}, fallbackImageUrls: [original, backup], fallbackBodyImageUrl: null,
    fallbackAlt: 'Exact SKU bottle', callouts: [], caps: [], activeCapId: null, onCapPick: () => {},
    glasses: [], onGlassPick: () => {}, activeCapName: null, activeGlassLabel: 'Clear',
};
beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {configurable: true,
        value: () => ({matches: false, addEventListener: () => {}, removeEventListener: () => {}})});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const photo = () => container.querySelector<HTMLImageElement>('img[alt="Exact SKU bottle"]');
const fail = async () => { expect(photo()).not.toBeNull(); await act(async () => { photo()!.dispatchEvent(new Event('error')); }); };

it('tries the original Shopify image before discarding it when the optimizer fails', async () => {
    await act(async () => root.render(createElement(PdpStage, props)));
    expect(photo()?.getAttribute('src')).toContain('/_next/image?');
    await fail();
    expect(photo()?.getAttribute('src')).toBe(original);
    await fail();
    expect(photo()?.getAttribute('src')).toBe(backup);
    await fail();
    expect(photo()).toBeNull();
    expect(container.textContent).toContain('Photography coming soon');
});

it('advances a failed direct source without retrying identical bytes forever', async () => {
    await act(async () => root.render(createElement(PdpStage, {...props, fallbackImageUrls: [backup]})));
    expect(photo()?.getAttribute('src')).toBe(backup);
    await fail();
    expect(photo()).toBeNull();
});

it('keeps recovery scoped to the failing exact URL when the selected SKU changes', async () => {
    await act(async () => root.render(createElement(PdpStage, props)));
    await fail();
    const nextSku = 'https://cdn.shopify.com/s/files/1/other-exact-sku.png';
    await act(async () => root.render(createElement(PdpStage, {...props, fallbackImageUrls: [nextSku]})));
    expect(photo()?.getAttribute('src')).toContain(encodeURIComponent(nextSku));
    await fail();
    expect(photo()?.getAttribute('src')).toBe(nextSku);
});

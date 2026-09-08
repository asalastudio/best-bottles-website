// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import MobileBuilder from "@/components/bottle-builder/MobileBuilder";
import { deriveBuilder, emptySelection, reconcileSelection, builderOrder, type BuilderBody, type BuilderConfiguration } from "@/lib/bottle-builder/model";
vi.mock("@/components/bottle-builder/BuilderImage", () => ({ default: ({ label }: { label: string }) => <span role="img" aria-label={label} /> }));
vi.mock("@/components/bottle-builder/BuilderFinishImage", () => ({ default: () => <span>Finish photo</span> }));
vi.mock("@/components/bottle-builder/FitmentIllustration", () => ({ default: ({ fitment }: { fitment: string }) => <span>{fitment} drawing</span> }));
const config = (bodyId: string, color: string, fitment: string, closure: string) => ({ id: [bodyId,color,fitment,closure].join('-'), bodyId, color, fitment, closure, family: "Cylinder", capacityMl: 9, neck: "13-415", profileLabel: "Cylinder", kit: null, bodyImage: null, photoUrl: null, finishComponent: { websiteSku: "test", imageUrl: null, name: closure }, caseQuantity: 24, product: { graceSku: [bodyId,color,fitment,closure].join('-'), webPrice1pc: .82, shopifyVariantId: "1", shopifySellable: true } } as BuilderConfiguration);
const bodies: BuilderBody[] = [
 {id:'a',family:'Cylinder',capacityMl:9,neck:'13-415',profileLabel:'Cylinder',configurations:['Clear','Frosted'].flatMap(c=>[config('a',c,'Metal Roller','Gold'),config('a',c,'Metal Roller','Silver'),config('a',c,'Sprayer','Black')])},
 {id:'b',family:'Cylinder',capacityMl:9,neck:'17-415',profileLabel:'Cylinder',configurations:[config('b','Clear','Pump','White')]},
];
let root: Root, container: HTMLDivElement;
const add = vi.fn();
function Harness() {
 const [selection,setSelection]=useState(emptySelection());const [stage,setStage]=useState(0);
 return <MobileBuilder families={[{family:'Cylinder',groups:2}]} family="Cylinder" bodies={bodies} selection={selection} current={deriveBuilder(bodies,selection)} order={builderOrder(deriveBuilder(bodies,selection).configuration,selection.quantity,[])} stage={stage} onStage={setStage} onUpdate={patch=>setSelection(s=>reconcileSelection(bodies,{...s,...patch}))} onReset={()=>{setSelection(emptySelection());setStage(0)}} onFamily={()=>{}} onAdd={add} size="" neck="" application="" onFilter={()=>{}} pending={false} adding={false} hydrated error="" lastAdded={null} cartProgress={{subtotal:0,remaining:50,met:false}} hasIncludedCover={false} showCover={false} onCover={()=>{}} chooserScale={()=>1} />;
}
const click = (el: Element | null) => act(()=>{ if(!el)throw Error('Missing control');(el as HTMLElement).click(); });
const choose=(label:string)=>click(container.querySelector(`input[aria-label="${label}"]`));
const button=(text:string)=>click([...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)??null);
const stage=()=>container.querySelector('[data-stage]')?.getAttribute('data-stage');
beforeEach(async()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',(cb:()=>void)=>{cb();return 0});window.scrollTo=vi.fn();add.mockReset();container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<Harness/>));});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals()});
function toFinish(){choose('9 ml, 13-415 neck');button('Continue to glass');choose('Clear');button('Continue to fitment');choose('Metal Roller');button('Continue to finish');}
describe('mobile presentation over shared configuration',()=>{
 it('requires explicit advancement and does not render an empty action bar',()=>{
  expect(container.textContent).not.toContain('Continue to glass');choose('9 ml, 13-415 neck');expect(stage()).toBe('0');button('Continue to glass');expect(stage()).toBe('1');choose('Clear');expect(stage()).toBe('1');button('Continue to fitment');expect(stage()).toBe('2');choose('Metal Roller');expect(stage()).toBe('2');button('Continue to finish');expect(stage()).toBe('3');choose('Gold');expect(stage()).toBe('3');button('Review bottle');expect(stage()).toBe('4');
 });
 it('preserves valid downstream choices when editing glass',()=>{
  toFinish();choose('Gold');button('Review bottle');click(container.querySelector('button[aria-label="Edit glass"]'));choose('Frosted');button('Continue to fitment');expect((container.querySelector('input[aria-label="Metal Roller"]') as HTMLInputElement).checked).toBe(true);button('Continue to finish');expect((container.querySelector('input[aria-label="Gold"]') as HTMLInputElement).checked).toBe(true);
 });
 it('explains invalid dependencies while preserving quantity and requiring reselection',()=>{
  toFinish();choose('Gold');button('Review bottle');button('Use case quantity');click(container.querySelector('button[aria-label="Edit bottle"]'));choose('9 ml, 17-415 neck');expect(container.textContent).toContain('Choose a compatible fitment');button('Continue to glass');expect((container.querySelector('input[aria-label="Clear"]') as HTMLInputElement).checked).toBe(true);button('Continue to fitment');choose('Pump');button('Continue to finish');expect((container.querySelector('input[aria-label="White"]') as HTMLInputElement).checked).toBe(true);button('Review bottle');expect((container.querySelector('input[type=number]') as HTMLInputElement).value).toBe('24');
 });
 it('allows a valid build below the cart minimum through the existing add callback',()=>{
  toFinish();choose('Silver');button('Review bottle');expect(container.textContent).toContain('Add to cart · $9.84');button('Add to cart · $9.84');expect(add).toHaveBeenCalledOnce();
 });
 it('submits only once for repeated taps before the pending render',async()=>{
  let finish!:()=>void;add.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve}));
  toFinish();choose('Gold');button('Review bottle');button('Add to cart · $9.84');button('Add to cart · $9.84');expect(add).toHaveBeenCalledOnce();await act(async()=>finish());
 });
 it('keeps the selected drawings at fitment and resets only the draft',()=>{
  toFinish();button('Back');expect(container.textContent).toContain('Metal Roller drawing');button('Start over');expect(stage()).toBe('0');expect(add).not.toHaveBeenCalled();expect(container.querySelector('input:checked')).toBeNull();
 });
});

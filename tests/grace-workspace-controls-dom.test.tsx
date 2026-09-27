// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceShell from "@/components/grace-workspace/WorkspaceShell";
import type { RailFamily } from "@/lib/grace/workspaceRailTypes";
const mocks=vi.hoisted(()=>({push:vi.fn(),end:vi.fn(),close:vi.fn(),reset:vi.fn()}));
vi.mock("@/lib/observability/report",()=>({reportError:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push})}));
vi.mock("next/link",()=>({default:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}));
vi.mock("@/lib/clerk",()=>({CLERK_ENABLED:false}));
vi.mock("convex/react",()=>({useQuery:()=>null}));
vi.mock("@/components/CartProvider",()=>({useCart:()=>({items:[],itemCount:0,isCartHydrated:true})}));
vi.mock("@/components/useGrace",()=>({useGrace:()=>({conversationActive:true,endConversation:mocks.end,closePanel:mocks.close})}));
const families:RailFamily[]=[{family:"Rectangle",variantCount:63,images:[{url:"/rectangle-editorial.png",kind:"editorial"},{url:"/rectangle-product.png",kind:"product"}]}];
let root:Root;let container:HTMLDivElement;
function button(label:string){return [...container.querySelectorAll("button")].find(el=>el.getAttribute("aria-label")===label||el.textContent?.trim()===label)!;}
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(){await act(async()=>root.render(<WorkspaceShell families={families} onNewConversation={mocks.reset}><p>Conversation stays here</p></WorkspaceShell>));}
describe("full-screen Grace controls",()=>{
    it("closes to the store, stops voice, and preserves the conversation",async()=>{
        await render();await act(async()=>button("Close Grace").click());
        expect(mocks.end).toHaveBeenCalledOnce();expect(mocks.close).toHaveBeenCalledOnce();expect(mocks.push).toHaveBeenCalledWith("/");expect(mocks.reset).not.toHaveBeenCalled();
    });
    it("closes the family menu first on Escape, then exits Grace",async()=>{
        await render();await act(async()=>button("Browse by family").click());
        expect(container.querySelector("aside")?.getAttribute("data-open")).toBe("true");
        await act(async()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})));
        expect(mocks.end).not.toHaveBeenCalled();expect(document.activeElement).toBe(button("Browse by family"));
        await act(async()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"})));
        expect(mocks.end).toHaveBeenCalledOnce();expect(mocks.push).toHaveBeenCalledWith("/");
    });
    it("uses another image from the same family when a thumbnail fails",async()=>{
        await render();const img=container.querySelector('img[alt="Rectangle products"]')!;
        await act(async()=>img.dispatchEvent(new Event("error")));
        expect(img.getAttribute("src")).toBe("/rectangle-product.png");expect(img.className).toContain("object-contain");
        expect(container.querySelector('a[href="/catalog?families=Rectangle"]')).not.toBeNull();
    });
    it("reviews the cart inside Grace and closes only the cart on Escape",async()=>{
        await render();await act(async()=>button("Open cart, 0 products, 0 pieces").click());
        expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Your cart");
        expect(mocks.push).not.toHaveBeenCalled();
        await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
        expect(mocks.end).not.toHaveBeenCalled();expect(mocks.push).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
});

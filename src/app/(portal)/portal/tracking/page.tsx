export const dynamic = "force-dynamic";
import { PageHeader, PortalButton, PortalTag } from "@/components/portal/ui";

const ACTIVE_STEP = 3;

const steps = [
    { label: "Order Received", timestamp: "Feb 24 · 9:14 am" },
    { label: "Processing", timestamp: "Feb 24 · 2:30 pm" },
    { label: "Picked & Packed", timestamp: "Feb 25 · 8:00 am" },
    { label: "Shipped", timestamp: "Feb 25 · In transit via FedEx" },
    { label: "Delivered", timestamp: "Estimated March 4, 2026" },
] as const;

const shipmentInfo = [
    ["Carrier", "FedEx Ground"],
    ["Tracking No.", "794 622 836 420"],
    ["Ship From", "Oakland, CA"],
    ["Ship To", "Chicago, IL"],
    ["Weight", "43.2 lbs"],
    ["Cartons", "4 boxes"],
] as const;

export default function PortalTracking() {
    return (
        <div className="px-6 py-6 max-w-[1200px]">
            <PageHeader eyebrow="Live Tracking" title="Order ORD-9841" />

            <div className="grid grid-cols-[1.5fr_1fr] gap-4">

                {/* Timeline */}
                <div className="bg-white rounded-lg border border-neutral-200">
                    <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
                        <div>
                            <p className="font-sans text-[13px] font-medium text-neutral-900">18-415 Frosted Elegant, 30ml</p>
                            <p className="font-sans text-[12px] text-neutral-400">Qty 500 · Est. arrival March 4, 2026</p>
                        </div>
                        <PortalTag variant="blue">In Transit</PortalTag>
                    </div>

                    <div className="px-5 py-5">
                        <div className="relative pl-7">
                            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-neutral-200" />
                            {steps.map((step, i) => {
                                const done = i <= ACTIVE_STEP;
                                const current = i === ACTIVE_STEP;
                                return (
                                    <div key={step.label} className={`relative flex flex-col gap-0.5 ${i < steps.length - 1 ? "mb-6" : ""}`}>
                                        <div className={`absolute -left-7 top-1 w-[10px] h-[10px] rounded-full border-2 z-10 ${
                                            done ? "bg-neutral-900 border-neutral-900" : "bg-white border-neutral-300"
                                        } ${current ? "ring-4 ring-neutral-900/10" : ""}`} />
                                        <p className={`font-sans text-[13px] ${done ? "text-neutral-900 font-medium" : "text-neutral-400"}`}>
                                            {step.label}
                                        </p>
                                        <p className="font-sans text-[12px] text-neutral-400">{step.timestamp}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-5 py-3.5 border-t border-neutral-200 flex gap-2">
                        <PortalButton size="sm">FedEx Details</PortalButton>
                        <PortalButton variant="outline" size="sm">Download Invoice</PortalButton>
                    </div>
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-4">
                    <div className="bg-white rounded-lg border border-neutral-200">
                        <div className="px-5 py-3 border-b border-neutral-200">
                            <h3 className="font-sans text-[13px] font-semibold text-neutral-900">Shipment Info</h3>
                        </div>
                        {shipmentInfo.map(([key, value], i) => (
                            <div
                                key={key}
                                className={`px-5 py-2.5 flex items-center justify-between ${
                                    i < shipmentInfo.length - 1 ? "border-b border-neutral-100" : ""
                                }`}
                            >
                                <span className="font-sans text-[12px] text-neutral-400">{key}</span>
                                <span className="font-sans text-[13px] text-neutral-900 font-medium">{value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-neutral-900 rounded-lg border border-neutral-800 px-5 py-5">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <p className="font-sans text-[11px] font-medium text-neutral-400 uppercase tracking-wide">Grace says</p>
                        </div>
                        <p className="font-sans text-[13px] text-neutral-300 leading-relaxed mb-4">
                            Your Frosted Elegant order typically arrives within 2 days of this milestone.
                            Based on your purchase cadence, you may want to place your Spring reorder
                            in about 45 days.
                        </p>
                        <PortalButton size="sm" className="bg-white text-neutral-900 border-white hover:bg-neutral-100">
                            Plan Reorder with Grace
                        </PortalButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

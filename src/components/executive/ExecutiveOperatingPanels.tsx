import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const funnel = [
    { label: "Leads", value: "312", height: "100%" },
    { label: "Qualified", value: "174", height: "78%" },
    { label: "Quoted", value: "91", height: "62%" },
    { label: "Samples", value: "58", height: "47%" },
    { label: "Purchase orders", value: "32", height: "35%" },
    { label: "Delivered", value: "27", height: "28%" },
];

const supplySignals = [
    { label: "Inventory within policy", value: 88, display: "88%", tone: "[&>div]:bg-emerald-400" },
    { label: "Supplier on-time delivery", value: 81, display: "81%", tone: "[&>div]:bg-amber-400" },
    { label: "Customer fill rate", value: 96, display: "96%", tone: "[&>div]:bg-emerald-400" },
    { label: "Slow-moving stock", value: 22, display: "$406k", tone: "[&>div]:bg-amber-400" },
    { label: "Decoration capacity", value: 91, display: "91%", tone: "[&>div]:bg-rose-400" },
];

const productFamilies = [
    { label: "Cylinder", revenue: "$428k", margin: "36%", value: 86 },
    { label: "Boston Round", revenue: "$362k", margin: "34%", value: 72 },
    { label: "Euro Dropper", revenue: "$287k", margin: "31%", value: 59 },
    { label: "Roller Bottles", revenue: "$241k", margin: "38%", value: 51 },
];

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <CardHeader className="flex-row items-start justify-between space-y-0 border-b border-zinc-800 p-4">
            <h2 className="font-serif text-base text-zinc-100">{title}</h2>
            <p className="text-right text-[9px] uppercase tracking-wider text-zinc-600">{subtitle}</p>
        </CardHeader>
    );
}

export function ExecutiveOperatingPanels() {
    return (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
            <Card id="sales" className="rounded-none border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-none xl:col-span-5">
                <PanelHeader title="Commercial funnel" subtitle="Lead → delivered · current quarter" />
                <CardContent className="p-4">
                    <div className="grid h-32 grid-cols-6 items-end gap-2" aria-label="Illustrative commercial funnel">
                        {funnel.map((stage) => (
                            <div key={stage.label} className="flex h-full min-w-0 flex-col justify-end">
                                <div className="border-t border-amber-300/80 bg-amber-300/35" style={{ height: stage.height }} />
                                <span className="mt-2 text-xs font-medium tabular-nums text-zinc-300">{stage.value}</span>
                                <span className="truncate text-[8px] text-zinc-600">{stage.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex justify-between border-t border-zinc-800 pt-3 text-[10px] text-zinc-500">
                        <span>Quote response 7.8h</span>
                        <span>Sample-to-order 41%</span>
                        <span>Forecast 96% of target</span>
                    </div>
                </CardContent>
            </Card>

            <Card id="inventory" className="rounded-none border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-none xl:col-span-4">
                <PanelHeader title="Inventory and supply health" subtitle="Exceptions first" />
                <CardContent className="space-y-3 p-4">
                    {supplySignals.map((signal) => (
                        <div key={signal.label} className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                            <span className="truncate text-[10px] text-zinc-500">{signal.label}</span>
                            <Progress value={signal.value} className={`h-1 rounded-none bg-zinc-800 ${signal.tone}`} />
                            <span className="text-right text-[10px] font-medium tabular-nums text-zinc-300">{signal.display}</span>
                        </div>
                    ))}
                    <div className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4 text-[9px] text-zinc-500">
                        <span>12 open POs</span><span>3 containers in transit</span><span>1 delayed</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-none border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-none xl:col-span-4">
                <PanelHeader title="Top product families" subtitle="Revenue · gross margin" />
                <CardContent className="space-y-3 p-4">
                    {productFamilies.map((family) => (
                        <div key={family.label} className="grid grid-cols-[5rem_minmax(0,1fr)_5rem] items-center gap-3">
                            <span className="truncate text-[10px] font-medium text-zinc-300">{family.label}</span>
                            <div className="h-3 bg-zinc-800">
                                <div className="h-full border-r border-amber-300 bg-amber-300/30" style={{ width: `${family.value}%` }} />
                            </div>
                            <span className="text-right text-[10px] tabular-nums text-zinc-400">{family.revenue} · {family.margin}</span>
                        </div>
                    ))}
                    <p className="border-t border-zinc-800 pt-3 text-[9px] text-zinc-600">View by closure, capacity, color, finish, decoration</p>
                </CardContent>
            </Card>

            <Card id="customers" className="rounded-none border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-none xl:col-span-4">
                <PanelHeader title="Customer account health" subtitle="Concentration · reorder risk" />
                <CardContent className="p-0">
                    <dl className="divide-y divide-zinc-800">
                        {[
                            ["Top 10 revenue concentration", "42%"],
                            ["Repeat-order rate", "67%"],
                            ["Customers inactive 90+ days", "18"],
                            ["Open support issues", "7"],
                            ["Largest at-risk account", "$92k"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-[10px]">
                                <dt className="text-zinc-500">{label}</dt><dd className="tabular-nums text-zinc-300">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </CardContent>
            </Card>

            <Card id="operations" className="rounded-none border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-none xl:col-span-4">
                <PanelHeader title="Operations and production" subtitle="Warehouse + decoration" />
                <CardContent className="p-0">
                    <dl className="divide-y divide-zinc-800">
                        {[
                            ["Orders waiting to ship", "38"],
                            ["Average fulfillment time", "1.8 days"],
                            ["Picking accuracy", "99.2%"],
                            ["Decoration jobs open", "24"],
                            ["Scrap / rework rate", "2.1%"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4 px-4 py-2.5 text-[10px]">
                                <dt className="text-zinc-500">{label}</dt><dd className="tabular-nums text-zinc-300">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}

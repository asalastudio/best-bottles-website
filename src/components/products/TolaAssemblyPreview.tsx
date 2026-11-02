import { tolaAssemblyLayout } from '@/lib/products/tola-applicator';

/** The same complete source photograph and size curve as the product page. */
export default function TolaAssemblyPreview({ title }: { title: string }) {
    const { canvas, frame, parts } = tolaAssemblyLayout();
    const viewport = [-frame.x / 100 * canvas.width / frame.scale, -frame.y / 100 * canvas.height / frame.scale,
        canvas.width / frame.scale, canvas.height / frame.scale].join(' ');
    return <svg className="absolute inset-0 h-full w-full" viewBox={viewport} role="img" aria-label={title}
        data-bb-fixed-assembly="GB6TPlGl" style={{ mixBlendMode: "multiply" }}>
        {parts.map(part => <image key={part.key} href={part.url} data-bb-assembly-source={part.url}
            x={part.box!.leftPct / 100 * canvas.width} y={part.box!.topPct / 100 * canvas.height}
            width={part.box!.widthPct / 100 * canvas.width} height={part.box!.heightPct / 100 * canvas.height}
            style={{ mixBlendMode: part.blendMode }} />)}
    </svg>;
}

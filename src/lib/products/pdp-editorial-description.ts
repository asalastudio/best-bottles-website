import { toPlainText, type PortableTextBlock } from "@portabletext/react";
import type { PdpBlock } from "@/components/PdpBlocks";
import { descriptionConflictsWithApplicators } from "@/lib/canonicalProduct";

/** Apply the catalog's existing application check to editorial descriptions too. */
export function reconcilePdpEditorialDescriptions(
    blocks: PdpBlock[],
    applicators: Array<string | null | undefined>,
    fallback: string | null,
): PdpBlock[] {
    return blocks.flatMap((block): PdpBlock[] => {
        if (block._type !== "pdpRichDescription") return [block];
        const text = toPlainText(block.body as PortableTextBlock[]);
        if (!descriptionConflictsWithApplicators(text, applicators)) return [block];
        if (!fallback || descriptionConflictsWithApplicators(fallback, applicators)) return [];
        return [{ ...block, body: [{
            _type: "block", _key: `${block._key}-resolved`, style: "normal", markDefs: [],
            children: [{ _type: "span", _key: "description", text: fallback, marks: [] }],
        }] }];
    });
}

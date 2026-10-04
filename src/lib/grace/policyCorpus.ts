/** Realtime policy lookup backed by the same approved FAQ contract as pages and fallback. */
import {
    FAQ_POLICY_ENTRIES, FAQ_POLICY_GAPS, FAQ_POLICY_GUIDANCE, FAQ_POLICY_SOURCE,
} from "../faqPolicy";

export type GracePolicySection = {
    topic: string;
    matches: string[];
    text: string;
    sourcePath: string;
    sourceUrl: string;
    sourceQuestion: string;
};

export const GRACE_POLICY_SECTIONS: GracePolicySection[] = FAQ_POLICY_ENTRIES.map((entry) => ({
    topic: entry.q,
    matches: entry.matches,
    text: entry.a,
    sourcePath: FAQ_POLICY_SOURCE.snapshotPath,
    sourceUrl: FAQ_POLICY_SOURCE.url,
    sourceQuestion: entry.sourceQuestion,
}));

export const GRACE_POLICY_GAPS = FAQ_POLICY_GAPS;

export function selectPolicySections(question: string): GracePolicySection[] {
    const q = question.toLowerCase();
    const hits = GRACE_POLICY_SECTIONS.filter((section) => section.matches.some((match) => q.includes(match)));
    return hits.length > 0 ? hits : GRACE_POLICY_SECTIONS;
}

export function buildPolicyToolResult(question: string) {
    return {
        found: true,
        question,
        verifiedOn: FAQ_POLICY_SOURCE.verifiedOn,
        authority: FAQ_POLICY_SOURCE.authority,
        sections: selectPolicySections(question).map((section) => ({
            topic: section.topic,
            policyText: section.text,
            source: section.sourceUrl,
            sourceQuestion: section.sourceQuestion,
        })),
        noPublishedPolicyFor: GRACE_POLICY_GAPS,
        guidance: FAQ_POLICY_GUIDANCE,
    };
}

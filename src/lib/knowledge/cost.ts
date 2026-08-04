export const KNOWLEDGE_RATE_CARD = {
    version: "2026-08-03",
    models: {
        "gpt-5.6-luna": { input: 0.20, cachedInput: 0.02, output: 1.20 },
        "gpt-5.6-terra": { input: 2.00, cachedInput: 0.20, output: 12.00 },
        "gpt-5.6-sol": { input: 5.00, cachedInput: 0.50, output: 30.00 },
        "gpt-realtime-2.1": {
            input: 4.00,
            cachedInput: 0.40,
            output: 24.00,
            audioInput: 32.00,
            audioOutput: 64.00,
        },
    },
    fileSearchCallUsd: 0.0025,
} as const;

export type KnowledgeBillableModel = keyof typeof KNOWLEDGE_RATE_CARD.models;

export type KnowledgeUsage = {
    model: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    audioInputTokens: number;
    audioOutputTokens: number;
    fileSearchCalls: number;
};

const perMillion = (tokens: number, rate: number): number => (Math.max(0, tokens) * rate) / 1_000_000;

export function estimateKnowledgeCost(usage: KnowledgeUsage): {
    rateCardVersion: string;
    estimatedCostUsd: number;
} {
    const rates = KNOWLEDGE_RATE_CARD.models[usage.model as KnowledgeBillableModel];
    if (!rates) throw new Error(`Missing knowledge rate card for model: ${usage.model}`);

    const cachedInputTokens = Math.min(Math.max(0, usage.cachedInputTokens), Math.max(0, usage.inputTokens));
    const uncachedInputTokens = Math.max(0, usage.inputTokens - cachedInputTokens);
    const audioInputRate = "audioInput" in rates ? rates.audioInput : 0;
    const audioOutputRate = "audioOutput" in rates ? rates.audioOutput : 0;
    const estimatedCostUsd =
        perMillion(uncachedInputTokens, rates.input)
        + perMillion(cachedInputTokens, rates.cachedInput)
        + perMillion(usage.outputTokens, rates.output)
        + perMillion(usage.audioInputTokens, audioInputRate)
        + perMillion(usage.audioOutputTokens, audioOutputRate)
        + Math.max(0, usage.fileSearchCalls) * KNOWLEDGE_RATE_CARD.fileSearchCallUsd;

    return {
        rateCardVersion: KNOWLEDGE_RATE_CARD.version,
        estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    };
}

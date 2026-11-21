/** Validation for help-center questions, shared by the API route and its tests. Mirrors convex/helpQuestions.ts. */
export const HELP_QUESTION_MAX_LENGTH = 1000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export type HelpQuestionInput = { question: string; wantsReply: boolean; email?: string; consent: boolean; pagePath?: string };

export function validateHelpQuestion(body: unknown): { ok: true; value: HelpQuestionInput } | { ok: false; error: string } {
    if (!body || typeof body !== "object") return { ok: false, error: "Please write a question." };
    const input = body as Record<string, unknown>;
    const question = typeof input.question === "string" ? input.question.trim().replace(/\s+/g, " ") : "";
    if (question.length < 3) return { ok: false, error: "Please write a question." };
    if (question.length > HELP_QUESTION_MAX_LENGTH) return { ok: false, error: "Please keep the question under 1,000 characters." };
    const wantsReply = input.wantsReply === true;
    const consent = input.consent === true;
    let email: string | undefined;
    if (wantsReply) {
        email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
        if (!EMAIL.test(email)) return { ok: false, error: "Please give an email address for the reply." };
        if (!consent) return { ok: false, error: "Please agree to us using your email for the reply." };
    }
    const pagePath = typeof input.pagePath === "string" && input.pagePath.startsWith("/") ? input.pagePath.slice(0, 200) : undefined;
    // Without a reply request the email is dropped, even if one was sent.
    return { ok: true, value: { question, wantsReply, consent: wantsReply && consent, ...(email ? { email } : {}), ...(pagePath ? { pagePath } : {}) } };
}

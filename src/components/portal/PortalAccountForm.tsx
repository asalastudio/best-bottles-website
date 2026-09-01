"use client";

import { useActionState } from "react";
import type { AccountFormState } from "@/app/team/portal-accounts/actions";
import type { ClerkOrgOption } from "@/lib/portal/accounts";

/**
 * Provision a wholesale account against a Clerk organization.
 *
 * The org is chosen from real Clerk data rather than typed: an `org_…` id is
 * unmemorable and a typo produces an account that silently belongs to nobody —
 * the customer would sign in and see an empty portal with no error anywhere.
 */

const labelClass =
    "block font-sans text-[11px] font-medium text-neutral-500 uppercase tracking-wide mb-1.5";
const fieldClass =
    "w-full h-9 px-3 font-sans text-sm text-neutral-900 bg-white border border-neutral-300 rounded-md " +
    "focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-300";

function thisMonth() {
    return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function PortalAccountForm({
    organizations,
    action,
    knownTiers,
    knownTerms,
}: {
    organizations: ClerkOrgOption[];
    action: (prev: AccountFormState, formData: FormData) => Promise<AccountFormState>;
    knownTiers: string[];
    knownTerms: string[];
}) {
    const [state, formAction, pending] = useActionState(action, { error: null, created: null });

    const available = organizations.filter((org) => !org.linked);

    return (
        <form action={formAction} className="bg-white rounded-lg border border-neutral-200 px-5 py-5">
            <h2 className="font-sans text-[14px] font-semibold text-neutral-900 mb-1">
                New wholesale account
            </h2>
            <p className="font-sans text-[13px] text-neutral-500 mb-5">
                Selecting an organization that already has an account updates it instead.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="clerkOrgId">Clerk organization</label>
                    <select id="clerkOrgId" name="clerkOrgId" required defaultValue="" className={fieldClass}>
                        <option value="" disabled>
                            {available.length > 0
                                ? "Select an organization"
                                : "Every organization already has an account"}
                        </option>
                        {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                                {org.name}{org.linked ? " — already onboarded" : ""}
                            </option>
                        ))}
                    </select>
                    <p className="font-sans text-[12px] text-neutral-400 mt-1.5">
                        The customer must have a Clerk organization before they can have a portal
                        account. Create it in Clerk first if it isn&rsquo;t listed.
                    </p>
                </div>

                <div>
                    <label className={labelClass} htmlFor="companyName">Company name</label>
                    <input id="companyName" name="companyName" required className={fieldClass} />
                </div>

                <div>
                    <label className={labelClass} htmlFor="accountNumber">Account number</label>
                    <input id="accountNumber" name="accountNumber" required placeholder="BB-1003" className={fieldClass} />
                </div>

                <div>
                    <label className={labelClass} htmlFor="tier">Pricing tier</label>
                    <input id="tier" name="tier" required list="known-tiers" className={fieldClass} />
                    <datalist id="known-tiers">
                        {knownTiers.map((tier) => <option key={tier} value={tier} />)}
                    </datalist>
                </div>

                <div>
                    <label className={labelClass} htmlFor="netTerms">Payment terms</label>
                    <input id="netTerms" name="netTerms" required list="known-terms" defaultValue="Net 30" className={fieldClass} />
                    <datalist id="known-terms">
                        {knownTerms.map((term) => <option key={term} value={term} />)}
                    </datalist>
                </div>

                <div>
                    <label className={labelClass} htmlFor="accountManager">Account manager</label>
                    <input id="accountManager" name="accountManager" required className={fieldClass} />
                </div>

                <div>
                    <label className={labelClass} htmlFor="memberSince">Member since</label>
                    <input id="memberSince" name="memberSince" required defaultValue={thisMonth()} className={fieldClass} />
                </div>

                <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="billingEmail">Billing email</label>
                    <input id="billingEmail" name="billingEmail" type="email" placeholder="ap@company.com" className={fieldClass} />
                    <p className="font-sans text-[12px] text-neutral-400 mt-1.5">
                        The address their Shopify customer record is keyed on. Without it, an approved
                        resale certificate has nowhere to write the tax exemption.
                    </p>
                </div>
            </div>

            {state.error && <p className="font-sans text-[13px] text-red-600 mt-4">{state.error}</p>}
            {state.created && (
                <p className="font-sans text-[13px] text-emerald-700 mt-4">
                    Saved {state.created}. They&rsquo;ll see the portal next time they sign in.
                </p>
            )}

            <button
                type="submit"
                disabled={pending}
                className="mt-5 inline-flex items-center justify-center h-9 px-4 font-sans text-sm font-medium rounded-md border bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 disabled:opacity-50"
            >
                {pending ? "Saving…" : "Save account"}
            </button>
        </form>
    );
}

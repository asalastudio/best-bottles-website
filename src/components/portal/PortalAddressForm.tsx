"use client";

import { useActionState, useState } from "react";
import { PortalButton } from "@/components/portal/ui";
import { US_STATES } from "@/lib/portal/usStates";
import { EMPTY_ADDRESS, ADDRESS_FIELD_LABELS, type PortalAddress, type AddressErrors } from "@/lib/portal/address";

export type AddressFormState = {
    ok: boolean;
    errors: AddressErrors;
    message: string | null;
};

const label = "block font-sans text-[12px] mb-1.5 text-[color:var(--color-text-secondary)]";
const field =
    "w-full h-9 px-3 font-sans text-[13px] rounded-md border outline-none " +
    "focus:border-[color:var(--color-text-secondary)]";
const fieldStyle = {
    borderColor: "var(--color-rule)",
    background: "var(--color-surface)",
    color: "var(--color-text-primary)",
} as const;

function Field({
    name,
    inputName,
    defaultValue,
    errors,
    required,
    autoComplete,
    placeholder,
    className,
}: {
    name: keyof PortalAddress;
    /** Defaults to `name`; the billing block namespaces its fields. */
    inputName?: string;
    defaultValue: string;
    errors: AddressErrors;
    required?: boolean;
    autoComplete?: string;
    placeholder?: string;
    className?: string;
}) {
    const key = inputName ?? name;
    const error = errors[name];
    return (
        <div className={className}>
            <label className={label} htmlFor={`addr-${key}`}>
                {ADDRESS_FIELD_LABELS[name]}
                {!required && <span className="text-[color:var(--color-text-muted)]"> (optional)</span>}
            </label>
            <input
                id={`addr-${key}`}
                name={key}
                defaultValue={defaultValue}
                autoComplete={autoComplete}
                placeholder={placeholder}
                className={field}
                style={error ? { ...fieldStyle, borderColor: "var(--color-status-warning-text)" } : fieldStyle}
            />
            {error && (
                <p className="font-sans text-[12px] mt-1" style={{ color: "var(--color-status-warning-text)" }}>
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * Where this account's orders ship.
 *
 * Collected here rather than at submit time because it is account-level truth,
 * not per-order truth: a wholesale buyer ships to the same dock every time, and
 * asking again on each order would be a tax on the common case. Submission is
 * gated on it instead — an order with no address cannot be rated, taxed, or
 * fulfilled, so the portal refuses to send one rather than creating paperwork
 * nobody can act on.
 */
export default function PortalAddressForm({
    shippingAddress,
    billingAddress,
    action,
}: {
    shippingAddress: PortalAddress | null;
    billingAddress: PortalAddress | null;
    action: (prev: AddressFormState, formData: FormData) => Promise<AddressFormState>;
}) {
    const [state, formAction, pending] = useActionState(action, {
        ok: false,
        errors: {},
        message: null,
    });
    const [separateBilling, setSeparateBilling] = useState(billingAddress !== null);

    const ship = shippingAddress ?? EMPTY_ADDRESS;
    const bill = billingAddress ?? EMPTY_ADDRESS;

    return (
        <form
            action={formAction}
            className="rounded-lg border px-5 py-5"
            style={{ borderColor: "var(--color-rule)", background: "var(--color-surface)" }}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field name="contactName" defaultValue={ship.contactName} errors={state.errors} required autoComplete="name" />
                <Field name="phone" defaultValue={ship.phone} errors={state.errors} required autoComplete="tel" placeholder="(510) 555-0142" />
                <Field name="company" defaultValue={ship.company} errors={state.errors} autoComplete="organization" className="sm:col-span-2" />
                <Field name="address1" defaultValue={ship.address1} errors={state.errors} required autoComplete="address-line1" className="sm:col-span-2" />
                <Field name="address2" defaultValue={ship.address2} errors={state.errors} autoComplete="address-line2" className="sm:col-span-2" />
                <Field name="city" defaultValue={ship.city} errors={state.errors} required autoComplete="address-level2" />

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={label} htmlFor="addr-provinceCode">State</label>
                        <select
                            id="addr-provinceCode"
                            name="provinceCode"
                            defaultValue={ship.provinceCode}
                            className={field}
                            style={
                                state.errors.provinceCode
                                    ? { ...fieldStyle, borderColor: "var(--color-status-warning-text)" }
                                    : fieldStyle
                            }
                        >
                            <option value="">Select</option>
                            {US_STATES.map(([code, name]) => (
                                <option key={code} value={code}>{name}</option>
                            ))}
                        </select>
                        {state.errors.provinceCode && (
                            <p className="font-sans text-[12px] mt-1" style={{ color: "var(--color-status-warning-text)" }}>
                                {state.errors.provinceCode}
                            </p>
                        )}
                    </div>
                    <Field name="zip" defaultValue={ship.zip} errors={state.errors} required autoComplete="postal-code" placeholder="94587" />
                </div>
            </div>

            <input type="hidden" name="countryCode" value="US" />

            <label className="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                    type="checkbox"
                    name="separateBilling"
                    checked={separateBilling}
                    onChange={(e) => setSeparateBilling(e.target.checked)}
                />
                <span className="font-sans text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                    Bill to a different address
                </span>
            </label>

            {separateBilling && (
                <div
                    className="grid gap-4 sm:grid-cols-2 mt-4 pt-4"
                    style={{ borderTop: "1px solid var(--color-rule)" }}
                >
                    <p className="sm:col-span-2 font-sans text-[12px] uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                        Billing address
                    </p>
                    <Field name="contactName" inputName="billing_contactName" defaultValue={bill.contactName} errors={{}} required />
                    <Field name="phone" inputName="billing_phone" defaultValue={bill.phone} errors={{}} required />
                    <Field name="company" inputName="billing_company" defaultValue={bill.company} errors={{}} className="sm:col-span-2" />
                    <Field name="address1" inputName="billing_address1" defaultValue={bill.address1} errors={{}} required className="sm:col-span-2" />
                    <Field name="address2" inputName="billing_address2" defaultValue={bill.address2} errors={{}} className="sm:col-span-2" />
                    <Field name="city" inputName="billing_city" defaultValue={bill.city} errors={{}} required />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={label} htmlFor="addr-billing_provinceCode">State</label>
                            <select
                                id="addr-billing_provinceCode"
                                name="billing_provinceCode"
                                defaultValue={bill.provinceCode}
                                className={field}
                                style={fieldStyle}
                            >
                                <option value="">Select</option>
                                {US_STATES.map(([code, name]) => (
                                    <option key={code} value={code}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <Field name="zip" inputName="billing_zip" defaultValue={bill.zip} errors={{}} required />
                    </div>
                    <input type="hidden" name="billing_countryCode" value="US" />
                </div>
            )}

            {state.message && (
                <p
                    className="font-sans text-[13px] mt-4 px-3 py-2 rounded-md"
                    style={
                        state.ok
                            ? {
                                  background: "var(--color-status-positive-surface)",
                                  color: "var(--color-status-positive-text)",
                              }
                            : {
                                  background: "var(--color-status-warning-surface)",
                                  color: "var(--color-status-warning-text)",
                              }
                    }
                >
                    {state.message}
                </p>
            )}

            <div className="mt-5">
                <PortalButton type="submit" disabled={pending}>
                    {pending ? "Saving…" : shippingAddress ? "Update address" : "Save address"}
                </PortalButton>
            </div>
        </form>
    );
}

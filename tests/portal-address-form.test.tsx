import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PortalAddressForm from "../src/components/portal/PortalAddressForm";

describe("address form concurrency envelope", () => {
    it("submits the rendered organization, address version and stable request ID", () => {
        const html = renderToStaticMarkup(<PortalAddressForm shippingAddress={null} billingAddress={null}
            expectedOrgId="org_rendered" expectedVersion={7} requestId="request_rendered_0001"
            action={async () => ({ ok: false, errors: {}, message: null })} />);
        expect(html).toContain('name="expectedOrgId" value="org_rendered"');
        expect(html).toContain('name="expectedVersion" value="7"');
        expect(html).toContain('name="requestId" value="request_rendered_0001"');
    });
});

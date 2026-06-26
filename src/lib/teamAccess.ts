export const TEAM_HUB_ACCESS_ROLES = [
    "employee",
    "team",
    "admin",
    "executive",
    "super_admin",
    "founder",
    "ceo",
] as const;

export const EXECUTIVE_HUB_ACCESS_ROLES = [
    "employee",
    "admin",
    "executive",
    "super_admin",
    "founder",
    "ceo",
] as const;

const TEAM_HUB_ACCESS_ROLE_SET = new Set<string>(TEAM_HUB_ACCESS_ROLES);
const EXECUTIVE_HUB_ACCESS_ROLE_SET = new Set<string>(EXECUTIVE_HUB_ACCESS_ROLES);
const DEFAULT_HUB_OWNER_EMAILS = ["jordan@asala.ai"] as const;

type TeamHubMetadata = Record<string, unknown> | null | undefined;

type HubAccessOptions = {
    emailAddresses?: readonly unknown[];
    allowedEmails?: readonly unknown[];
};

type ClerkEmailAddress = {
    emailAddress?: string | null;
} | null | undefined;

type ClerkUserEmails = {
    primaryEmailAddress?: ClerkEmailAddress;
    emailAddresses?: readonly ClerkEmailAddress[] | null;
} | null | undefined;

function normalizeRole(value: unknown) {
    if (typeof value !== "string") return null;

    const role = value.trim().toLowerCase();
    return role || null;
}

function normalizeEmail(value: unknown) {
    if (typeof value !== "string") return null;

    const email = value.trim().toLowerCase();
    return email.includes("@") ? email : null;
}

function parseEmailList(value: string | undefined) {
    if (!value) return [];

    return value
        .split(/[\s,;]+/)
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email));
}

function getConfiguredAllowedEmails(envName: "TEAM_HUB_ALLOWED_EMAILS" | "EXECUTIVE_HUB_ALLOWED_EMAILS", options: HubAccessOptions) {
    return [
        ...DEFAULT_HUB_OWNER_EMAILS,
        ...parseEmailList(process.env[envName]),
        ...(options.allowedEmails ?? []),
    ];
}

function hasAllowedRole(value: unknown, roleSet: Set<string>) {
    const role = normalizeRole(value);
    return Boolean(role && roleSet.has(role));
}

function hasAllowedRoleInArray(value: unknown, roleSet: Set<string>) {
    return Array.isArray(value) && value.some((role) => hasAllowedRole(role, roleSet));
}

function hasTeamHubMetadataAccess(metadata: TeamHubMetadata) {
    if (metadata?.teamHubAccess === true || metadata?.teamAccess === true) {
        return true;
    }

    return (
        hasAllowedRole(metadata?.role, TEAM_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata?.roles, TEAM_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata?.teamRoles, TEAM_HUB_ACCESS_ROLE_SET)
    );
}

function hasExecutiveHubMetadataAccess(metadata: TeamHubMetadata) {
    if (metadata?.executiveHubAccess === true || metadata?.executiveAccess === true) {
        return true;
    }

    return (
        hasAllowedRole(metadata?.role, EXECUTIVE_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata?.roles, EXECUTIVE_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata?.teamRoles, EXECUTIVE_HUB_ACCESS_ROLE_SET)
    );
}

function hasAllowedEmail(emailAddresses: readonly unknown[] | undefined, allowedEmails: readonly unknown[]) {
    if (!emailAddresses?.length) return false;

    const allowedEmailSet = new Set(
        allowedEmails
            .map((email) => normalizeEmail(email))
            .filter((email): email is string => Boolean(email)),
    );

    return emailAddresses.some((email) => {
        const normalizedEmail = normalizeEmail(email);
        return Boolean(normalizedEmail && allowedEmailSet.has(normalizedEmail));
    });
}

export function getUserEmailAddresses(user: ClerkUserEmails) {
    const emails: string[] = [];
    const seen = new Set<string>();

    const addEmail = (value: unknown) => {
        if (typeof value !== "string") return;

        const email = value.trim();
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || seen.has(normalizedEmail)) return;

        seen.add(normalizedEmail);
        emails.push(email);
    };

    addEmail(user?.primaryEmailAddress?.emailAddress);
    user?.emailAddresses?.forEach((emailAddress) => addEmail(emailAddress?.emailAddress));

    return emails;
}

export function hasTeamHubAccess(metadata: TeamHubMetadata, options: HubAccessOptions = {}) {
    return (
        hasTeamHubMetadataAccess(metadata) ||
        hasAllowedEmail(options.emailAddresses, getConfiguredAllowedEmails("TEAM_HUB_ALLOWED_EMAILS", options))
    );
}

export function hasExecutiveHubAccess(metadata: TeamHubMetadata, options: HubAccessOptions = {}) {
    return (
        hasExecutiveHubMetadataAccess(metadata) ||
        hasAllowedEmail(options.emailAddresses, getConfiguredAllowedEmails("EXECUTIVE_HUB_ALLOWED_EMAILS", options))
    );
}

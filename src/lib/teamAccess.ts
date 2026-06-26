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

type TeamHubMetadata = Record<string, unknown> | null | undefined;

function normalizeRole(value: unknown) {
    if (typeof value !== "string") return null;

    const role = value.trim().toLowerCase();
    return role || null;
}

function hasAllowedRole(value: unknown, roleSet: Set<string>) {
    const role = normalizeRole(value);
    return Boolean(role && roleSet.has(role));
}

function hasAllowedRoleInArray(value: unknown, roleSet: Set<string>) {
    return Array.isArray(value) && value.some((role) => hasAllowedRole(role, roleSet));
}

export function hasTeamHubAccess(metadata: TeamHubMetadata) {
    if (!metadata) return false;

    if (metadata.teamHubAccess === true || metadata.teamAccess === true) {
        return true;
    }

    return (
        hasAllowedRole(metadata.role, TEAM_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata.roles, TEAM_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata.teamRoles, TEAM_HUB_ACCESS_ROLE_SET)
    );
}

export function hasExecutiveHubAccess(metadata: TeamHubMetadata) {
    if (!metadata) return false;

    if (metadata.executiveHubAccess === true || metadata.executiveAccess === true) {
        return true;
    }

    return (
        hasAllowedRole(metadata.role, EXECUTIVE_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata.roles, EXECUTIVE_HUB_ACCESS_ROLE_SET) ||
        hasAllowedRoleInArray(metadata.teamRoles, EXECUTIVE_HUB_ACCESS_ROLE_SET)
    );
}

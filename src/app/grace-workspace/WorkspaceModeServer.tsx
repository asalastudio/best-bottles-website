import { auth, currentUser } from "@clerk/nextjs/server";
import EmployeeKnowledgeWorkspace from "@/components/grace-workspace/EmployeeKnowledgeWorkspace";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";
import GraceWorkspaceClient from "./GraceWorkspaceClient";

/**
 * /grace-workspace is public. Anyone — signed in or not — can open the full
 * workspace and prompt Grace. Signing in only adds account-linked history
 * (projects, shortlists, recorded sessions); it never gates the surface.
 *
 * The one exception is staff: a Team Hub user gets the employee knowledge
 * workspace instead of the customer one.
 */
export default async function WorkspaceModeServer() {
    if (!CLERK_ENABLED) {
        return process.env.NODE_ENV === "production"
            ? <GraceWorkspaceClient />
            : <EmployeeKnowledgeWorkspace />;
    }

    const { userId } = await auth();
    if (!userId) return <GraceWorkspaceClient />;

    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    const hasEmployeeAccess = hasTeamHubAccess(user?.publicMetadata, { emailAddresses });
    if (hasEmployeeAccess) return <EmployeeKnowledgeWorkspace />;

    return <GraceWorkspaceClient />;
}

import { auth, currentUser } from "@clerk/nextjs/server";
import EmployeeKnowledgeWorkspace from "@/components/grace-workspace/EmployeeKnowledgeWorkspace";
import { CLERK_ENABLED } from "@/lib/clerk";
import { getUserEmailAddresses, hasTeamHubAccess } from "@/lib/teamAccess";
import GraceWorkspaceRouter from "./GraceWorkspaceRouter";

export default async function WorkspaceModeServer() {
    if (!CLERK_ENABLED) {
        return process.env.NODE_ENV === "production"
            ? <GraceWorkspaceRouter />
            : <EmployeeKnowledgeWorkspace />;
    }

    const { userId } = await auth();
    if (!userId) return <GraceWorkspaceRouter />;

    const user = await currentUser();
    const emailAddresses = getUserEmailAddresses(user);
    const hasEmployeeAccess = hasTeamHubAccess(user?.publicMetadata, { emailAddresses });
    if (hasEmployeeAccess) return <EmployeeKnowledgeWorkspace />;

    return <GraceWorkspaceRouter />;
}

"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { GRACE_NOOP, GraceContext, type GraceContextValue } from "@/components/GraceContext";
import { resolveGraceOwnerKey, setActiveGraceOwnerKey } from "@/lib/graceOwnerKey";
import { stripLocalePrefix } from "@/i18n/paths";
import { GRACE_MINIMUM_CONTENT_WIDTH_PX, resolveGraceDrawerWidth, resolveGraceSurface } from "@/lib/grace/pushLayout";
import { reportError } from "@/lib/observability/report";

/**
 * Grace's conversation engine (GraceProvider: state, tools, Convex calls,
 * realtime voice) was in the first-load JavaScript of every page and
 * hydrated with it, although Grace is closed until someone opens her.
 *
 * This shell owns GraceContext and the page tree. Until the engine loads it
 * serves the closed, idle value Grace starts with; the engine loads once the
 * page is idle (or at once on Grace's own pages), and any call made before
 * then (opening the drawer, an image upload) loads it immediately and is
 * replayed in order as soon as it is ready. The page tree never remounts: the
 * engine renders nothing and publishes its value up to this shell.
 */
const GraceEngine = dynamic(() => import("./GraceProvider"), { ssr: false });

type FunctionKeys = { [K in keyof GraceContextValue]-?: NonNullable<GraceContextValue[K]> extends (...args: never[]) => unknown ? K : never }[keyof GraceContextValue];
type QueuedCall = { name: FunctionKeys; args: unknown[]; resolve: (result: unknown) => void };

const QUEUED_FUNCTIONS: readonly FunctionKeys[] = [
    "openPanel", "followSurfacedProduct", "closePanel", "minimizeToStrip", "minimizeWithTooltip", "appendInlineMessage",
    "open", "close", "setInput", "toggleVoice", "send", "startDictation", "stopDictation", "stopSpeaking",
    "startConversation", "endConversation", "resetConversation", "confirmAction", "dismissAction", "onNavigate",
    "clearPendingNavigation", "updateFormField", "submitActiveForm", "dismissActiveForm",
];

/**
 * Grace is an enhancement: if her engine fails to load (a chunk that will not
 * download, a deploy that replaced it) or throws, the page must stay up. Without
 * this boundary the error reached the root error page and replaced the shop.
 */
class GraceEngineBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        reportError(error, { area: "grace-engine" });
        this.props.onFailure();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

/** Routes that are Grace itself: the engine is needed for the first paint. */
function graceOwnsRoute(pathname: string): boolean {
    const path = stripLocalePrefix(pathname);
    return path.startsWith("/grace-workspace") || path.startsWith("/executive");
}

function GraceProviderShellBase({ children, userId, withClerk }: { children: ReactNode; userId: string | null; withClerk: boolean }) {
    const pathname = usePathname();
    // Published synchronously during render, as the engine does, so the owner
    // key is right before the engine loads.
    const ownerKey = resolveGraceOwnerKey(userId);
    setActiveGraceOwnerKey(ownerKey);

    const [engineValue, setEngineValue] = useState<GraceContextValue | null>(null);
    const [requested, setLoad] = useState(false);
    // Grace's own pages need the engine for their first paint.
    const load = requested || graceOwnsRoute(pathname);
    const queue = useRef<QueuedCall[]>([]);
    const engineRef = useRef<GraceContextValue | null>(null);
    // Set when the engine failed: Grace stays closed and idle, and calls do nothing.
    const failedRef = useRef(false);

    useEffect(() => {
        if (load) return;
        if (typeof requestIdleCallback === "function") {
            const id = requestIdleCallback(() => setLoad(true), { timeout: 4000 });
            return () => cancelIdleCallback(id);
        }
        const id = window.setTimeout(() => setLoad(true), 1500);
        return () => window.clearTimeout(id);
    }, [load]);

    const onValue = useCallback((value: GraceContextValue) => {
        engineRef.current = value;
        setEngineValue(value);
        const pending = queue.current.splice(0);
        for (const call of pending) {
            const fn = value[call.name] as ((...args: unknown[]) => unknown) | undefined;
            // One failing replay must not take the engine (and the calls after it) down with it.
            try {
                call.resolve(fn?.(...call.args));
            } catch (error) {
                reportError(error, { area: "grace-engine" });
                call.resolve(undefined);
            }
        }
    }, []);

    const onEngineFailure = useCallback(() => {
        failedRef.current = true;
        engineRef.current = null;
        setEngineValue(null);
        // Calls waiting for the engine settle with nothing rather than hang.
        for (const call of queue.current.splice(0)) call.resolve(undefined);
    }, []);

    const idleValue = useMemo((): GraceContextValue => {
        const deferred = Object.fromEntries(QUEUED_FUNCTIONS.map((name) => [name, (...args: unknown[]) => {
            const engine = engineRef.current;
            if (engine) return (engine[name] as ((...a: unknown[]) => unknown) | undefined)?.(...args);
            if (failedRef.current) return undefined;
            setLoad(true);
            return new Promise((resolve) => queue.current.push({ name, args, resolve }));
        }]));
        return {
            ...GRACE_NOOP,
            ...deferred,
            // The engine's first render: closed, before it has measured the viewport.
            surface: resolveGraceSurface({
                isOpen: false,
                viewportWidth: 0,
                drawerWidth: resolveGraceDrawerWidth(0),
                minimumContentWidth: GRACE_MINIMUM_CONTENT_WIDTH_PX,
                ownsViewport: pathname.startsWith("/grace-workspace") || pathname.startsWith("/executive"),
                pushEligible: false,
            }),
            ownerKey,
        } as GraceContextValue;
    }, [pathname, ownerKey]);

    return (
        <GraceContext.Provider value={engineValue ?? idleValue}>
            {children}
            {load && (
                <GraceEngineBoundary onFailure={onEngineFailure}>
                    <GraceEngine withClerk={withClerk} onValue={onValue} />
                </GraceEngineBoundary>
            )}
        </GraceContext.Provider>
    );
}

function GraceProviderShellWithClerk({ children }: { children: ReactNode }) {
    const { userId } = useAuth();
    return <GraceProviderShellBase userId={userId ?? null} withClerk>{children}</GraceProviderShellBase>;
}

export default function GraceProviderShell({ children, withClerk = false }: { children: ReactNode; withClerk?: boolean }) {
    if (withClerk) return <GraceProviderShellWithClerk>{children}</GraceProviderShellWithClerk>;
    return <GraceProviderShellBase userId={null} withClerk={false}>{children}</GraceProviderShellBase>;
}

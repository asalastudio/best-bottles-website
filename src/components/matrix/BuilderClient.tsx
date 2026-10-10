"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import BuilderLoading from "@/components/bottle-builder/BuilderLoading";
import type MatrixClientComponent from "./MatrixClient";

const MatrixClient = dynamic(() => import("./MatrixClient"), {
    ssr: false,
    loading: () => <BuilderLoading />,
});

export default function BuilderClient(props: ComponentProps<typeof MatrixClientComponent>) {
    return <MatrixClient {...props} />;
}

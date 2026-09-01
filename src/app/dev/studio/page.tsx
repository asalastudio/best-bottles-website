"use client";

import dynamic from "next/dynamic";

const StudioView = dynamic(() => import("./StudioView"), { ssr: false });

export default function Page() {
  return <StudioView />;
}

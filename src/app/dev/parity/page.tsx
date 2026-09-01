"use client";

import dynamic from "next/dynamic";

const ParityView = dynamic(() => import("./ParityView"), { ssr: false });

export default function Page() {
  return <ParityView />;
}

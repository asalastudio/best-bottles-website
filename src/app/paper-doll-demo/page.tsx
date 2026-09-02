"use client";

import PaperDollViewer from "@/components/PaperDollViewer";
import Navbar from "@/components/Navbar";

export default function PaperDollDemoPage() {
  return (
    <>
      <Navbar />
      <main className="max-w-[600px] mx-auto px-4 py-12">
        <h1 className="font-serif text-2xl font-medium text-obsidian mb-2">
          Paper Doll Configurator
        </h1>
        <p className="text-sm text-slate mb-8">
          9ml Cylinder — live layer compositing from Sanity CDN
        </p>

        <PaperDollViewer familyKey="CYL-9ML" />
      </main>
    </>
  );
}

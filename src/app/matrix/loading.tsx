import Navbar from "@/components/Navbar";
import BuilderLoading from "@/components/bottle-builder/BuilderLoading";
export default function Loading() {
    return <><Navbar hideMobileSearch builderMobile /><main className="min-h-screen bg-bone pt-[104px] sm:pt-[120px]"><BuilderLoading /></main></>;
}

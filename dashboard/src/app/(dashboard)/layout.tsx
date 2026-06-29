import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getLicenseState } from "@/lib/license";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const lic = await getLicenseState();
    if (!lic.valid) {
        redirect("/license");
    }

    return (
        <div className="min-h-screen bg-background flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen min-w-0 md:ml-20 lg:ml-64 transition-all duration-300 relative group-[.collapsed]:md:ml-20">
                <Topbar />
                <main className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}

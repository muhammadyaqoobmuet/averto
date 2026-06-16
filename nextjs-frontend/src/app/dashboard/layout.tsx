import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />
      {/* Right column: header + scrollable content */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

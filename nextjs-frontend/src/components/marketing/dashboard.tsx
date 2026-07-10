import { LayoutGrid, FolderKanban, Users, CheckSquare, CircleUserRound, Receipt, FileText, Blocks, Settings, Search, Bell, Calendar, MoreHorizontal, BellIcon } from 'lucide-react';
import Icons from '../global/icons';

const Dashboard = () => {
    return (
        <div className="w-full h-full bg-[#0A0B0F] flex overflow-hidden">
            <aside className="w-60 border-r border-foreground/10 flex flex-col shrink-0">
                <div className="p-4">
                    <Icons.wordmark className="h-5 w-auto text-white" />
                </div>

                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    <div className="relative px-3 py-2.5 bg-primary/10 text-primary rounded-lg flex items-center gap-3 text-sm font-medium cursor-pointer">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r" />
                        <LayoutGrid className="w-4 h-4" />
                        <span>Dashboard</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <FolderKanban className="w-4 h-4" />
                        <span>Projects</span>
                        <span className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded">12</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <Users className="w-4 h-4" />
                        <span>Clients</span>
                        <span className="ml-auto text-xs bg-white/10 px-1.5 py-0.5 rounded">48</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <CheckSquare className="w-4 h-4" />
                        <span>Tasks</span>
                        <span className="ml-auto text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">8</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <CircleUserRound className="w-4 h-4" />
                        <span>Team</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <Receipt className="w-4 h-4" />
                        <span>Invoices</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <FileText className="w-4 h-4" />
                        <span>Files</span>
                    </div>

                    <div className="my-2 border-t border-foreground/10" />

                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <Blocks className="w-4 h-4" />
                        <span>Templates</span>
                    </div>
                    <div className="px-3 py-2.5 text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer">
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                    </div>
                </nav>

                <div className="p-3 space-y-2">
                    <button className="w-full px-3 py-2 text-xs text-foreground/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left cursor-pointer">
                        Help Center
                    </button>
                    <button className="w-full px-3 py-2 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors font-medium cursor-pointer">
                        Upgrade Plan
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                        <div className="size-7 rounded-full bg-linear-to-br from-primary to-blue-500 flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">SS</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">Shreyas Sihasane</p>
                            <p className="text-xs text-foreground/60 truncate">shreyas@avento.app</p>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-foreground/60" />
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b border-foreground/10 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <div>
                            <h1 className="text-base font-semibold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                Today
                            </h1>
                            <p className="text-xs text-foreground/60">Saturday, Nov 29</p>
                        </div>
                        <div className="flex-1 max-w-md ml-8">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
                                <input
                                    type="text"
                                    placeholder="Search tasks, clients, invoices..."
                                    className="w-full h-9 pl-9 pr-4 bg-foreground/5 border border-foreground/10 rounded-lg text-sm placeholder:text-foreground/40 focus:outline-none focus:border-primary/50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="relative w-9 h-9 flex items-center justify-center hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer">
                            <BellIcon className="w-4 h-4 text-foreground/60" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                        </button>
                        <div className="size-8 rounded-full bg-linear-to-br from-primary to-blue-500 flex items-center justify-center cursor-pointer">
                            <span className="text-white font-semibold text-xs leading-none mt-0.5">SS</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto">
                    <div className="grid grid-cols-[1fr_320px] gap-6 p-6 h-full">
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">Your Tasks Today</h2>
                                    <span className="text-xs text-foreground/60">8 tasks</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-3 bg-foreground/2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer border border-foreground/10">
                                        <div className="w-1 h-8 bg-primary rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Review project proposal</p>
                                            <p className="text-xs text-foreground/60">Acme Corp • Due in 2 hours</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-foreground/2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer border border-foreground/10">
                                        <div className="w-1 h-8 bg-tertiary rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Send invoice to client</p>
                                            <p className="text-xs text-foreground/60">Tech Startup • Overdue</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-foreground/2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer border border-foreground/10">
                                        <div className="w-1 h-8 bg-foreground/20 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Team standup meeting</p>
                                            <p className="text-xs text-foreground/60">Internal • Today at 3:00 PM</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-foreground/2 hover:bg-foreground/5 rounded-lg transition-colors cursor-pointer border border-foreground/10">
                                        <div className="w-1 h-8 bg-foreground/20 rounded-full" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Update design system</p>
                                            <p className="text-xs text-foreground/60">Design Project • Tomorrow</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">Active Projects</h2>
                                    <span className="text-xs text-primary cursor-pointer hover:underline">View all</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-foreground/2 border border-foreground/10 rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <span className="text-primary font-semibold text-xs">AC</span>
                                            </div>
                                            <span className="text-xs text-foreground/60">3 days left</span>
                                        </div>
                                        <h3 className="text-sm font-semibold mb-1">Acme Rebrand</h3>
                                        <p className="text-xs text-foreground/60 mb-3">Acme Corp</p>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-foreground/60">Progress</span>
                                                <span className="font-medium">75%</span>
                                            </div>
                                            <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: '75%' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-foreground/2 border border-foreground/10 rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center">
                                                <span className="text-tertiary font-semibold text-xs">TS</span>
                                            </div>
                                            <span className="text-xs text-foreground/60">1 week left</span>
                                        </div>
                                        <h3 className="text-sm font-semibold mb-1">Tech Startup</h3>
                                        <p className="text-xs text-foreground/60 mb-3">Website Design</p>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-foreground/60">Progress</span>
                                                <span className="font-medium">45%</span>
                                            </div>
                                            <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-tertiary rounded-full" style={{ width: '45%' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">Team Members</h2>
                                    <span className="text-xs text-primary cursor-pointer hover:underline">View all</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-foreground/2 border border-foreground/10 rounded-lg p-3 hover:border-primary/30 transition-colors cursor-pointer">
                                        <div className="flex flex-col items-center text-center">
                                            <div className="size-10 rounded-full bg-linear-to-br from-primary to-blue-500 flex items-center justify-center mb-2">
                                                <span className="text-white font-semibold text-xs">SS</span>
                                            </div>
                                            <p className="text-xs font-semibold truncate w-full">Shreyas S</p>
                                            <p className="text-xs text-foreground/60">Designer</p>
                                        </div>
                                    </div>
                                    <div className="bg-foreground/2 border border-foreground/10 rounded-lg p-3 hover:border-primary/30 transition-colors cursor-pointer">
                                        <div className="flex flex-col items-center text-center">
                                            <div className="size-10 rounded-full bg-linear-to-br from-tertiary to-purple-500 flex items-center justify-center mb-2">
                                                <span className="text-white font-semibold text-xs">JD</span>
                                            </div>
                                            <p className="text-xs font-semibold truncate w-full">John Doe</p>
                                            <p className="text-xs text-foreground/60">Developer</p>
                                        </div>
                                    </div>
                                    <div className="bg-foreground/2 border border-foreground/10 rounded-lg p-3 hover:border-primary/30 transition-colors cursor-pointer">
                                        <div className="flex flex-col items-center text-center">
                                            <div className="size-10 rounded-full bg-linear-to-br from-orange-500 to-red-500 flex items-center justify-center mb-2">
                                                <span className="text-white font-semibold text-xs">AS</span>
                                            </div>
                                            <p className="text-xs font-semibold truncate w-full">Alice Smith</p>
                                            <p className="text-xs text-foreground/60">Manager</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-foreground/2 border border-foreground/10 rounded-xl p-5">
                                <h2 className="text-sm font-semibold mb-4">Upcoming Deadlines</h2>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="text-center shrink-0">
                                            <div className="text-xs text-foreground/60">Dec</div>
                                            <div className="text-lg font-bold">02</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Project delivery</p>
                                            <p className="text-xs text-foreground/60">Acme Rebrand</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="text-center shrink-0">
                                            <div className="text-xs text-foreground/60">Dec</div>
                                            <div className="text-lg font-bold text-foreground/60">08</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground/60">Invoice payment</p>
                                            <p className="text-xs text-foreground/60">Tech Startup</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="text-center shrink-0">
                                            <div className="text-xs text-foreground/60">Dec</div>
                                            <div className="text-lg font-bold text-foreground/60">15</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-foreground/60">Milestone review</p>
                                            <p className="text-xs text-foreground/60">Design System</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-foreground/2 border border-foreground/10 rounded-xl p-5">
                                <h2 className="text-sm font-semibold mb-4">Latest Activity</h2>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">Task completed</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">2 hours ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">Review project proposal</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-tertiary mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">Invoice paid</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">5 hours ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">$1,999.00 from Acme Corp</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-foreground/30 mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">New client added</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">1 day ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">Tech Startup joined</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">Project milestone reached</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">2 days ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">Design phase completed</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-tertiary mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">Team member invited</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">3 days ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">John Doe joined the team</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-2 h-2 rounded-full bg-foreground/30 mt-1.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium">File uploaded</p>
                                                <p className="text-xs text-foreground/40 mt-0.5">4 days ago</p>
                                            </div>
                                            <p className="text-xs text-foreground/60">Design assets added</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;

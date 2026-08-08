import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Award, BookOpen, ChartNoAxesCombined, LayoutDashboard, LogOut, PanelLeft, Settings, Users } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import ThemeToggle from "./ThemeToggle";

const baseMenuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: BookOpen, label: "Lesson library", path: "/library" },
  { icon: ChartNoAxesCombined, label: "My progress", path: "/progress" },
  { icon: Award, label: "My achievements", path: "/achievements" },
  { icon: Settings, label: "Profile & journal", path: "/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#062B35] px-5"><div className="max-w-md text-center"><span className="brand-mark justify-center"><span className="brand-mark__dot"/>Articulation Mastery</span><h1 className="mt-8 text-3xl font-semibold tracking-tight text-white">Your practice space is ready.</h1><p className="mt-3 leading-7 text-[#C5E4E6]">Sign in to access your communication program, coaching feedback, and progress history.</p><Button onClick={() => startLogin()} className="premium-button mt-7 w-full">Sign in to continue</Button></div></div>;
  return <SidebarProvider><DashboardLayoutContent>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const mobile = useIsMobile();
  const menuItems = user?.role === "manager" || user?.role === "admin" ? [...baseMenuItems.slice(0, 3), { icon: Users, label: "Team insights", path: "/reports" }, baseMenuItems[3]!] : baseMenuItems;
  const active = menuItems.find(item => location === item.path);
  useEffect(() => { if (location === "/") navigate("/dashboard"); }, [location, navigate]);
  return <><Sidebar collapsible="icon" className="border-r border-white/10 bg-[#063A45] text-[#E4F8F8]"><SidebarHeader className="h-20 justify-center border-b border-white/10"><div className="flex items-center gap-3 px-3"><button onClick={toggleSidebar} className="grid h-8 w-8 place-items-center rounded-lg text-[#B7DDE0] hover:bg-white/10 hover:text-white" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4"/></button>{state !== "collapsed" && <span className="font-display text-lg tracking-tight text-white">Articulation<span className="text-[#84E7E5]">.</span></span>}</div></SidebarHeader><SidebarContent><SidebarMenu className="px-3 py-5">{menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} tooltip={item.label} onClick={() => navigate(item.path)} className="h-11 text-[#C5E4E6] transition hover:bg-white/10 hover:text-white data-[active=true]:bg-[#84E7E5]/14 data-[active=true]:text-[#84E7E5]"><item.icon className="h-4 w-4"/><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="border-t border-white/10 p-3"><div className="mb-3 group-data-[collapsible=icon]:hidden"><ThemeToggle /></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-white/8"><Avatar className="h-9 w-9 shrink-0 border-0"><AvatarFallback className="bg-[#84E7E5]/16 text-xs font-medium text-[#84E7E5]">{user?.name?.charAt(0).toUpperCase() || "A"}</AvatarFallback></Avatar>{state !== "collapsed" && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{user?.name || "Articulation learner"}</p><p className="mt-1 truncate text-xs capitalize text-[#B7DDE0]">{user?.role}</p></div>}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#084E5A] text-white"><DropdownMenuItem onClick={logout} className="cursor-pointer text-red-200 focus:bg-white/10 focus:text-red-100"><LogOut className="mr-2 h-4 w-4"/>Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><SidebarInset>{mobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-[#063A45]/95 px-3 backdrop-blur"><SidebarTrigger className="text-[#E4F8F8] hover:bg-white/10 hover:text-white"/><span className="flex-1 text-sm text-white">{active?.label || "Articulation Mastery"}</span><ThemeToggle compact /></div>}<main className="min-h-screen flex-1 bg-[#062B35] p-4 sm:p-7">{children}</main></SidebarInset></>;
}

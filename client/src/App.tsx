import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Lesson from "./pages/Lesson";
import Progress from "./pages/Progress";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import LearnerReport from "./pages/LearnerReport";
import Achievements from "./pages/Achievements";
import DashboardLayout from "./components/DashboardLayout";
import ThemeToggle from "./components/ThemeToggle";

function Workspace({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/onboarding"} component={Onboarding} />
      <Route path={"/dashboard"}>{() => <Workspace><Dashboard /></Workspace>}</Route>
      <Route path={"/library"}>{() => <Workspace><Library /></Workspace>}</Route>
      <Route path={"/lessons/:day"}>{params => <Workspace><Lesson day={Number(params.day)} /></Workspace>}</Route>
      <Route path={"/progress"}>{() => <Workspace><Progress /></Workspace>}</Route>
      <Route path={"/achievements"}>{() => <Workspace><Achievements /></Workspace>}</Route>
      <Route path={"/reports"}>{() => <Workspace><Reports /></Workspace>}</Route>
      <Route path={"/reports/:learnerId"}>{params => <Workspace><LearnerReport learnerId={Number(params.learnerId)} /></Workspace>}</Route>
      <Route path={"/settings"}>{() => <Workspace><Settings /></Workspace>}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"><ThemeToggle compact /></div>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

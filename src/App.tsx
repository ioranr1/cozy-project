import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Camera from "./pages/Camera";
import Viewer from "./pages/Viewer";
import EventDetails from "./pages/EventDetails";
import LiveView from "./pages/LiveView";
import NotFound from "./pages/NotFound";
import Cameras from "./pages/Cameras";
import Rules from "./pages/Rules";
import Events from "./pages/Events";
import Settings from "./pages/Settings";
import SystemHealth from "./pages/SystemHealth";
import RecordingBuffer from "./pages/RecordingBuffer";
import BackgroundMode from "./pages/BackgroundMode";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cameras" element={<Cameras />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/events" element={<Events />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/system-health" element={<SystemHealth />} />
            <Route path="/recording-buffer" element={<RecordingBuffer />} />
            <Route path="/background-mode" element={<BackgroundMode />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/viewer" element={<Viewer />} />
            <Route path="/events/:eventId" element={<EventDetails />} />
            <Route path="/live/:sessionId" element={<LiveView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

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
import Devices from "./pages/Devices";
import Camera from "./pages/Camera";
import Viewer from "./pages/Viewer";
import EventDetails from "./pages/EventDetails";
import Events from "./pages/Events";
import LiveView from "./pages/LiveView";
import BabyMonitorViewer from "./pages/BabyMonitorViewer";
import MicrophoneTestPage from "./pages/MicrophoneTestPage";
import NotFound from "./pages/NotFound";

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
            <Route path="/devices" element={<Devices />} />
            <Route path="/camera" element={<Camera />} />
            <Route path="/mic-test" element={<MicrophoneTestPage />} />
            <Route path="/viewer" element={<Viewer />} />
            <Route path="/baby-monitor" element={<BabyMonitorViewer />} />
            <Route path="/events" element={<Events />} />
            <Route path="/event/:eventId" element={<EventDetails />} />
            <Route path="/live/:sessionId" element={<LiveView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

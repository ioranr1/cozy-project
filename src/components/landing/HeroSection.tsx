import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Play, ArrowDown, Smartphone, Laptop } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-50 via-sky-100 to-blue-100">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-300/30 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwNmI2ZDQiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRIMjR2LTJoMTJ2MnptLTEyLTZoMTJ2MkgyNHYtMnptMC04aDEydjJIMjR2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

      <div className="container mx-auto px-4 pt-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 mb-8 border border-cyan-200 shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-cyan-700 text-sm font-medium">{isRTL ? 'מאובטח ב-100%' : '100% Secure'}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-800 mb-6 leading-tight">
            {t.hero.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
            {t.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register">
              <Button size="lg" className="bg-primary hover:bg-cyan-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30">
                {t.hero.cta}
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-300 text-slate-700 hover:bg-white/50 px-8 py-6 text-lg rounded-xl"
              >
                <Play className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t.hero.secondaryCta}
              </Button>
            </a>
          </div>

          {/* Device Mockup */}
          <div className="relative max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-4 md:gap-8">
              {/* Laptop */}
              <div className="relative bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl p-2 shadow-2xl">
                <div className="bg-gradient-to-br from-cyan-500 to-sky-600 rounded-xl overflow-hidden w-48 md:w-72 aspect-video">
                  <div className="w-full h-full flex items-center justify-center relative">
                    <Laptop className="w-12 h-12 text-white/70" />
                    <span className="absolute bottom-4 left-4 text-xs text-white bg-black/30 px-2 py-1 rounded">
                      {isRTL ? 'מצלמה' : 'Camera'}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 rounded-b-xl" />
              </div>

              {/* Connection Line */}
              <div className="hidden md:flex items-center">
                <div className="w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-sky-500" />
                <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                <div className="w-8 h-0.5 bg-gradient-to-r from-sky-500 to-cyan-500" />
              </div>

              {/* Phone */}
              <div className="relative bg-gradient-to-br from-slate-200 to-slate-300 rounded-3xl p-2 shadow-2xl">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl overflow-hidden w-24 md:w-36 aspect-[9/19]">
                  <div className="w-full h-full flex items-center justify-center relative">
                    <Smartphone className="w-8 h-8 text-white/70" />
                    <span className="absolute bottom-4 text-xs text-white bg-black/30 px-2 py-1 rounded">
                      {isRTL ? 'צפייה' : 'Viewer'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-300/30 via-sky-300/30 to-teal-300/30 rounded-3xl blur-2xl -z-10" />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowDown className="w-6 h-6 animate-bounce" />
      </a>
    </section>
  );
};

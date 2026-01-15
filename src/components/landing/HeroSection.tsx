import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Play, ArrowDown, Smartphone, Laptop } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRIMjR2LTJoMTJ2MnptLTEyLTZoMTJ2MkgyNHYtMnptMC04aDEydjJIMjR2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

      <div className="container mx-auto px-4 pt-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8 border border-white/20">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-white/80 text-sm">{isRTL ? 'מאובטח ב-100%' : '100% Secure'}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            {t.hero.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            {t.hero.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/register">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/30">
                {t.hero.cta}
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl"
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
              <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-2 shadow-2xl">
                <div className="bg-slate-900 rounded-xl overflow-hidden w-48 md:w-72 aspect-video">
                  <div className="w-full h-full bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center">
                    <Laptop className="w-12 h-12 text-white/50" />
                    <span className="absolute bottom-4 left-4 text-xs text-white/50 bg-black/50 px-2 py-1 rounded">
                      {isRTL ? 'מצלמה' : 'Camera'}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-b-xl" />
              </div>

              {/* Connection Line */}
              <div className="hidden md:flex items-center">
                <div className="w-8 h-0.5 bg-gradient-to-r from-primary to-blue-400" />
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <div className="w-8 h-0.5 bg-gradient-to-r from-blue-400 to-primary" />
              </div>

              {/* Phone */}
              <div className="relative bg-gradient-to-br from-slate-700 to-slate-800 rounded-3xl p-2 shadow-2xl">
                <div className="bg-slate-900 rounded-2xl overflow-hidden w-24 md:w-36 aspect-[9/19]">
                  <div className="w-full h-full bg-gradient-to-br from-green-600/30 to-blue-600/30 flex items-center justify-center relative">
                    <Smartphone className="w-8 h-8 text-white/50" />
                    <span className="absolute bottom-4 text-xs text-white/50 bg-black/50 px-2 py-1 rounded">
                      {isRTL ? 'צפייה' : 'Viewer'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl -z-10" />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 hover:text-white transition-colors">
        <ArrowDown className="w-6 h-6 animate-bounce" />
      </a>
    </section>
  );
};

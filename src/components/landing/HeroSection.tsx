import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Camera, Smartphone, Monitor } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-[hsl(210,100%,50%)] via-[hsl(200,100%,55%)] to-[hsl(195,100%,60%)]">
      {/* Content */}
      <div className="container mx-auto px-4 pt-24 pb-32 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          
          {/* Devices Section - Left Side */}
          <div className="relative flex-1 order-2 lg:order-1">
            <div className="relative flex items-end justify-center lg:justify-start gap-4">
              
              {/* Connected Badge */}
              <div className="absolute top-0 left-0 lg:-top-4 lg:left-4 z-20">
                <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-slate-700 text-sm font-medium">{isRTL ? 'מחובר' : 'Connected'}</span>
                </div>
              </div>

              {/* Laptop Device */}
              <div className="relative">
                {/* Laptop Screen */}
                <div className="bg-slate-800 rounded-t-lg p-1.5 shadow-2xl">
                  <div className="bg-[hsl(195,60%,35%)] rounded w-56 md:w-72 aspect-video flex flex-col items-center justify-center">
                    <Camera className="w-12 h-12 text-white/80 mb-2" />
                    <span className="text-white font-semibold text-lg">{isRTL ? 'מצלמה פעילה' : 'Active Camera'}</span>
                    <span className="text-white/70 text-sm">{isRTL ? 'לפטופ' : 'Laptop'}</span>
                  </div>
                </div>
                {/* Laptop Base */}
                <div className="bg-slate-700 h-3 rounded-b-lg" />
                <div className="bg-slate-600 h-1.5 w-[120%] -ml-[10%] rounded-b-xl" />
              </div>

              {/* Phone Device */}
              <div className="relative -mr-16 z-10">
                <div className="bg-slate-800 rounded-[2rem] p-2 shadow-2xl">
                  <div className="bg-[hsl(195,60%,35%)] rounded-[1.5rem] w-28 md:w-36 aspect-[9/18] flex flex-col items-center justify-center">
                    <Smartphone className="w-8 h-8 text-white/80 mb-2" />
                    <span className="text-white font-semibold text-sm">{isRTL ? 'צפייה חיה' : 'Live View'}</span>
                    <span className="text-white/70 text-xs">{isRTL ? 'טלפון נייד' : 'Mobile'}</span>
                    
                    {/* Monitor Icon at Bottom */}
                    <div className="mt-4 bg-[hsl(195,50%,30%)] rounded-lg p-3">
                      <Monitor className="w-6 h-6 text-white/60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content - Right Side */}
          <div className="flex-1 text-center lg:text-right order-1 lg:order-2">
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Monitor className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{isRTL ? 'הפוך את הלפטופ למצלמת אבטחה' : 'Turn your laptop into a security camera'}</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {t.hero.title}
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-xl mx-auto lg:mx-0 lg:ml-auto">
              {t.hero.subtitle}
            </p>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-6 text-lg rounded-xl shadow-lg font-semibold">
                  {t.hero.cta}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path 
            d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,90 1440,80 L1440,120 L0,120 Z" 
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
};

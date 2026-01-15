import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Camera, Smartphone, Monitor } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-[#0088DD] via-[#00A0E9] to-[#00B4F0]">
      {/* Content */}
      <div className="container mx-auto px-4 pt-24 pb-32 relative z-10">
        <div className={`flex flex-col lg:flex-row items-center justify-between gap-12 ${isRTL ? '' : 'lg:flex-row-reverse'}`}>
          
          {/* Devices Section - Left Side in RTL */}
          <div className="relative flex-1 order-2 lg:order-1">
            <div className="relative flex items-end justify-center lg:justify-start gap-[-20px]">
              
              {/* Connected Badge */}
              <div className="absolute -top-2 left-4 z-20">
                <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg">
                  <span className="text-slate-700 text-sm font-medium">{isRTL ? 'מחובר' : 'Connected'}</span>
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                </div>
              </div>

              {/* Laptop Device */}
              <div className="relative z-10">
                {/* Laptop Screen */}
                <div className="bg-[#1a1a2e] rounded-t-xl p-1.5 shadow-2xl border-4 border-[#1a1a2e]">
                  <div className="bg-[#2d5a5a] rounded-lg w-56 md:w-80 aspect-video flex flex-col items-center justify-center">
                    <Camera className="w-14 h-14 text-white/90 mb-3" />
                    <span className="text-white font-bold text-xl">{isRTL ? 'מצלמה פעילה' : 'Active Camera'}</span>
                    <span className="text-white/80 text-sm mt-1">{isRTL ? 'לפטופ' : 'Laptop'}</span>
                  </div>
                </div>
                {/* Laptop Base */}
                <div className="bg-[#1a1a2e] h-4 rounded-b-lg" />
                <div className="bg-[#2a2a3e] h-2 w-[110%] -ml-[5%] rounded-b-xl mx-auto" />
              </div>

              {/* Phone Device */}
              <div className="relative -ml-12 z-20">
                <div className="bg-[#1a1a2e] rounded-[2.5rem] p-2 shadow-2xl border-4 border-[#1a1a2e]">
                  <div className="bg-[#2d5a5a] rounded-[2rem] w-32 md:w-40 aspect-[9/18] flex flex-col items-center justify-center px-3">
                    <Smartphone className="w-10 h-10 text-white/90 mb-2" />
                    <span className="text-white font-bold text-base">{isRTL ? 'צפייה חיה' : 'Live View'}</span>
                    <span className="text-white/80 text-xs mt-0.5">{isRTL ? 'טלפון נייד' : 'Mobile'}</span>
                    
                    {/* Monitor Icon at Bottom */}
                    <div className="mt-6 bg-[#234848] rounded-xl p-4">
                      <Monitor className="w-8 h-8 text-white/70" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Content - Right Side in RTL */}
          <div className="flex-1 text-center lg:text-right order-1 lg:order-2">
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-5 py-2.5 mb-8">
              <Monitor className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">{isRTL ? 'הפוך את הלפטופ למצלמת אבטחה' : 'Turn your laptop into a security camera'}</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {isRTL ? 'הפוך את הלפטופ שלך' : 'Turn Your Laptop Into'}
              <br />
              {isRTL ? 'למצלמת אבטחה' : 'a Security Camera'}
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-xl mx-auto lg:mx-0 lg:ml-auto leading-relaxed">
              {isRTL 
                ? 'השתמשו בלפטופ כמצלמת אבטחה וצפה בזמן אמת מהטלפון הנייד שלך - מכל מקום בעולם' 
                : 'Use your laptop as a security camera and watch in real-time from your mobile phone - from anywhere in the world'}
            </p>

            {/* CTA Buttons */}
            <div className={`flex flex-col sm:flex-row items-center gap-4 ${isRTL ? 'justify-center lg:justify-end' : 'justify-center lg:justify-start'}`}>
              <Link to="/register">
                <Button size="lg" className="bg-white hover:bg-gray-100 text-[#0088DD] px-8 py-6 text-lg rounded-xl shadow-lg font-semibold min-w-[160px]">
                  {isRTL ? 'התחל עכשיו' : 'Get Started'}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl bg-transparent min-w-[160px]"
                >
                  {isRTL ? 'למידע נוסף' : 'Learn More'}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path 
            d="M0,80 C240,120 480,40 720,60 C960,80 1200,100 1440,60 L1440,120 L0,120 Z" 
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
};

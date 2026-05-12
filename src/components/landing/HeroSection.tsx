import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';
import devicesImage from '@/assets/devices-hero.png';

export const HeroSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Premium Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d3b66] to-[#1a5fb4]" />
      
      {/* Animated Gradient Orbs */}
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-r from-indigo-500/15 to-blue-400/15 rounded-full blur-3xl" />
      
      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 pt-24 pb-32 relative z-10">
        <div className={`flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16 ${isRTL ? '' : 'lg:flex-row-reverse'}`}>
          
          {/* Devices Image - Left Side in RTL */}
          <div className="relative flex-1 order-2 lg:order-1">
            {/* Connected Badge */}
            <div className="absolute -top-4 left-8 z-20">
              <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-5 py-2.5 shadow-xl">
                <span className="text-slate-700 text-sm font-semibold">{isRTL ? 'מחובר' : 'Connected'}</span>
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
            
            {/* Devices Image */}
            <div className="relative">
              <img 
                src={devicesImage} 
                alt="Security camera devices" 
                className="w-full max-w-2xl mx-auto drop-shadow-2xl"
              />
              {/* Glow effect under devices */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-cyan-400/30 blur-3xl rounded-full" />
            </div>
          </div>

          {/* Text Content - Right Side in RTL */}
          <div className="flex-1 text-center lg:text-right order-1 lg:order-2">
            {/* Small Badge — luminous glass pill */}
            <div className="relative inline-block mb-8 group">
              {/* Outer halo */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400/30 to-blue-400/30 rounded-full blur-md opacity-80 group-hover:opacity-100 transition duration-700 pointer-events-none" />
              {/* Pill */}
              <div className="relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#0a0f1e]/70 backdrop-blur-xl border border-white/15 shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)] overflow-hidden transition-all duration-300 hover:border-white/25">
                {/* Shimmer sweep */}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg] animate-[heroBadgeShimmer_4s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
                {/* Icon with glow */}
                <span className="relative inline-flex items-center justify-center">
                  <span className="absolute inset-0 bg-cyan-400/30 blur-[6px] rounded-full" aria-hidden />
                  <Monitor className="relative w-4 h-4 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                </span>
                {/* Text */}
                <span className="relative text-sm font-semibold tracking-wide bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                  {isRTL ? 'השתמש במחשב הנייד שכבר ברשותך כמערכת אבטחה פרטית' : 'Use the laptop you already own as a live security monitor'}
                </span>
              </div>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              {isRTL ? 'הפוך את הלפטופ שלך' : 'Turn Your Laptop Into'}
              <br />
              <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                {isRTL ? 'למצלמת אבטחה' : 'a Security Camera'}
              </span>
            </h1>

            {/* Elegant Slogan - Centered */}
            <div className="text-center mb-6">
              <div className="relative inline-block">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 via-blue-400/20 to-cyan-400/20 rounded-lg blur-md opacity-60" />
                <div className="relative flex flex-col items-center gap-1 px-6 py-3 rounded-lg bg-[#0a0f1e]/40 backdrop-blur-md border border-white/10">
                  <span className="text-lg md:text-xl font-semibold tracking-wider bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                    Travel Security
                  </span>
                  <span className="text-sm md:text-base text-cyan-100/80 font-medium tracking-wide">
                    {isRTL ? 'תמיד איתך, תמיד זמין' : 'Always with you, Always available'}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto lg:mx-0 lg:ml-auto leading-relaxed">
              {isRTL 
                ? 'השתמשו בלפטופ שלכם כמצלמת אבטחה מכל מקום שבו המחשב מחובר (למשל: מישרד,בית ,מלון,דירה שכורה ,Airbnb ) וצפו במתרחש בזמן אמת באמצעות הטלפון הנייד שלכם - מכל מקום בעולם' 
                : 'Use your laptop as a security camera from wherever your computer is connected (e.g., office, home, hotel, rental apartment, Airbnb) and watch what\'s happening in real-time via your mobile phone - from anywhere in the world'}
            </p>

            {/* CTA Buttons */}
            <div className={`flex flex-col sm:flex-row items-center gap-4 ${isRTL ? 'justify-center lg:justify-end' : 'justify-center lg:justify-start'}`}>
              <Link to="/register">
                <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30 font-semibold min-w-[160px] border-0">
                  {isRTL ? 'התחל עכשיו' : 'Get Started'}
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-xl bg-white/5 backdrop-blur-sm min-w-[160px]"
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
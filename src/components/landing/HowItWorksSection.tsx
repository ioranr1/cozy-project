import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Camera, Eye } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const steps = [
    {
      icon: Download,
      number: '01',
      title: t.howItWorks.step1.title,
      description: t.howItWorks.step1.description,
    },
    {
      icon: Camera,
      number: '02',
      title: t.howItWorks.step2.title,
      description: t.howItWorks.step2.description,
    },
    {
      icon: Eye,
      number: '03',
      title: t.howItWorks.step3.title,
      description: t.howItWorks.step3.description,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {t.howItWorks.title}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-blue-400 mx-auto rounded-full" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Connection Line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20 -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
            {steps.map((step, index) => (
              <div key={index} className="relative text-center">
                {/* Number Badge */}
                <div className="relative z-10 mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-primary/30">
                  <step.icon className="w-10 h-10 text-white" />
                  <span className={`absolute -top-2 ${isRTL ? '-left-2' : '-right-2'} w-8 h-8 bg-slate-900 border-2 border-primary rounded-full flex items-center justify-center text-primary font-bold text-sm`}>
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-white/60 max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

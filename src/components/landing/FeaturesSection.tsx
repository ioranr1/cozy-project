import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Video, Bell, Cloud, Layers } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const { t, isRTL } = useLanguage();

  const features = [
    {
      icon: Video,
      title: t.features.liveStream.title,
      description: t.features.liveStream.description,
      color: 'from-blue-500 to-cyan-400',
    },
    {
      icon: Bell,
      title: t.features.motionDetection.title,
      description: t.features.motionDetection.description,
      color: 'from-orange-500 to-amber-400',
    },
    {
      icon: Cloud,
      title: t.features.cloudStorage.title,
      description: t.features.cloudStorage.description,
      color: 'from-purple-500 to-pink-400',
    },
    {
      icon: Layers,
      title: t.features.multiDevice.title,
      description: t.features.multiDevice.description,
      color: 'from-green-500 to-emerald-400',
    },
  ];

  return (
    <section id="features" className="py-24 bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {t.features.title}
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-blue-400 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 hover:border-primary/50 transition-all duration-300 hover:-translate-y-2"
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-white/60 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity -z-10`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

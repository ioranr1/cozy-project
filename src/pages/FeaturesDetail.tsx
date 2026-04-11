import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Video, Bell, Mic, Cloud, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import dashboardScreenshotHe from '@/assets/dashboard-mobile-highlighted.png';
import dashboardScreenshotEn from '@/assets/dashboard-mobile-en-highlighted.png';

const IPhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative mx-auto" style={{ width: 280 }}>
    {/* iPhone outer shell */}
    <div className="rounded-[40px] border-[6px] border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
      {/* Notch */}
      <div className="relative flex justify-center">
        <div className="absolute top-0 z-10 w-28 h-6 bg-gray-800 rounded-b-2xl" />
      </div>
      {/* Screen */}
      <div className="rounded-[34px] overflow-hidden bg-black">
        {children}
      </div>
    </div>
  </div>
);

const FeaturesDetail: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const dp = t.features.detailPage;

  const features = [
    {
      icon: Video,
      color: 'from-blue-500 to-cyan-400',
      bgLight: 'bg-blue-50',
      ...dp.liveStream,
    },
    {
      icon: Bell,
      color: 'from-orange-500 to-amber-400',
      bgLight: 'bg-orange-50',
      ...dp.motionDetection,
    },
    {
      icon: Mic,
      color: 'from-green-500 to-emerald-400',
      bgLight: 'bg-green-50',
      ...dp.audioMonitoring,
    },
    {
      icon: Cloud,
      color: 'from-purple-500 to-pink-400',
      bgLight: 'bg-purple-50',
      ...dp.eventStorage,
    },
  ];

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="pt-8 pb-16">
        <div className="container mx-auto px-4">
          {/* Back button */}
          <Link to="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <BackArrow className="w-4 h-4" />
              {dp.backToHome}
            </Button>
          </Link>

          {/* Page header */}
          <div className="text-center mb-16">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-4">
              {dp.title}
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {dp.subtitle}
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-cyan-500 to-sky-500 mx-auto rounded-full mt-6" />
          </div>

          {/* Feature sections */}
          <div className="space-y-20">
            {features.map((feature, index) => {
              const isEven = index % 2 === 0;
              return (
                <React.Fragment key={index}>
                  <div
                    className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-10 items-center`}
                  >
                    {/* Illustration / Icon card */}
                    <div className="md:w-1/2 flex justify-center">
                      <div className={`${feature.bgLight} rounded-3xl p-12 w-full max-w-md flex items-center justify-center shadow-sm`}>
                        <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-xl`}>
                          <feature.icon className="w-14 h-14 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Text */}
                    <div className="md:w-1/2 space-y-4">
                      <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                        {feature.title}
                      </h2>
                      <p className="text-slate-600 text-lg leading-relaxed">
                        {feature.description}
                      </p>
                      <ul className="space-y-2">
                        {feature.bullets.map((bullet, i) => (
                          <li key={i} className="flex items-center gap-3 text-slate-700">
                            <span className={`w-2 h-2 rounded-full bg-gradient-to-br ${feature.color} flex-shrink-0`} />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* iPhone screenshot after Live Stream section */}
                  {index === 0 && (
                    <div className="flex justify-center py-4">
                      <IPhoneFrame>
                        <img
                          src={isRTL ? dashboardScreenshotHe : dashboardScreenshotEn}
                          alt={isRTL ? 'צילום מסך של האפליקציה - לחץ התחל' : 'App screenshot - tap Start'}
                          className="w-full h-auto"
                        />
                      </IPhoneFrame>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FeaturesDetail;

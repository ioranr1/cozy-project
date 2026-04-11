import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Video, Bell, Mic, Cloud, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import dashboardScreenshotHe from '@/assets/dashboard-mobile-highlighted.png';
import dashboardScreenshotEn from '@/assets/dashboard-mobile-en-highlighted.png';
import viewerScreenshotHe from '@/assets/viewer-screen-final.png';
import viewerScreenshotEn from '@/assets/viewer-screen-en.png';
import motionStep1He from '@/assets/motion-step1-dashboard.png';
import motionStep1En from '@/assets/motion-step1-dashboard-en.png';
import motionStep2He from '@/assets/motion-step2-settings.png';
import motionStep2En from '@/assets/motion-step2-settings-en.png';
import motionStep3He from '@/assets/motion-step3-alert.png';
import motionStep3En from '@/assets/motion-step3-alert-en.png';

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

                  {/* Flow diagram: Start screen → Viewer screen */}
                  {index === 0 && (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 py-8">
                      {/* First iPhone - Start screen */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-slate-600 mb-3">
                          {isRTL ? 'לחץ על "התחל"' : 'Tap "Start"'}
                        </p>
                        <IPhoneFrame>
                          <div className="w-full" style={{ height: 540 }}>
                            <img
                              src={isRTL ? dashboardScreenshotHe : dashboardScreenshotEn}
                              alt={isRTL ? 'מסך התחלה' : 'Start screen'}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </IPhoneFrame>
                      </div>

                      {/* Dashed connector line */}
                      <div className="flex items-center justify-center py-4 md:py-0 md:px-2">
                        {/* Vertical dashed line for mobile */}
                        <div className="md:hidden flex flex-col items-center gap-1">
                          <div className="w-0.5 h-8 border-l-2 border-dashed border-cyan-400" />
                          <ArrowRight className={`w-5 h-5 text-cyan-400 rotate-90`} />
                        </div>
                        {/* Horizontal dashed line for desktop */}
                        <div className="hidden md:flex items-center gap-1">
                          <div className="h-0.5 w-16 border-t-2 border-dashed border-cyan-400" />
                          <ArrowRight className={`w-5 h-5 text-cyan-400 ${isRTL ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Second iPhone - Viewer screen */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-slate-600 mb-3">
                          {isRTL ? 'צפייה בשידור חי' : 'Live Viewing'}
                        </p>
                        <IPhoneFrame>
                          <div className="w-full" style={{ height: 540 }}>
                            <img
                              src={isRTL ? viewerScreenshotHe : viewerScreenshotEn}
                              alt={isRTL ? 'מסך צפייה בשידור חי' : 'Live viewer screen'}
                              className="w-full h-full object-cover object-top"
                              loading="lazy"
                            />
                          </div>
                        </IPhoneFrame>
                      </div>
                    </div>
                  )}

                  {/* Motion Detection flow: 3 iPhone screens */}
                  {index === 1 && (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 py-8">
                      {/* Step 1 - Enable security system */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-slate-600 mb-3 text-center">
                          {isRTL ? 'הפעל מערכת אבטחה' : 'Enable Security System'}
                        </p>
                        <IPhoneFrame>
                          <div className="w-full" style={{ height: 540 }}>
                            <img
                              src={isRTL ? motionStep1He : motionStep1En}
                              alt={isRTL ? 'הפעלת מערכת אבטחה' : 'Enable security system'}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </IPhoneFrame>
                      </div>

                      {/* Arrow 1→2 */}
                      <div className="flex items-center justify-center py-4 md:py-0">
                        <div className="md:hidden flex flex-col items-center gap-1">
                          <div className="w-0.5 h-8 border-l-2 border-dashed border-orange-400" />
                          <ArrowRight className="w-5 h-5 text-orange-400 rotate-90" />
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                          <div className="h-0.5 w-10 border-t-2 border-dashed border-orange-400" />
                          <ArrowRight className={`w-5 h-5 text-orange-400 ${isRTL ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Step 2 - Enable motion detection */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-slate-600 mb-3 text-center">
                          {isRTL ? 'בחר כפתור זיהוי תנועה והפעל ניטור' : 'Enable Motion Detection'}
                        </p>
                        <IPhoneFrame>
                          <div className="w-full" style={{ height: 540 }}>
                            <img
                              src={isRTL ? motionStep2He : motionStep2En}
                              alt={isRTL ? 'הגדרות ניטור' : 'Monitoring settings'}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </IPhoneFrame>
                      </div>

                      {/* Arrow 2→3 */}
                      <div className="flex items-center justify-center py-4 md:py-0">
                        <div className="md:hidden flex flex-col items-center gap-1">
                          <div className="w-0.5 h-8 border-l-2 border-dashed border-orange-400" />
                          <ArrowRight className="w-5 h-5 text-orange-400 rotate-90" />
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                          <div className="h-0.5 w-10 border-t-2 border-dashed border-orange-400" />
                          <ArrowRight className={`w-5 h-5 text-orange-400 ${isRTL ? 'rotate-180' : ''}`} />
                        </div>
                      </div>

                      {/* Step 3 - Alert snapshot */}
                      <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-slate-600 mb-3 text-center">
                          {isRTL ? 'קבל התראה ב-WhatsApp עם סנפשוט' : 'Alert via WhatsApp with Snapshot'}
                        </p>
                        <IPhoneFrame>
                          <div className="w-full" style={{ height: 540 }}>
                            <img
                              src={isRTL ? motionStep3He : motionStep3En}
                              alt={isRTL ? 'התראת זיהוי תנועה' : 'Motion detection alert'}
                              className="w-full h-full object-cover object-top"
                            />
                          </div>
                        </IPhoneFrame>
                      </div>
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

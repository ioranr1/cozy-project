import React from 'react';
import { Header } from '@/components/layout/Header';
import dashboardDownloadImg from '@/assets/dashboard-download-example.png';
import dashboardDownloadEnImg from '@/assets/installation-download-en.png';
import installationSetupImg from '@/assets/installation-setup-example.png';
import devicesButtonImg from '@/assets/devices-button-example.png';
import devicesButtonEnImg from '@/assets/devices-button-example-en.png';
import pairCameraButtonImg from '@/assets/pair-camera-button-example.png';
import pairCameraButtonEnImg from '@/assets/pair-camera-button-example-en.png';
import pairingCodeExampleImg from '@/assets/pairing-code-example.png';
import pairingCodeExampleEnImg from '@/assets/pairing-code-example-en.png';
import trayIconImg from '@/assets/tray-icon-example.png';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Monitor, Smartphone, Shield, CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const InstallationGuide: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const guide = t.installationGuide;

  const steps = [
    {
      icon: Download,
      title: guide.steps.download.title,
      description: guide.steps.download.description,
      details: guide.steps.download.details,
    },
    {
      icon: Monitor,
      title: guide.steps.install.title,
      description: guide.steps.install.description,
      details: guide.steps.install.details,
    },
    {
      icon: Shield,
      title: guide.steps.setup.title,
      description: guide.steps.setup.description,
      details: guide.steps.setup.details,
    },
    {
      icon: Smartphone,
      title: guide.steps.connect.title,
      description: guide.steps.connect.description,
      details: guide.steps.connect.details,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-8 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back button */}
          <Link to="/">
            <Button variant="ghost" className="mb-6 text-slate-600 hover:text-slate-800">
              {isRTL ? <ArrowRight className="w-4 h-4 ml-2" /> : <ArrowLeft className="w-4 h-4 mr-2" />}
              {guide.backToHome}
            </Button>
          </Link>

          {/* Title */}
          <div className="text-center mb-16">
            <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-4">
              {guide.title}
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {guide.subtitle}
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-cyan-500 to-sky-500 mx-auto rounded-full mt-6" />
          </div>

          {/* Steps */}
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-6">
                  {/* Step number + icon */}
                  <div className="flex-shrink-0">
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                      <step.icon className="w-8 h-8 text-white" />
                      <span className={`absolute -top-2 ${isRTL ? '-left-2' : '-right-2'} w-7 h-7 bg-white border-2 border-cyan-500 rounded-full flex items-center justify-center text-cyan-600 font-bold text-xs shadow`}>
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {step.description}
                    </p>
                    {/* Details list */}
                    <ul className="space-y-2">
                      {step.details.map((detail: string, i: number) => (
                        <React.Fragment key={i}>
                          <li className="flex items-start gap-2 text-slate-600">
                            <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                            <span className="flex items-center gap-2 flex-wrap">
                              {detail}
                              {index === 2 && i === 3 && (
                                <img
                                  src={trayIconImg}
                                  alt={isRTL ? 'איקון סרגל המשימות' : 'Taskbar icon'}
                                  className="inline-block w-6 h-6"
                                />
                              )}
                            </span>
                          </li>
                          {/* Show dashboard download image after "בדף לוח הבקרה" detail in the first step */}
                          {index === 0 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? dashboardDownloadImg : dashboardDownloadEnImg}
                                alt={isRTL ? 'דוגמה לכפתור הורדה בלוח הבקרה' : 'Dashboard download button example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show installation setup image after first detail in step 2 */}
                          {index === 1 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={installationSetupImg}
                                alt={isRTL ? 'דוגמה למסך התקנה' : 'Installation setup screen example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show devices button image after first detail in step 3 */}
                          {index === 2 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? devicesButtonImg : devicesButtonEnImg}
                                alt={isRTL ? 'דוגמה לכפתור מכשירים בדשבורד' : 'Devices button in dashboard example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show pair camera button image after second detail in step 3 */}
                          {index === 2 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? pairCameraButtonImg : pairCameraButtonEnImg}
                                alt={isRTL ? 'דוגמה לכפתור צימוד מצלמה חדשה' : 'Pair new camera button example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show pairing code example image after third detail in step 3 */}
                          {index === 2 && i === 2 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? pairingCodeExampleImg : pairingCodeExampleEnImg}
                                alt={isRTL ? 'דוגמה לקוד צימוד' : 'Pairing code example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                        </React.Fragment>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InstallationGuide;

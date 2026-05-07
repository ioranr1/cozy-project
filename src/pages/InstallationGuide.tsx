import React, { useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import dashboardDownloadImg from '@/assets/dashboard-download-example.png';
import dashboardDownloadEnImg from '@/assets/installation-download-en.png';
import dashboardDownloadMacImg from '@/assets/installation-download-mac.png';
import macInstallDmgImg from '@/assets/mac-install-dmg.png';
import macApplicationsIconImg from '@/assets/mac-applications-icon.png';
import installationSetupImg from '@/assets/installation-setup-example.png';
import devicesButtonImg from '@/assets/devices-button-example.png';
import devicesButtonEnImg from '@/assets/devices-button-example-en.png';
import pairCameraButtonImg from '@/assets/pair-camera-button-example.png';
import pairCameraButtonEnImg from '@/assets/pair-camera-button-example-en.png';
import pairingCodeExampleImg from '@/assets/pairing-code-example.png';
import pairingCodeExampleEnImg from '@/assets/pairing-code-example-en.png';
import trayIconImg from '@/assets/tray-icon-example.png';
import pasteCodeImg from '@/assets/paste-code-connect.png';
import pasteCodeEnImg from '@/assets/paste-code-connect-en.png';
import trayBlueBadgeImg from '@/assets/tray-icon-blue-badge.png';
import trayUpdateMenuImg from '@/assets/tray-update-menu.png';
import smartscreen1Img from '@/assets/win-smartscreen-1-marked.png';
import smartscreen2Img from '@/assets/win-smartscreen-2-marked.png';
import continueToPairingHeImg from '@/assets/continue-to-pairing-he.png';
import continueToPairingEnImg from '@/assets/continue-to-pairing-en.png';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Monitor, Smartphone, Shield, CheckCircle, ArrowLeft, ArrowRight, RefreshCw, AlertTriangle, Link2, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { detectDesktopPlatform } from '@/lib/desktopAgentDownloads';

const InstallationGuide: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const guide = t.installationGuide;
  const detectedOs = useMemo(() => detectDesktopPlatform(), []);
  const [osTab, setOsTab] = useState<'windows' | 'mac'>(detectedOs === 'mac' ? 'mac' : 'windows');

  const windowsSteps = [
    {
      id: 'download',
      icon: Download,
      title: guide.steps.download.title,
      description: guide.steps.download.description,
      details: guide.steps.download.details,
    },
    {
      id: 'smartscreen',
      icon: AlertTriangle,
      title: guide.steps.smartscreen.title,
      description: guide.steps.smartscreen.description,
      details: guide.steps.smartscreen.details,
    },
    {
      id: 'install',
      icon: Monitor,
      title: guide.steps.install.title,
      description: guide.steps.install.description,
      details: guide.steps.install.details,
    },
    {
      id: 'afterInstall',
      icon: Link2,
      title: guide.steps.afterInstall.title,
      description: guide.steps.afterInstall.description,
      details: guide.steps.afterInstall.details,
    },
    {
      id: 'setup',
      icon: Shield,
      title: guide.steps.setup.title,
      description: guide.steps.setup.description,
      details: guide.steps.setup.details,
    },
    {
      id: 'connect',
      icon: Smartphone,
      title: guide.steps.connect.title,
      description: guide.steps.connect.description,
      details: guide.steps.connect.details,
    },
    {
      id: 'update',
      icon: RefreshCw,
      title: guide.steps.update.title,
      description: guide.steps.update.description,
      details: guide.steps.update.details,
    },
  ];

  const macSteps = [
    {
      id: 'download',
      icon: Download,
      title: guide.macSteps.download.title,
      description: guide.macSteps.download.description,
      details: guide.macSteps.download.details,
    },
    {
      id: 'install',
      icon: Apple,
      title: guide.macSteps.install.title,
      description: guide.macSteps.install.description,
      details: guide.macSteps.install.details,
    },
    {
      id: 'openFromApplications',
      icon: Apple,
      title: guide.macSteps.openFromApplications.title,
      description: guide.macSteps.openFromApplications.description,
      details: guide.macSteps.openFromApplications.details,
    },
    {
      id: 'gatekeeper',
      icon: AlertTriangle,
      title: guide.macSteps.gatekeeper.title,
      description: guide.macSteps.gatekeeper.description,
      details: guide.macSteps.gatekeeper.details,
    },
    {
      id: 'afterInstall',
      icon: Link2,
      title: guide.macSteps.afterInstall.title,
      description: guide.macSteps.afterInstall.description,
      details: guide.macSteps.afterInstall.details,
    },
    {
      id: 'setup',
      icon: Shield,
      title: guide.macSteps.setup.title,
      description: guide.macSteps.setup.description,
      details: guide.macSteps.setup.details,
    },
    {
      id: 'connect',
      icon: Smartphone,
      title: guide.steps.connect.title,
      description: guide.steps.connect.description,
      details: guide.steps.connect.details,
    },
    {
      id: 'update',
      icon: RefreshCw,
      title: guide.steps.update.title,
      description: guide.steps.update.description,
      details: guide.steps.update.details,
    },
  ];

  const steps = osTab === 'mac' ? macSteps : windowsSteps;
  const showWindowsImages = osTab === 'windows';

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

          {/* Two steps overview */}
          <div className="mb-12 bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-200 rounded-2xl p-6 md:p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
              {guide.twoStepsTitle}
            </h2>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                <Monitor className="w-6 h-6 text-cyan-600" />
                <span>{guide.twoStepsLaptop}</span>
              </div>
              <div className="hidden md:block w-px h-8 bg-cyan-300" />
              <div className="flex items-center gap-3 text-slate-700 text-lg font-medium">
                <Smartphone className="w-6 h-6 text-cyan-600" />
                <span>{guide.twoStepsPhone}</span>
              </div>
            </div>
          </div>

          {/* OS Tabs */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex bg-slate-100 border border-slate-200 rounded-2xl p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setOsTab('windows')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  osTab === 'windows'
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/30'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-5 h-5" />
                {guide.osTabs.windows}
              </button>
              <button
                type="button"
                onClick={() => setOsTab('mac')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold transition-all ${
                  osTab === 'mac'
                    ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/30'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Apple className="w-5 h-5" />
                {guide.osTabs.mac}
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-12">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
              {index === 0 && (
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3 border-b-2 border-cyan-200 pb-3">
                  <Monitor className="w-7 h-7 text-cyan-600" />
                  {guide.sectionLaptopTitle}
                </h2>
              )}
              {step.id === 'connect' && (
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3 border-b-2 border-cyan-200 pb-3 pt-4">
                  <Smartphone className="w-7 h-7 text-cyan-600" />
                  {guide.sectionPhoneTitle}
                </h2>
              )}
              {step.id === 'update' && (
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3 border-b-2 border-cyan-200 pb-3 pt-4">
                  <RefreshCw className="w-7 h-7 text-cyan-600" />
                  {guide.sectionGeneralTitle}
                </h2>
              )}
              <div
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
                            <span className="flex items-center gap-1 flex-wrap">
                              {index === 4 && i === 3 ? (
                                <>
                                  {detail.split(',')[0]}
                                  {showWindowsImages && (
                                    <img
                                      src={trayIconImg}
                                      alt={isRTL ? 'איקון סרגל המשימות' : 'Taskbar icon'}
                                      className="inline-block w-12 h-12 align-middle"
                                    />
                                  )}
                                  ,{detail.split(',').slice(1).join(',')}
                                </>
                              ) : (
                                detail
                              )}
                            </span>
                          </li>
                          {/* Show dashboard download image after "בדף לוח הבקרה" detail in the first step */}
                          {showWindowsImages && index === 0 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? dashboardDownloadImg : dashboardDownloadEnImg}
                                alt={isRTL ? 'דוגמה לכפתור הורדה בלוח הבקרה' : 'Dashboard download button example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {!showWindowsImages && index === 0 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={dashboardDownloadMacImg}
                                alt={isRTL ? 'דוגמה לכפתור הורדה ל-Mac בלוח הבקרה' : 'Mac download button in dashboard example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {!showWindowsImages && index === 1 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={macInstallDmgImg}
                                alt={isRTL ? 'גרור את האפליקציה לתיקיית Applications' : 'Drag the app to the Applications folder'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show SmartScreen images for the new Windows warning step */}
                          {showWindowsImages && index === 1 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={smartscreen1Img}
                                alt={isRTL ? 'אזהרת SmartScreen - לחץ More info' : 'SmartScreen warning - click More info'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {showWindowsImages && index === 1 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={smartscreen2Img}
                                alt={isRTL ? 'אזהרת SmartScreen - לחץ Run anyway' : 'SmartScreen warning - click Run anyway'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show installation setup image after first detail in step 3 (install) */}
                          {showWindowsImages && index === 2 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={installationSetupImg}
                                alt={isRTL ? 'דוגמה למסך התקנה' : 'Installation setup screen example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* New "After Installation" step image */}
                          {index === 3 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? continueToPairingHeImg : continueToPairingEnImg}
                                alt={isRTL ? 'לחץ על המשך לצימוד' : 'Click Continue to Pairing'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-sm"
                              />
                            </li>
                          )}
                          {/* Show devices button image after first detail in setup step */}
                          {index === 4 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? devicesButtonImg : devicesButtonEnImg}
                                alt={isRTL ? 'דוגמה לכפתור מכשירים בדשבורד' : 'Devices button in dashboard example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {index === 4 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? pairCameraButtonImg : pairCameraButtonEnImg}
                                alt={isRTL ? 'דוגמה לכפתור צימוד מצלמה חדשה' : 'Pair new camera button example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {index === 4 && i === 2 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? pairingCodeExampleImg : pairingCodeExampleEnImg}
                                alt={isRTL ? 'דוגמה לקוד צימוד' : 'Pairing code example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {index === 4 && i === 3 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={isRTL ? pasteCodeImg : pasteCodeEnImg}
                                alt={isRTL ? 'דוגמה להדבקת קוד והתחברות' : 'Paste code and connect example'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-lg"
                              />
                            </li>
                          )}
                          {/* Show blue badge tray icon image after first detail in update step */}
                          {showWindowsImages && index === 6 && i === 0 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={trayBlueBadgeImg}
                                alt={isRTL ? 'אייקון עם תג כחול לעדכון' : 'Tray icon with blue update badge'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-2xl"
                              />
                            </li>
                          )}
                          {showWindowsImages && index === 6 && i === 1 && (
                            <li className="mt-3 mb-1">
                              <img
                                src={trayUpdateMenuImg}
                                alt={isRTL ? 'תפריט עדכון גרסה' : 'Version update menu'}
                                className="rounded-xl border border-slate-200 shadow-sm max-w-full md:max-w-xs"
                              />
                            </li>
                          )}
                        </React.Fragment>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InstallationGuide;

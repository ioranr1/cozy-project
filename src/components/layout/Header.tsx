import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X, Camera } from 'lucide-react';

export const Header: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/20 to-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <nav className={`flex items-center justify-between h-16 md:h-20 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Logo */}
          <Link to="/" className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-xl font-bold text-white">SecureCam</span>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className={`hidden md:flex items-center gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <a href="#features" className="text-white/80 hover:text-white transition-colors font-medium">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-white/80 hover:text-white transition-colors font-medium">
              {t.nav.howItWorks}
            </a>
          </div>

          {/* Actions */}
          <div className={`hidden md:flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Link to="/register">
              <Button className="bg-white hover:bg-gray-100 text-slate-800 rounded-full px-6 font-semibold shadow-lg">
                {isRTL ? 'התחל עכשיו' : 'Get Started'}
              </Button>
            </Link>
            <LanguageSwitcher />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-lg rounded-2xl mt-2 p-6 space-y-4 shadow-lg">
            <a
              href="#features"
              className="block text-slate-600 hover:text-slate-900 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              {t.nav.features}
            </a>
            <a
              href="#how-it-works"
              className="block text-slate-600 hover:text-slate-900 py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              {t.nav.howItWorks}
            </a>
            <hr className="border-slate-200" />
            <div className="flex items-center justify-between">
              <LanguageSwitcher />
            </div>
            <Link to="/register" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600">
                {isRTL ? 'התחל עכשיו' : 'Get Started'}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

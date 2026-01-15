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
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SecureCam</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-white/90 hover:text-white transition-colors">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-white/90 hover:text-white transition-colors">
              {t.nav.howItWorks}
            </a>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/register">
              <Button className="bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-full px-6">
                {t.hero.cta}
              </Button>
            </Link>
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
            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-slate-600 hover:bg-slate-100">
                {t.nav.login}
              </Button>
            </Link>
            <Link to="/register" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full bg-blue-500 hover:bg-blue-600">
                {t.nav.register}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

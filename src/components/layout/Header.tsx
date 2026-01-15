import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">AIGuard</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors">
              {t.nav.howItWorks}
            </a>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                {t.nav.login}
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-cyan-500 hover:bg-cyan-600">
                {t.nav.register}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-700 p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-lg rounded-2xl mt-2 p-6 space-y-4 shadow-lg border border-slate-200">
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
              <Button className="w-full bg-cyan-500 hover:bg-cyan-600">
                {t.nav.register}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

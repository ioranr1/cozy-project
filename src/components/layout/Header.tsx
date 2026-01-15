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
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AIGuard</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-white/80 hover:text-white transition-colors">
              {t.nav.features}
            </a>
            <a href="#how-it-works" className="text-white/80 hover:text-white transition-colors">
              {t.nav.howItWorks}
            </a>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:text-primary hover:bg-white/10">
                {t.nav.login}
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-primary hover:bg-primary/90">
                {t.nav.register}
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
          <div className="md:hidden bg-black/95 backdrop-blur-lg rounded-2xl mt-2 p-6 space-y-4">
            <a
              href="#features"
              className="block text-white/80 hover:text-white py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              {t.nav.features}
            </a>
            <a
              href="#how-it-works"
              className="block text-white/80 hover:text-white py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              {t.nav.howItWorks}
            </a>
            <hr className="border-white/20" />
            <div className="flex items-center justify-between">
              <LanguageSwitcher />
            </div>
            <Link to="/login" onClick={() => setIsMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-white hover:bg-white/10">
                {t.nav.login}
              </Button>
            </Link>
            <Link to="/register" onClick={() => setIsMenuOpen(false)}>
              <Button className="w-full bg-primary hover:bg-primary/90">
                {t.nav.register}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

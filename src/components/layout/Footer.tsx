import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield } from 'lucide-react';

export const Footer = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => {
  const { t, isRTL } = useLanguage();

  return (
    <footer ref={ref} {...props} className="bg-slate-800 border-t border-slate-700 py-12">
      <div className="container mx-auto px-4">
        {/* Contact us */}
        <div className="text-center mb-8 pb-8 border-b border-slate-700">
          <h3 className="text-white font-semibold text-lg mb-2">
            {t.footer.contactTitle}
          </h3>
          <p className="text-white/70 text-sm">
            {t.footer.contactText}{' '}
            <a
              href="mailto:ioranr1@gmail.com"
              className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
              dir="ltr"
            >
              ioranr1@gmail.com
            </a>
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AIGuard</span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6 text-white/60">
            <a href="#" className="hover:text-white transition-colors">
              {t.footer.privacy}
            </a>
            <a href="#" className="hover:text-white transition-colors">
              {t.footer.terms}
            </a>
          </div>

          {/* Copyright */}
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} AIGuard. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

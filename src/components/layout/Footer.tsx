import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Mail } from 'lucide-react';

export const Footer = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => {
  const { t, isRTL } = useLanguage();

  return (
    <footer ref={ref} {...props} className="bg-slate-800 border-t border-slate-700 py-12">
      <div className="container mx-auto px-4">
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
            <Link to="/terms" className="hover:text-white transition-colors">
              {t.footer.terms}
            </Link>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.footer.contactTitle}
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-cyan-500" />
                    {t.footer.contactTitle}
                  </DialogTitle>
                  <DialogDescription className="pt-2 text-base">
                    {t.footer.contactText}{' '}
                    <a
                      href="mailto:ioranr1@gmail.com"
                      className="text-cyan-600 hover:text-cyan-700 font-medium underline"
                      dir="ltr"
                    >
                      ioranr1@gmail.com
                    </a>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
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

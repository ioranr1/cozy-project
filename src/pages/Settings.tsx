// Settings v1.0.0 — General, Account, Plan
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import {
  Info,
  Mail,
  User,
  Languages,
  Phone,
  Shield,
  Trash2,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
} from 'lucide-react';

// Electron app version — keep in sync with electron-webrtc-example/package.json
const ELECTRON_APP_VERSION = '2.52.0';
const SUPPORT_EMAIL = 'ioranr1@gmail.com';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  country_code: string;
  preferred_language?: string;
}

const Settings: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      setProfile(JSON.parse(stored));
    } catch {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  if (!profile) {
    return null;
  }

  const s = t.settings;

  return (
    <AppLayout>
      <DashboardHeader
        userFullName={profile.full_name}
        title={s.title}
        subtitle={s.subtitle}
      />

      <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* ============ Section 1: General ============ */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <SettingsIcon className="w-5 h-5 text-primary" />
              {s.general.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* App Version */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-900/40">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-white font-medium">{s.general.appVersion}</div>
                  <div className="text-white/50 text-xs mt-0.5">
                    {s.general.appVersionHint}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="bg-slate-800 border-primary/30 text-primary font-mono">
                v{ELECTRON_APP_VERSION}
              </Badge>
            </div>

            {/* Support */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-900/40">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-white font-medium">{s.general.support}</div>
                  <div className="text-white/50 text-xs mt-0.5">
                    {s.general.supportHint}
                  </div>
                </div>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-emerald-400 hover:text-emerald-300 font-mono text-sm underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* ============ Section 2: Account ============ */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="w-5 h-5 text-primary" />
              {s.account.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-white/50 italic px-1">
              {s.account.readOnlyNotice}
            </div>

            <ReadOnlyField
              icon={<User className="w-4 h-4 text-white/60" />}
              label={s.account.fullName}
              value={profile.full_name}
            />
            <ReadOnlyField
              icon={<Mail className="w-4 h-4 text-white/60" />}
              label={s.account.email}
              value={profile.email}
            />
            <ReadOnlyField
              icon={<Phone className="w-4 h-4 text-white/60" />}
              label={s.account.phone}
              value={`${profile.country_code} ${profile.phone_number}`}
              dir="ltr"
            />
            <ReadOnlyField
              icon={<Languages className="w-4 h-4 text-white/60" />}
              label={s.account.language}
              value={language === 'he' ? s.account.languageHe : s.account.languageEn}
            />

            {/* Danger Zone */}
            <div className="pt-4 border-t border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold text-sm">
                  {s.account.deleteSection}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="text-white/70 text-sm">
                  {s.account.deleteHint}
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {s.account.deleteButton}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============ Section 3: Plan ============ */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-primary" />
              {s.plan.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
              <div className="text-white/70">{s.plan.currentPlan}</div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-base px-3 py-1">
                {s.plan.free}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </AppLayout>
  );
};

interface ReadOnlyFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}

const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({ icon, label, value, dir }) => (
  <div className="space-y-1.5">
    <Label className="text-white/60 text-xs flex items-center gap-1.5">
      {icon}
      {label}
    </Label>
    <div
      className="px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-white/90 text-sm select-text"
      dir={dir}
    >
      {value}
    </div>
  </div>
);

export default Settings;

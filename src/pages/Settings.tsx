// Settings v1.3.0 — General, Account, Plan + PWA version from DB
// SSOT: profile data loaded directly via validate_user_session RPC (SECURITY DEFINER, bypasses RLS).
// PWA version is loaded from pwa_versions table (managed via Admin Console).
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog';
import { usePwaVersion } from '@/hooks/usePwaVersion';
import { DESKTOP_AGENT_VERSION } from '@/lib/desktopAgentDownloads';
import {
  Info,
  Mail,
  User,
  Languages,
  Phone,
  Shield,
  Trash2,
  Settings as SettingsIcon,
  Sparkles,
  Loader2,
  Smartphone,
  Calendar,
} from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { currentVersion: pwaVersion, loading: pwaLoading } = usePwaVersion(true);

  useEffect(() => {
    let cancelled = false;

    const loadProfileFromDb = async () => {
      try {
        // 1. Validate session via SSOT — RPC returns profile_data with SECURITY DEFINER (bypasses RLS)
        const sessionToken = localStorage.getItem('aiguard_session_token');
        if (!sessionToken) {
          navigate('/login', { replace: true });
          return;
        }

        const { data: sessionData, error: sessionErr } = await supabase.rpc(
          'validate_user_session',
          { p_token: sessionToken }
        );

        if (sessionErr || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
          console.warn('[Settings] Invalid session, redirecting to login');
          localStorage.removeItem('userProfile');
          localStorage.removeItem('aiguard_session_token');
          navigate('/login', { replace: true });
          return;
        }

        const pd = sessionData[0].profile_data as any;
        if (!pd || !pd.id) {
          console.error('[Settings] Profile data missing in session response');
          navigate('/login', { replace: true });
          return;
        }

        // 2. Build profile from RPC response (SSOT). preferred_language not in RPC — fallback to current language.
        const profileFromRpc: UserProfile = {
          id: pd.id,
          full_name: pd.full_name || '',
          email: pd.email || '',
          phone_number: pd.phone_number || '',
          country_code: pd.country_code || '+972',
          preferred_language: pd.preferred_language || language,
        };

        if (!cancelled) {
          setProfile(profileFromRpc);
          // Refresh localStorage cache so other pages see the latest data too
          localStorage.setItem('userProfile', JSON.stringify(profileFromRpc));
          setLoading(false);
        }
      } catch (e) {
        console.error('[Settings] Load error:', e);
        if (!cancelled) navigate('/login', { replace: true });
      }
    };

    loadProfileFromDb();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading || !profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
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
                v{DESKTOP_AGENT_VERSION}
              </Badge>
            </div>

            {/* PWA Web Version (managed from DB) */}
            <div className="p-3 rounded-lg bg-slate-900/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">
                      {language === 'he' ? 'גרסת אפליקציה (Web/PWA)' : 'App Version (Web/PWA)'}
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">
                      {language === 'he'
                        ? 'הגרסה הנוכחית של האתר והאפליקציה במובייל'
                        : 'Current version of the website and mobile app'}
                    </div>
                  </div>
                </div>
                {pwaLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                ) : pwaVersion ? (
                  <Badge variant="outline" className="bg-slate-800 border-cyan-500/30 text-cyan-400 font-mono">
                    v{pwaVersion.version}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-slate-800 border-slate-600 text-white/50 font-mono">
                    —
                  </Badge>
                )}
              </div>
              {pwaVersion && (pwaVersion.changelog_he || pwaVersion.changelog_en) && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-white/60 text-xs">
                      {language === 'he' ? 'מה חדש' : "What's new"} · {' '}
                      {new Date(pwaVersion.released_at).toLocaleDateString(
                        language === 'he' ? 'he-IL' : 'en-US',
                        { day: '2-digit', month: '2-digit', year: 'numeric' }
                      )}
                    </span>
                  </div>
                  <div
                    className="text-white/70 text-xs whitespace-pre-line"
                    dir={language === 'he' ? 'rtl' : 'ltr'}
                  >
                    {language === 'he'
                      ? pwaVersion.changelog_he || pwaVersion.changelog_en
                      : pwaVersion.changelog_en || pwaVersion.changelog_he}
                  </div>
                </div>
              )}
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

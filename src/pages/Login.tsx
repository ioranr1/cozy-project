import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { countries } from '@/i18n/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, ArrowLeft, ArrowRight, Phone, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { hasSessionToken } from '@/hooks/useSession';

const SESSION_TOKEN_KEY = 'aiguard_session_token';

const loginSchema = z.object({
  phone: z.string().min(7, 'Phone number must be at least 7 digits').max(15).regex(/^\d+$/, 'Phone must contain only numbers'),
});

const Login: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    countryCode: '+972',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otpValue, setOtpValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Check for existing valid session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      if (!hasSessionToken()) {
        setIsCheckingSession(false);
        return;
      }

      try {
        const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
        const response = await fetch(
          `https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/validate-session`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: sessionToken }),
          }
        );

        const data = await response.json();

        if (data.valid && data.profile) {
          // Session is valid, redirect to dashboard
          localStorage.setItem('userProfile', JSON.stringify({
            id: data.profile.id,
            fullName: data.profile.full_name,
            email: data.profile.email,
            phone: `${data.profile.country_code}${data.profile.phone_number}`,
            phoneVerified: data.profile.phone_verified,
          }));
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Session check error:', error);
      }

      setIsCheckingSession(false);
    };

    checkExistingSession();
  }, [navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({
      phone: formData.phone,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // First check if user exists
      const checkResponse = await fetch(
        `https://zoripeohnedivxkvrpbi.supabase.co/rest/v1/profiles?phone_number=eq.${formData.phone}&country_code=eq.${encodeURIComponent(formData.countryCode)}&select=id`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo',
          }
        }
      );

      const profiles = await checkResponse.json();
      
      if (!profiles || profiles.length === 0) {
        toast({
          title: language === 'he' ? 'מספר לא נמצא' : 'Number not found',
          description: language === 'he' ? 'המספר לא רשום במערכת. אנא הירשם תחילה' : 'This number is not registered. Please register first',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // User exists, send OTP
      const response = await fetch(
        `https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/whatsapp-send-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: formData.phone,
            country_code: formData.countryCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      toast({
        title: language === 'he' ? 'קוד נשלח!' : 'Code sent!',
        description: language === 'he' ? 'בדוק את הוואטסאפ שלך' : 'Check your WhatsApp',
      });

      setStep('otp');
    } catch (error: unknown) {
      console.error('Send OTP error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      toast({
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) return;

    setIsVerifying(true);

    try {
      const response = await fetch(
        `https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/whatsapp-verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: formData.phone,
            country_code: formData.countryCode,
            code: otpValue,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      if (data.is_new_user || !data.profile) {
        toast({
          title: language === 'he' ? 'לא נמצא חשבון' : 'Account not found',
          description: language === 'he' ? 'אנא הירשם תחילה' : 'Please register first',
          variant: 'destructive',
        });
        navigate('/register');
        return;
      }

      toast({
        title: language === 'he' ? 'התחברת בהצלחה!' : 'Login successful!',
        description: language === 'he' ? `שלום ${data.profile.full_name}` : `Hello ${data.profile.full_name}`,
      });

      // Save session token for 30 days persistence
      if (data.session_token) {
        localStorage.setItem(SESSION_TOKEN_KEY, data.session_token);
      }

      localStorage.setItem('userProfile', JSON.stringify({
        id: data.profile.id,
        fullName: data.profile.full_name,
        email: data.profile.email,
        phone: `${data.profile.country_code}${data.profile.phone_number}`,
        phoneVerified: true,
      }));

      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Verify OTP error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      toast({
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setOtpValue('');
    } finally {
      setIsVerifying(false);
    }
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-white/60">{language === 'he' ? 'בודק session...' : 'Checking session...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Back Link */}
        <Link
          to={step === 'otp' ? '#' : '/'}
          onClick={(e) => {
            if (step === 'otp') {
              e.preventDefault();
              setStep('phone');
              setOtpValue('');
            }
          }}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowIcon className="w-4 h-4" />
          {step === 'otp' ? (language === 'he' ? 'שנה מספר' : 'Change number') : t.common.back}
        </Link>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">AIGuard</span>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {t.auth.login}
          </h1>
          <p className="text-white/60 text-center mb-8">
            {step === 'phone' 
              ? (language === 'he' ? 'הזן את מספר הטלפון שלך' : 'Enter your phone number')
              : (language === 'he' ? 'הזן את הקוד שקיבלת בוואטסאפ' : 'Enter the code from WhatsApp')
            }
          </p>

          {step === 'phone' ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white/80">
                  {t.auth.phone}
                </Label>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => handleChange('countryCode', value)}
                  >
                    <SelectTrigger className="w-32 bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {countries.map((country) => (
                        <SelectItem
                          key={country.code}
                          value={country.code}
                          className="text-white hover:bg-slate-700"
                        >
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.code}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-white/40`} />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                      className={`bg-slate-700/50 border-slate-600 text-white placeholder:text-white/40 ${isRTL ? 'pr-10' : 'pl-10'}`}
                      placeholder={t.auth.phoneExample}
                      dir="ltr"
                    />
                  </div>
                </div>
                {errors.phone && (
                  <p className="text-red-400 text-sm">{errors.phone}</p>
                )}
              </div>

              {/* WhatsApp Info */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                <p className="text-green-400 text-sm">
                  {language === 'he' 
                    ? '📱 תקבל קוד אימות בוואטסאפ'
                    : '📱 You will receive a verification code on WhatsApp'}
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {language === 'he' ? 'שולח...' : 'Sending...'}
                  </span>
                ) : (
                  language === 'he' ? 'שלח קוד' : 'Send Code'
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              {/* OTP Input */}
              <div className="flex justify-center" dir="ltr">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(value) => setOtpValue(value)}
                  onComplete={handleVerifyOTP}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                    <InputOTPSlot index={1} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                    <InputOTPSlot index={2} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                    <InputOTPSlot index={3} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                    <InputOTPSlot index={4} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                    <InputOTPSlot index={5} className="bg-slate-700/50 border-slate-600 text-white text-xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerifyOTP}
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg rounded-xl"
                disabled={isVerifying || otpValue.length !== 6}
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {language === 'he' ? 'מאמת...' : 'Verifying...'}
                  </span>
                ) : (
                  language === 'he' ? 'אמת' : 'Verify'
                )}
              </Button>

              {/* Resend */}
              <p className="text-center text-white/60 text-sm">
                {language === 'he' ? 'לא קיבלת קוד?' : "Didn't receive a code?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setOtpValue('');
                  }}
                  className="text-primary hover:underline"
                >
                  {language === 'he' ? 'שלח שוב' : 'Resend'}
                </button>
              </p>
            </div>
          )}

          {/* Register Link */}
          <p className="text-center text-white/60 mt-6">
            {t.auth.noAccount}{' '}
            <Link to="/register" className="text-primary hover:underline">
              {t.auth.register}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

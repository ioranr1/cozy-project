import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { countries } from '@/i18n/translations';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, ArrowLeft, ArrowRight, User, Mail, Phone, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().min(7, 'Phone number must be at least 7 digits').max(15).regex(/^\d+$/, 'Phone must contain only numbers'),
});

const Register: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    countryCode: '+972',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otpValue, setOtpValue] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse({
      fullName: formData.fullName,
      email: formData.email,
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
      // First check if user already exists
      const checkResponse = await fetch(
        `https://zoripeohnedivxkvrpbi.supabase.co/rest/v1/profiles?phone_number=eq.${formData.phone}&country_code=eq.${encodeURIComponent(formData.countryCode)}&select=id`,
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo',
          }
        }
      );

      const profiles = await checkResponse.json();
      
      if (profiles && profiles.length > 0) {
        toast({
          title: language === 'he' ? 'המספר כבר רשום' : 'Number already registered',
          description: language === 'he' ? 'עבור לעמוד ההתחברות' : 'Please go to the login page',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // User doesn't exist, send OTP for registration
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
      // Verify OTP
      const verifyResponse = await fetch(
        `https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/whatsapp-verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             phone_number: formData.phone,
             country_code: formData.countryCode,
             code: otpValue,
             full_name: formData.fullName,
             email: formData.email,
             preferred_language: language,
           }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Invalid OTP');
      }

      const profile = verifyData.profile;
      const sessionToken = verifyData.session_token;

      if (!profile || !sessionToken) {
        throw new Error(language === 'he' ? 'יצירת משתמש/סשן נכשלה' : 'Failed to create user session');
      }

      localStorage.setItem('aiguard_session_token', sessionToken);

      localStorage.setItem('userProfile', JSON.stringify({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        phone: `${profile.country_code}${profile.phone_number}`,
        phoneVerified: true,
      }));

      toast({
        title: verifyData.is_new_user
          ? (language === 'he' ? 'נרשמת בהצלחה!' : 'Registration successful!')
          : (language === 'he' ? 'התחברת בהצלחה!' : 'Login successful!'),
        description: language === 'he' ? 'ברוך הבא ל-AIGuard' : 'Welcome to AIGuard',
      });

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
              setStep('details');
              setOtpValue('');
            }
          }}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowIcon className="w-4 h-4" />
          {step === 'otp' ? (language === 'he' ? 'חזור לפרטים' : 'Back to details') : t.common.back}
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
            {t.auth.register}
          </h1>
          <p className="text-white/60 text-center mb-8">
            {step === 'details' 
              ? (language === 'he' ? 'צור חשבון חדש' : 'Create a new account')
              : (language === 'he' ? 'הזן את הקוד שקיבלת בוואטסאפ' : 'Enter the code from WhatsApp')
            }
          </p>

          {step === 'details' ? (
            <form onSubmit={handleSendOTP} className="space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-white/80">
                  {t.auth.fullName}
                </Label>
                <div className="relative">
                  <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-white/40`} />
                  <Input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className={`bg-slate-700/50 border-slate-600 text-white placeholder:text-white/40 ${isRTL ? 'pr-10' : 'pl-10'}`}
                    placeholder={language === 'he' ? 'ישראל ישראלי' : 'John Doe'}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-red-400 text-sm">{errors.fullName}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  {t.auth.email}
                </Label>
                <div className="relative">
                  <Mail className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-white/40`} />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`bg-slate-700/50 border-slate-600 text-white placeholder:text-white/40 ${isRTL ? 'pr-10' : 'pl-10'}`}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email}</p>
                )}
              </div>

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
                  language === 'he' ? 'שלח קוד אימות' : 'Send Verification Code'
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
                  language === 'he' ? 'אמת והירשם' : 'Verify & Register'
                )}
              </Button>

              {/* Resend */}
              <p className="text-center text-white/60 text-sm">
                {language === 'he' ? 'לא קיבלת קוד?' : "Didn't receive a code?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setOtpValue('');
                  }}
                  className="text-primary hover:underline"
                >
                  {language === 'he' ? 'שלח שוב' : 'Resend'}
                </button>
              </p>
            </div>
          )}

          {/* Login Link */}
          <p className="text-center text-white/60 mt-6">
            {t.auth.hasAccount}{' '}
            <Link to="/login" className="text-primary hover:underline">
              {t.auth.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

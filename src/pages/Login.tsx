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
import { Shield, ArrowLeft, ArrowRight, Phone } from 'lucide-react';
import { z } from 'zod';

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

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
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
      // Check if profile exists with this phone
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone_number', formData.phone)
        .eq('country_code', formData.countryCode);

      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        toast({
          title: language === 'he' ? 'לא נמצא חשבון' : 'Account not found',
          description: language === 'he' ? 'אנא הירשם תחילה' : 'Please register first',
          variant: 'destructive',
        });
        return;
      }

      const profile = profiles[0];

      toast({
        title: language === 'he' ? 'התחברת בהצלחה!' : 'Login successful!',
        description: language === 'he' ? `שלום ${profile.full_name}` : `Hello ${profile.full_name}`,
      });

      // Store in localStorage for now (until OTP is implemented)
      localStorage.setItem('userProfile', JSON.stringify({
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        phone: `${profile.country_code}${profile.phone_number}`,
      }));

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: error.message || (language === 'he' ? 'אירעה שגיאה בהתחברות' : 'Login failed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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
          to="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowIcon className="w-4 h-4" />
          {t.common.back}
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
            {language === 'he' ? 'הזן את מספר הטלפון שלך' : 'Enter your phone number'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white/80">
                {t.auth.phone}
              </Label>
              <div className="flex gap-2">
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

            {/* Info about OTP */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
              <p className="text-blue-400 text-sm">
                {language === 'he' 
                  ? '🔒 אימות WhatsApp OTP יופעל בקרוב'
                  : '🔒 WhatsApp OTP verification coming soon'}
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? t.auth.submitting : t.auth.login}
            </Button>
          </form>

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

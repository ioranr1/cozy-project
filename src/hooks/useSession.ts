import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const SESSION_TOKEN_KEY = 'aiguard_session_token';
const USER_PROFILE_KEY = 'userProfile';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  country_code: string;
  phone_verified: boolean;
}

interface UseSessionReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  login: (sessionToken: string, profile: UserProfile) => void;
  logout: () => void;
  validateSession: () => Promise<boolean>;
}

export const useSession = (): UseSessionReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  const login = useCallback((sessionToken: string, userProfile: UserProfile) => {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({
      id: userProfile.id,
      fullName: userProfile.full_name,
      email: userProfile.email,
      phone: `${userProfile.country_code}${userProfile.phone_number}`,
      phoneVerified: userProfile.phone_verified,
    }));
    setProfile(userProfile);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    setProfile(null);
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  const validateSession = useCallback(async (): Promise<boolean> => {
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    
    if (!sessionToken) {
      setIsAuthenticated(false);
      setProfile(null);
      setIsLoading(false);
      return false;
    }

    try {
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
        setProfile(data.profile);
        setIsAuthenticated(true);
        // Update localStorage with fresh profile data
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({
          id: data.profile.id,
          fullName: data.profile.full_name,
          email: data.profile.email,
          phone: `${data.profile.country_code}${data.profile.phone_number}`,
          phoneVerified: data.profile.phone_verified,
        }));
        setIsLoading(false);
        return true;
      } else {
        // Session invalid, clear storage
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(USER_PROFILE_KEY);
        setIsAuthenticated(false);
        setProfile(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Session validation error:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  return {
    isLoading,
    isAuthenticated,
    profile,
    login,
    logout,
    validateSession,
  };
};

export const getSessionToken = (): string | null => {
  return localStorage.getItem(SESSION_TOKEN_KEY);
};

export const hasSessionToken = (): boolean => {
  return !!localStorage.getItem(SESSION_TOKEN_KEY);
};

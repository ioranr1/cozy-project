import React from 'react';
import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { InstallationGuideButton } from '@/components/landing/InstallationGuideButton';
import { Footer } from '@/components/layout/Footer';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <InstallationGuideButton />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

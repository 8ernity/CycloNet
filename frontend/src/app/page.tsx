import { ParallaxComponent } from '@/components/ui/parallax-scrolling';
import { Navbar } from '@/components/landing/Navbar';
import { Track5MissionSection } from '@/components/landing/Track5MissionSection';
import { TrustMarquee } from '@/components/landing/TrustMarquee';
import { StatsTicker } from '@/components/landing/StatsTicker';
import { StoryDiagram } from '@/components/landing/StoryDiagram';
import { FeaturesGrid } from '@/components/landing/FeaturesGrid';
import { FeatureSpotlight1 } from '@/components/landing/FeatureSpotlight1';
import { FeatureSpotlight2 } from '@/components/landing/FeatureSpotlight2';
import { InteractiveWorkflow } from '@/components/landing/InteractiveWorkflow';
import { IntegrationsGrid } from '@/components/landing/IntegrationsGrid';
import { SecurityCompliance } from '@/components/landing/SecurityCompliance';
import { Testimonials } from '@/components/landing/Testimonials';
import { DeploymentTiers } from '@/components/landing/DeploymentTiers';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'CycloNet — AI Cyclone Impact & Infrastructure Vulnerability Forecaster',
  description: 'AI-powered predictive risk and vulnerability modeling platform utilizing Google Earth Engine satellite feeds, parametric storm surge simulation, and Gemini 3.7 Flash multimodal reasoning.',
};

export default function RootLandingPage() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary selection:bg-accent/30 selection:text-white overflow-x-hidden">
      {/* Floating Glass Navbar */}
      <Navbar />

      {/* GSAP & Lenis Multi-Layered Depth Parallax Hero (Preserved Pristine) */}
      <ParallaxComponent
        title="CYCLONET"
        pretitle="NEVER MISS A CYCLONE"
        subtitle="AI TROPICAL CYCLONE TRAJECTORY & LANDFALL INTELLIGENCE"
        layer1Src="/Galaxy.mp4"
        layer2Src="/NobgEarth.png"
        layer4Src="/Astronaut.png"
      />

      {/* Track 5 Mission & Anticipatory Action Problem / Challenge Section */}
      <Track5MissionSection />

      {/* Trust Marquee of Meteorological & Disaster Authorities */}
      <TrustMarquee />

      {/* Numerical Stats Ticker */}
      <StatsTicker />

      {/* Problem vs Solution Architecture Morphing Diagram */}
      <StoryDiagram />

      {/* 6-Module Intelligence Feature Grid */}
      <FeaturesGrid />

      {/* Feature Spotlight 1: Digital Twin Storm Surge Simulator */}
      <FeatureSpotlight1 />

      {/* Feature Spotlight 2: Explainable AI & SHAP Decompositions */}
      <FeatureSpotlight2 />

      {/* 4-Step Interactive Operational Workflow */}
      <InteractiveWorkflow />

      {/* Standards & Integrations */}
      <IntegrationsGrid />

      {/* Government Security & Reliability */}
      <SecurityCompliance />

      {/* Coastal Command Citations */}
      <Testimonials />

      {/* Jurisdiction Deployment Tiers */}
      <DeploymentTiers />

      {/* Final Call to Action */}
      <FinalCTA />

      {/* Comprehensive Footer */}
      <Footer />
    </main>
  );
}

import { ParallaxComponent } from '@/components/ui/parallax-scrolling';
import { MeshGradientBackground } from '@/components/landing/MeshGradientBackground';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
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
  title: 'CycloNet — AI Tropical Cyclone Trajectory & Landfall Intelligence',
  description: 'Next-generation AI meteorological intelligence platform for tropical cyclone tracking, deep Dvorak intensity estimation, and coastal early warning.',
};

export default function LandingParallaxPage() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary selection:bg-accent/30 selection:text-white overflow-x-hidden">
      {/* Floating Glass Navbar */}
      <Navbar />

      {/* GSAP & Lenis Multi-Layered Depth Parallax Hero */}
      <ParallaxComponent
        title="CYCLONET"
        pretitle="A SAFER TOMORROW FROM SPACE"
        subtitle="GLOBAL INTELLIGENCE FOR A RESILIENT TOMORROW"
        layer1Src="/Earth.png"
        layer2Src="/NobgEarth.png"
        layer4Src="/Astronaut.png"
      />

      {/* CrimeRakshak-Themed Interactive Intelligence Hero with Mesh Background */}
      <MeshGradientBackground>
        <Hero />
      </MeshGradientBackground>

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

import Navbar from "@/components/marketing/navbar";
import Footer from "@/components/marketing/footer";
import Background from "@/components/global/background";
import Hero from "@/components/marketing/hero";
import Socials from "@/components/marketing/socials";
import Difference from "@/components/marketing/difference";
import Workflow from "@/components/marketing/workflow";
import Capibilities from "@/components/marketing/capibilities";
import Integrations from "@/components/marketing/integrations";
import Membership from "@/components/marketing/membership";
import WallOfLove from "@/components/marketing/wall-of-love";
import Cta from "@/components/marketing/cta";
import { base, heading, handwriting } from "@/constants";
import { cn } from "@/utils";

const HomePage = () => {
    return (
        <main
            className={cn(
                "dark marketing-landing bg-background text-foreground font-base relative w-full antialiased",
                base.variable,
                heading.variable,
                handwriting.variable,
            )}
        >
            <Navbar />
            <div className="w-full min-h-dvh pt-18">
                <Background />
                <Hero />
                <Socials />
                <Difference />
                <Workflow />
                <Capibilities />
                <Integrations />
                <Membership />
                <WallOfLove />
                <Cta />
            </div>
            <Footer />
        </main>
    );
};

export default HomePage;

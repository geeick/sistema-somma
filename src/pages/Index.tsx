import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Link, Navigate } from "react-router-dom";
import { DollarSign, Upload, CheckCircle, TrendingUp } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const Index = () => {
  const [user, setUser] = useState<NeonUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNeonUser().then((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    }).catch(() => {
      setUser(null);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  const features = [
    {
      icon: Upload,
      title: "Upload Your Content",
      description: "Share videos from Instagram, TikTok, and YouTube Shorts in seconds",
    },
    {
      icon: DollarSign,
      title: "Earn Money",
      description: "Get paid based on your video views at 48 hours after submission",
    },
    {
      icon: TrendingUp,
      title: "Track Performance",
      description: "Monitor your earnings and video performance in real-time",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url(${heroBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
              Turn Songs Into Cultural Movements
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Somma Media connects Brazilian music with creators. Join campaigns, share music on TikTok, Instagram & YouTube Shorts, and earn for your impact.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" asChild className="shadow-glow">
                <Link to="/auth">Start Earning</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to start earning from your content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gradient-card border-border text-center">
                <CardHeader>
                  <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-primary border-0 text-center">
            <CardHeader className="space-y-4 pt-12">
              <CardTitle className="text-4xl font-bold text-white">
                Ready to Get Paid?
              </CardTitle>
              <CardDescription className="text-xl text-white/90">
                Join our platform today and start monetizing your social media content
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-12">
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth">Create Free Account</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Somma Media. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

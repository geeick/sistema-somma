import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import sommaLogo from "@/assets/somma-logo.png";
import { useUserRole } from "@/hooks/useUserRole";

export const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={sommaLogo} alt="Somma Media" className="h-8" />
        </Link>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link to="/">Home</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/campaigns">Campaigns</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/pages">Pages</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/wallet">Wallet</Link>
              </Button>
              {isAdmin && (
                <Button variant="secondary" asChild>
                  <Link to="/admin">Admin Console</Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

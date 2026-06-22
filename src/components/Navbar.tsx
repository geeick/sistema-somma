import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getNeonUser, signOutNeon, type NeonUser } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import sommaLogo from "@/assets/somma-logo.png";
import { useUserRole } from "@/hooks/useUserRole";

export const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    getNeonUser().then(setUser).catch(() => setUser(null));
  }, []);

  const handleSignOut = async () => {
    await signOutNeon();
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

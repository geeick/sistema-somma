import { useEffect, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type UserRoleState = {
  isAdmin: boolean;
  isLoading: boolean;
  role: string | null;
};

export function useUserRole(): UserRoleState {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkRole = async () => {
      try {
        const token = await getNeonAccessToken();

        if (!token) {
          if (!cancelled) {
            setIsAdmin(false);
            setRole(null);
          }
          return;
        }

        const res = await fetch(`${API_BASE}/api/admin/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (!cancelled) {
            setIsAdmin(false);
            setRole(null);
          }
          return;
        }

        if (!cancelled) {
          setIsAdmin(Boolean(json.data?.isAdmin));
          setRole(json.data?.role || null);
        }
      } catch (err) {
        console.error("Failed to check user role:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setRole(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    checkRole();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, isLoading, role };
}

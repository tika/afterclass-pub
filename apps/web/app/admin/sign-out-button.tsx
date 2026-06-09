"use client";

import { LogoutIcon } from "mage-icons-react/stroke";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButtonWrapper() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <Button variant="outline" className="w-full" onClick={() => void handleSignOut()}>
      <LogoutIcon className="w-4 h-4" />
      Sign Out
    </Button>
  );
}

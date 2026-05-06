import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { MySubscription } from "@workspace/api-client-react";

interface SubscriptionContextType {
  subscription: MySubscription | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/subscriptions/my`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      } else {
        setSubscription(null);
      }
    } catch (e) {
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, isLoading, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

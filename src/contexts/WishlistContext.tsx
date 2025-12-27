import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WishlistItem {
  id: string;
  product_id: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  isInWishlist: (productId: string) => boolean;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchWishlist();
    } else {
      setItems([]);
    }
  }, [userId]);

  const fetchWishlist = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('wishlist')
      .select('id, product_id')
      .eq('user_id', userId);

    if (!error && data) {
      setItems(data);
    }
    setIsLoading(false);
  };

  const isInWishlist = (productId: string) => {
    return items.some(item => item.product_id === productId);
  };

  const addToWishlist = async (productId: string) => {
    if (!userId) {
      toast({
        title: "Login Required",
        description: "Please login to add items to wishlist",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('wishlist')
      .insert({ user_id: userId, product_id: productId });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add to wishlist",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Added to Wishlist",
        description: "Product saved to your wishlist",
      });
      fetchWishlist();
    }
  };

  const removeFromWishlist = async (productId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('wishlist')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove from wishlist",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Removed from Wishlist",
        description: "Product removed from your wishlist",
      });
      fetchWishlist();
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (isInWishlist(productId)) {
      await removeFromWishlist(productId);
    } else {
      await addToWishlist(productId);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isLoading,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
};

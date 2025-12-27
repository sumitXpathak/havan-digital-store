import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { Heart, ShoppingCart, Trash2, Loader2, ShoppingBag, Star } from "lucide-react";

interface Product {
  id: string;
  name: string;
  name_hindi: string | null;
  price: number;
  original_price: number | null;
  images: string[] | null;
  rating: number | null;
  reviews_count: number | null;
  badge: string | null;
}

const Wishlist = () => {
  const navigate = useNavigate();
  const { items, removeFromWishlist, isLoading: wishlistLoading } = useWishlist();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (items.length > 0) {
      fetchProducts();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [items]);

  const fetchProducts = async () => {
    setLoading(true);
    const productIds = items.map(item => item.product_id);
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, name_hindi, price, original_price, images, rating, reviews_count, badge')
      .in('id', productIds);

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name,
      nameHindi: product.name_hindi || '',
      price: product.price,
      image: product.images?.[0] || '/placeholder.svg',
    });
  };

  if (loading || wishlistLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Your Wishlist is Empty</h1>
            <p className="text-muted-foreground mb-8">
              Save items you love to your wishlist. They'll be waiting for you here!
            </p>
            <Button asChild size="lg">
              <Link to="/products">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Browse Products
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground font-medium">My Wishlist</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Wishlist ({products.length})</h1>
          <Button variant="outline" asChild>
            <Link to="/products">Continue Shopping</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden group">
              <Link to={`/product/${product.id}`}>
                <div className="relative aspect-square bg-muted">
                  <img
                    src={product.images?.[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {product.badge && (
                    <Badge className="absolute top-3 left-3">{product.badge}</Badge>
                  )}
                </div>
              </Link>
              
              <div className="p-4">
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-xs text-primary/70 mb-2">{product.name_hindi}</p>
                </Link>
                
                <div className="flex items-center gap-1 mb-3">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{product.rating || 0}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews_count || 0})</span>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-bold text-foreground">₹{product.price}</span>
                  {product.original_price && product.original_price > product.price && (
                    <span className="text-sm text-muted-foreground line-through">
                      ₹{product.original_price}
                    </span>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleAddToCart(product)}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeFromWishlist(product.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Wishlist;

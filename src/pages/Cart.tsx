import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Loader2, CheckCircle, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const MINIMUM_ORDER_VALUE = 399;

// Shipping zones configuration
// Base location: Varanasi (UP) - 221001
const SHIPPING_ZONES = {
  local: {
    name: "Local (Varanasi)",
    charge: 30,
    pincodePrefix: ["221"], // Varanasi area
  },
  state: {
    name: "Uttar Pradesh",
    charge: 50,
    pincodePrefix: ["20", "21", "22", "23", "24", "25", "26", "27", "28"], // UP pincodes
  },
  national: {
    name: "Rest of India",
    charge: 80,
  },
};

const getShippingZone = (pincode: string): { zone: string; charge: number; zoneName: string } => {
  if (!pincode || pincode.length < 3) {
    return { zone: "unknown", charge: 0, zoneName: "Enter pincode" };
  }

  // Check local first (most specific)
  if (SHIPPING_ZONES.local.pincodePrefix.some(prefix => pincode.startsWith(prefix))) {
    return { zone: "local", charge: SHIPPING_ZONES.local.charge, zoneName: SHIPPING_ZONES.local.name };
  }

  // Check state
  if (SHIPPING_ZONES.state.pincodePrefix.some(prefix => pincode.startsWith(prefix))) {
    return { zone: "state", charge: SHIPPING_ZONES.state.charge, zoneName: SHIPPING_ZONES.state.name };
  }

  // Default to national
  return { zone: "national", charge: SHIPPING_ZONES.national.charge, zoneName: SHIPPING_ZONES.national.name };
};

const Cart = () => {
  const { items, updateQuantity, removeFromCart, totalItems, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [pincode, setPincode] = useState("");
  const [checkoutForm, setCheckoutForm] = useState({
    phone: "",
    address: "",
  });

  const shippingInfo = useMemo(() => getShippingZone(pincode), [pincode]);
  const shippingCharge = shippingInfo.zone !== "unknown" ? shippingInfo.charge : 0;
  const grandTotal = totalPrice + shippingCharge;

  const isMinimumOrderMet = totalPrice >= MINIMUM_ORDER_VALUE;
  const amountNeeded = MINIMUM_ORDER_VALUE - totalPrice;

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!checkoutForm.phone || !checkoutForm.address) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate phone number (10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(checkoutForm.phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    // Validate pincode
    if (!pincode || pincode.length !== 6) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }

    setIsProcessing(true);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway");
        setIsProcessing(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to continue");
        navigate("/auth");
        return;
      }

      // Create Razorpay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        "create-razorpay-order",
        {
          body: {
            amount: grandTotal,
            currency: "INR",
            receipt: `order_${Date.now()}`,
            notes: {
              user_id: user.id,
              phone: checkoutForm.phone,
            },
          },
        }
      );

      if (orderError || !orderData?.orderId) {
        console.error("Order creation error:", orderError);
        toast.error(orderData?.error || "Failed to create order");
        setIsProcessing(false);
        return;
      }

      // Configure Razorpay options
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Puja Samagri",
        description: "Order Payment",
        order_id: orderData.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // Verify payment and save order
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
              "verify-razorpay-payment",
              {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_data: {
                    user_id: user.id,
                    phone: checkoutForm.phone,
                    email: user.email,
                    shipping_address: `${checkoutForm.address}\nPincode: ${pincode}`,
                    items: items.map((item) => ({
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      quantity: item.quantity,
                      image: item.image,
                    })),
                    total_amount: grandTotal,
                    shipping_charge: shippingCharge,
                    shipping_zone: shippingInfo.zoneName,
                  },
                },
              }
            );

            if (verifyError || !verifyData?.verified) {
              console.error("Payment verification error:", verifyError);
              toast.error("Payment verification failed");
              return;
            }

            // Success
            setOrderSuccess(true);
            clearCart();
            toast.success("Payment successful! Order placed.");
          } catch (error) {
            console.error("Payment handler error:", error);
            toast.error("Something went wrong");
          }
        },
        prefill: {
          contact: checkoutForm.phone,
        },
        theme: {
          color: "#f97316",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setIsProcessing(false);
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to initiate payment");
      setIsProcessing(false);
    }
  };

  // Order success view
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Order Placed Successfully!</h1>
            <p className="text-muted-foreground mb-8">
              Thank you for your order. We'll send you a confirmation shortly.
            </p>
            <Button asChild variant="hero" size="lg">
              <Link to="/#products">
                Continue Shopping
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Your Cart is Empty</h1>
            <p className="text-muted-foreground mb-8">
              Looks like you haven't added any items to your cart yet. Start shopping to add items!
            </p>
            <Button asChild variant="hero" size="lg">
              <Link to="/#products">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Continue Shopping
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
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Cart</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground mb-8">
          Shopping Cart ({totalItems} {totalItems === 1 ? 'item' : 'items'})
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-4 md:p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <Link to={`/product/${item.id}`} className="shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg"
                    />
                  </Link>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.id}`}>
                      <h3 className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{item.nameHindi}</p>
                    </Link>

                    <p className="text-lg font-bold text-primary mt-2">₹{item.price}</p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center border border-border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-muted transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 font-medium min-w-[3rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-muted transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div className="text-right hidden md:block">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-bold text-foreground">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}

            {/* Clear Cart */}
            <div className="flex justify-end">
              <Button variant="outline" onClick={clearCart} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Cart
              </Button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <h2 className="text-xl font-bold text-foreground mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>₹{totalPrice.toLocaleString()}</span>
                </div>
                
                {/* Pincode Input for Shipping */}
                <div className="pt-2">
                  <Label htmlFor="pincode" className="text-sm font-medium">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Delivery Pincode
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="pincode"
                      type="text"
                      placeholder="Enter 6-digit pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6}
                      className="flex-1"
                    />
                  </div>
                  {pincode.length === 6 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Zone: {shippingInfo.zoneName}
                    </p>
                  )}
                </div>

                {/* Shipping Charge */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  {pincode.length === 6 ? (
                    <span>₹{shippingCharge}</span>
                  ) : (
                    <span className="text-xs italic">Enter pincode</span>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex justify-between text-lg font-bold text-foreground">
                    <span>Total</span>
                    <span>₹{grandTotal.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Including all taxes & shipping</p>
                </div>
              </div>

              {/* Minimum Order Warning */}
              {!isMinimumOrderMet && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    ₹{MINIMUM_ORDER_VALUE} से कम का ऑर्डर स्वीकार नहीं है
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    कृपया ₹{amountNeeded.toLocaleString()} और जोड़ें
                  </p>
                </div>
              )}

              {!showCheckout ? (
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full"
                  onClick={() => setShowCheckout(true)}
                  disabled={!isMinimumOrderMet || pincode.length !== 6}
                >
                  {!isMinimumOrderMet 
                    ? `Min. Order ₹${MINIMUM_ORDER_VALUE}` 
                    : pincode.length !== 6 
                      ? 'Enter Pincode'
                      : 'Proceed to Checkout'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit phone"
                      value={checkoutForm.phone}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Shipping Address *</Label>
                    <Textarea
                      id="address"
                      placeholder="Enter your complete address"
                      value={checkoutForm.address}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <Button 
                    variant="hero" 
                    size="lg" 
                    className="w-full"
                    onClick={handleCheckout}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Pay ₹${grandTotal.toLocaleString()}`
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowCheckout(false)}
                  >
                    Back to Cart
                  </Button>
                </div>
              )}

              <Link
                to="/#products"
                className="block text-center text-sm text-primary hover:underline mt-4"
              >
                Continue Shopping
              </Link>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cart;

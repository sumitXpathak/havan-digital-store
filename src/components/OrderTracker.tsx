import { Check, Package, Truck, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTrackerProps {
  status: string;
  createdAt: string;
}

const OrderTracker = ({ status, createdAt }: OrderTrackerProps) => {
  const steps = [
    { id: 'pending', label: 'Order Placed', icon: Clock, description: 'Your order has been received' },
    { id: 'confirmed', label: 'Confirmed', icon: Check, description: 'Order confirmed by seller' },
    { id: 'shipped', label: 'Shipped', icon: Truck, description: 'Package is on the way' },
    { id: 'delivered', label: 'Delivered', icon: MapPin, description: 'Package delivered' },
  ];

  const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(status.toLowerCase());
  const isCancelled = status.toLowerCase() === 'cancelled';

  const getStepStatus = (stepIndex: number) => {
    if (isCancelled) return 'cancelled';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  if (isCancelled) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
            <Package className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-destructive">Order Cancelled</p>
            <p className="text-sm text-muted-foreground">This order has been cancelled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Order Status</h3>
        <span className="text-sm text-muted-foreground">
          Ordered on {new Date(createdAt).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })}
        </span>
      </div>
      
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
        <div 
          className="absolute left-5 top-5 w-0.5 bg-primary transition-all duration-500"
          style={{ 
            height: currentIndex >= 0 
              ? `${Math.min((currentIndex / (steps.length - 1)) * 100, 100)}%` 
              : '0%' 
          }}
        />
        
        <div className="space-y-6">
          {steps.map((step, index) => {
            const stepStatus = getStepStatus(index);
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="relative flex items-start gap-4">
                <div
                  className={cn(
                    "relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    stepStatus === 'completed' && "bg-primary text-primary-foreground",
                    stepStatus === 'current' && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    stepStatus === 'upcoming' && "bg-muted text-muted-foreground"
                  )}
                >
                  {stepStatus === 'completed' ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p className={cn(
                    "font-medium",
                    stepStatus === 'upcoming' ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {step.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderTracker;

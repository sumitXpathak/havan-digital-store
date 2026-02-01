import { Shield, Clock, Award, Headphones, CreditCard } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "100% Authentic",
    description: "Genuine products sourced directly from artisans",
  },
  {
    icon: Clock,
    title: "Fast Dispatch",
    description: "Orders dispatched within 24 hours",
  },
  {
    icon: Award,
    title: "Quality Assured",
    description: "Premium quality puja items with warranty",
  },
  {
    icon: Headphones,
    title: "Customer Support",
    description: "Available 8AM-8PM (Mon-Sat)",
  },
  {
    icon: CreditCard,
    title: "Secure Payment",
    description: "Multiple payment options with secure checkout",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-16 bg-card dark:bg-card">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="text-center animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 dark:bg-primary/20 rounded-full mb-4 border border-primary/20 dark:border-primary/30">
                <feature.icon className="h-6 w-6 text-primary dark:text-primary" />
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

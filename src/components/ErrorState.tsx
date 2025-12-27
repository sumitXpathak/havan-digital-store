import { AlertCircle, WifiOff, ServerCrash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ErrorType = 'network' | 'server' | 'notFound' | 'generic';

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

const errorConfig = {
  network: {
    icon: WifiOff,
    title: "Connection Error",
    message: "Unable to connect. Please check your internet connection and try again.",
  },
  server: {
    icon: ServerCrash,
    title: "Server Error",
    message: "Something went wrong on our end. Please try again later.",
  },
  notFound: {
    icon: AlertCircle,
    title: "Not Found",
    message: "The resource you're looking for doesn't exist or has been moved.",
  },
  generic: {
    icon: AlertCircle,
    title: "Error",
    message: "Something went wrong. Please try again.",
  },
};

const ErrorState = ({
  type = 'generic',
  title,
  message,
  onRetry,
  className,
}: ErrorStateProps) => {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <Card className={`p-8 ${className}`}>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {title || config.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {message || config.message}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ErrorState;

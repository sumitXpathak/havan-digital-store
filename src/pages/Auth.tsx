import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/");
    }
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-saffron-50 via-background to-gold-50 dark:from-saffron-950/20 dark:via-background dark:to-gold-950/20 flex items-center justify-center p-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 gap-2"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold text-primary">
            🙏 श्री सनातन पूजा पाठ
          </h1>
          <p className="text-muted-foreground mt-2">Your Sacred Shopping Destination</p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin" className="flex justify-center">
            <SignIn 
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-xl border border-saffron-200/50 dark:border-saffron-800/30 bg-card/95 backdrop-blur-sm",
                  headerTitle: "text-foreground",
                  headerSubtitle: "text-muted-foreground",
                  formButtonPrimary: "bg-primary hover:bg-primary/90",
                  formFieldInput: "bg-background border-input",
                  formFieldLabel: "text-foreground",
                  footerActionLink: "text-primary hover:text-primary/80",
                  identityPreviewText: "text-foreground",
                  identityPreviewEditButton: "text-primary",
                }
              }}
            />
          </TabsContent>
          
          <TabsContent value="signup" className="flex justify-center">
            <SignUp 
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-xl border border-saffron-200/50 dark:border-saffron-800/30 bg-card/95 backdrop-blur-sm",
                  headerTitle: "text-foreground",
                  headerSubtitle: "text-muted-foreground",
                  formButtonPrimary: "bg-primary hover:bg-primary/90",
                  formFieldInput: "bg-background border-input",
                  formFieldLabel: "text-foreground",
                  footerActionLink: "text-primary hover:text-primary/80",
                }
              }}
            />
          </TabsContent>
        </Tabs>

        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Auth;

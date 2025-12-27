import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Users, ShoppingCart, TrendingUp, BarChart3, Boxes } from 'lucide-react';
import AdminAnalytics from '@/components/AdminAnalytics';
import AdminInventory from '@/components/AdminInventory';
import LoadingSpinner from '@/components/LoadingSpinner';

const Admin = () => {
  const { isAdmin, isLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate, toast]);

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Loading admin panel..." />;
  }

  if (!isAdmin) {
    return null;
  }

  const quickActions = [
    { 
      title: 'Manage Products', 
      description: 'Add, edit, or remove products from your catalog',
      icon: Package, 
      href: '/admin/products' 
    },
    { 
      title: 'View Orders', 
      description: 'Track and manage customer orders',
      icon: ShoppingCart, 
      href: '/admin/orders' 
    },
    { 
      title: 'Manage Users', 
      description: 'View customer accounts and manage admin roles',
      icon: Users, 
      href: '/admin/users' 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your store and view analytics</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="quick-actions" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Actions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <AdminInventory />
          </TabsContent>

          <TabsContent value="quick-actions" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quickActions.map((action) => (
                <Card 
                  key={action.title}
                  className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(action.href)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <action.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      {action.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{action.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;

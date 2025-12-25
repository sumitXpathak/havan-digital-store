import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Shield, ShieldOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

const AdminUsers = () => {
  const { isAdmin, isLoading: roleLoading, userId } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    action: 'add' | 'remove';
    email: string | null;
  } | null>(null);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('list-users', {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' });
    } else if (data?.users) {
      setUsers(data.users);
    }
    setIsLoading(false);
  };

  const handleRoleChange = async (targetUserId: string, action: 'add' | 'remove') => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase.functions.invoke('manage-user-role', {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: {
        target_user_id: targetUserId,
        role: 'admin',
        action,
      },
    });

    if (error || data?.error) {
      toast({
        title: 'Error',
        description: data?.error || 'Failed to update role',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: action === 'add' ? 'Admin role granted' : 'Admin role removed',
      });
      fetchUsers();
    }
    setPendingAction(null);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
            <p className="text-muted-foreground mt-1">View users and manage admin roles</p>
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email / Phone</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const isUserAdmin = user.roles.includes('admin');
                      const isCurrentUser = user.id === userId;
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              {user.email && <p className="font-medium">{user.email}</p>}
                              {user.phone && (
                                <p className={user.email ? "text-xs text-muted-foreground" : "font-medium"}>
                                  {user.phone}
                                </p>
                              )}
                              {isCurrentUser && (
                                <Badge variant="outline" className="mt-1 text-xs">You</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {user.last_sign_in_at
                              ? format(new Date(user.last_sign_in_at), 'MMM dd, yyyy HH:mm')
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.roles.length > 0 ? (
                                user.roles.map((role) => (
                                  <Badge
                                    key={role}
                                    variant={role === 'admin' ? 'default' : 'secondary'}
                                  >
                                    {role}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">User</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isUserAdmin ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPendingAction({
                                  userId: user.id,
                                  action: 'remove',
                                  email: user.email,
                                })}
                                disabled={isCurrentUser}
                                title={isCurrentUser ? "You cannot remove your own admin role" : ""}
                              >
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Remove Admin
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setPendingAction({
                                  userId: user.id,
                                  action: 'add',
                                  email: user.email,
                                })}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'add' ? 'Grant Admin Access?' : 'Remove Admin Access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === 'add'
                ? `This will give ${pendingAction?.email || 'this user'} full admin privileges including access to manage products, orders, and other users.`
                : `This will revoke admin privileges from ${pendingAction?.email || 'this user'}. They will no longer be able to access the admin panel.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingAction && handleRoleChange(pendingAction.userId, pendingAction.action)}
              className={pendingAction?.action === 'remove' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {pendingAction?.action === 'add' ? 'Grant Admin' : 'Remove Admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;

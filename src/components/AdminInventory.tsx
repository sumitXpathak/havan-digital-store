import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Package, Search } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  in_stock: boolean;
  images: string[] | null;
}

interface InventoryItem extends Product {
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const AdminInventory = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, price, in_stock, images')
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to fetch inventory');
    } else if (data) {
      const inventory: InventoryItem[] = data.map(product => ({
        ...product,
        stockLevel: product.in_stock ? 'in_stock' : 'out_of_stock',
      }));
      setProducts(inventory);
    }
    setIsLoading(false);
  };

  const toggleStock = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ in_stock: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update stock status');
    } else {
      toast.success('Stock status updated');
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const outOfStockCount = products.filter(p => !p.in_stock).length;
  const inStockCount = products.filter(p => p.in_stock).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading inventory...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inStockCount}</div>
          </CardContent>
        </Card>
        <Card className={outOfStockCount > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Out of Stock
              {outOfStockCount > 0 && <AlertCircle className="h-4 w-4 text-destructive" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Management</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2" />
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.images?.[0] || '/placeholder.svg'}
                            alt={product.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{product.category}</TableCell>
                      <TableCell>₹{product.price}</TableCell>
                      <TableCell>
                        <Badge
                          variant={product.in_stock ? "default" : "destructive"}
                        >
                          {product.in_stock ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStock(product.id, product.in_stock)}
                        >
                          {product.in_stock ? "Mark Out of Stock" : "Mark In Stock"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInventory;

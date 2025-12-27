import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  name_hindi: string | null;
  price: number;
  images: string[] | null;
  category: string;
}

interface SearchAutocompleteProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchAutocomplete = ({ 
  onSearch, 
  placeholder = "Search products...",
  className 
}: SearchAutocompleteProps) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved).slice(0, 5));
    }
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_hindi, price, images, category')
        .or(`name.ilike.%${query}%,name_hindi.ilike.%${query}%,category.ilike.%${query}%`)
        .eq('in_stock', true)
        .limit(6);

      if (!error && data) {
        setSuggestions(data);
      }
      setIsLoading(false);
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Save to recent searches
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    setIsOpen(false);
    setQuery(searchQuery);
    onSearch?.(searchQuery);
  };

  const handleProductClick = (product: Product) => {
    setIsOpen(false);
    setQuery("");
    navigate(`/product/${product.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (query.length < 2 ? recentSearches.length : 0);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleProductClick(suggestions[selectedIndex]);
      } else if (query.length < 2 && selectedIndex >= 0 && selectedIndex < recentSearches.length) {
        handleSearch(recentSearches[selectedIndex]);
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const clearRecentSearch = (searchToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== searchToRemove);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const showDropdown = isOpen && (query.length >= 2 || (query.length < 2 && recentSearches.length > 0));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              onSearch?.("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {/* Recent Searches */}
          {query.length < 2 && recentSearches.length > 0 && !isLoading && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                Recent Searches
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={search}
                  onClick={() => handleSearch(search)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors",
                    selectedIndex === index && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{search}</span>
                  </div>
                  <button
                    onClick={(e) => clearRecentSearch(search, e)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Product Suggestions */}
          {query.length >= 2 && suggestions.length > 0 && !isLoading && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                Products
              </div>
              {suggestions.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors",
                    selectedIndex === index && "bg-muted"
                  )}
                >
                  <img
                    src={product.images?.[0] || '/placeholder.svg'}
                    alt={product.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.name_hindi} • ₹{product.price}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {product.category}
                  </span>
                </button>
              ))}
              {query && (
                <button
                  onClick={() => handleSearch(query)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary hover:bg-muted transition-colors border-t border-border"
                >
                  <Search className="h-4 w-4" />
                  Search for "{query}"
                </button>
              )}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">No products found for "{query}"</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSearch(query)}
              >
                Search anyway
              </Button>
            </div>
          )}

          {/* Popular Categories */}
          {query.length < 2 && recentSearches.length === 0 && !isLoading && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <TrendingUp className="h-3 w-3" />
                <span>Popular searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Murtis', 'Pooja Thali', 'Incense', 'Diyas'].map(term => (
                  <Button
                    key={term}
                    variant="secondary"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSearch(term)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;

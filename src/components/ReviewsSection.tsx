import { useState, useEffect } from "react";
import { Star, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Public review interface - excludes user_id for privacy
interface Review {
  id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ReviewsSectionProps {
  productId: string;
}

const StarRating = ({ 
  rating, 
  onRatingChange, 
  interactive = false,
  size = "md"
}: { 
  rating: number; 
  onRatingChange?: (rating: number) => void;
  interactive?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onRatingChange?.(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= (hoverRating || rating)
                ? "fill-gold-500 text-gold-500"
                : "text-muted"
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
};

const ReviewForm = ({ 
  productId, 
  onReviewSubmitted 
}: { 
  productId: string; 
  onReviewSubmitted: () => void;
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to submit a review.",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      product_id: productId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
    });

    setIsSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Already Reviewed",
          description: "You have already reviewed this product.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to submit review. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

    toast({
      title: "Review Submitted",
      description: "Thank you for your feedback!",
    });

    setRating(0);
    setComment("");
    onReviewSubmitted();
  };

  if (!user) {
    return (
      <div className="bg-muted/50 rounded-xl p-6 text-center">
        <p className="text-muted-foreground mb-4">Login to write a review</p>
        <Button variant="saffron" onClick={() => window.location.href = "/auth"}>
          Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/50 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-foreground">Write a Review</h3>
      
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Your Rating</label>
        <StarRating rating={rating} onRatingChange={setRating} interactive size="lg" />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Your Review (Optional)</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this product..."
          rows={4}
          maxLength={1000}
        />
      </div>

      <Button type="submit" variant="saffron" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
};

const ReviewCard = ({ review }: { review: Review }) => {
  return (
    <div className="border-b border-border pb-6 last:border-0">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(review.created_at), "MMM dd, yyyy")}
            </span>
          </div>
          {review.comment && (
            <p className="text-muted-foreground">{review.comment}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ReviewsSection = ({ productId }: ReviewsSectionProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  const fetchReviews = async () => {
    setIsLoading(true);
    // Use public_reviews view to avoid exposing user_id
    const { data, error } = await supabase
      .from("public_reviews" as any)
      .select("id, product_id, rating, comment, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }) as { data: Review[] | null; error: any };

    if (!error && data) {
      setReviews(data);
      if (data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percentage: reviews.length > 0 
      ? (reviews.filter((r) => r.rating === star).length / reviews.length) * 100 
      : 0,
  }));

  return (
    <section className="py-12 border-t">
      <div className="container mx-auto px-4">
        <h2 className="font-heading text-2xl font-bold text-foreground mb-8">
          Customer Reviews
        </h2>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Rating Summary */}
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-xl p-6 text-center">
              <div className="text-4xl font-bold text-foreground mb-2">
                {averageRating || "-"}
              </div>
              <StarRating rating={Math.round(averageRating)} />
              <p className="text-sm text-muted-foreground mt-2">
                Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {ratingDistribution.map(({ star, count, percentage }) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm w-3">{star}</span>
                  <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Review Form */}
          <div>
            <ReviewForm productId={productId} onReviewSubmitted={fetchReviews} />
          </div>

          {/* Reviews List */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reviews yet. Be the first to review!
              </div>
            ) : (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;

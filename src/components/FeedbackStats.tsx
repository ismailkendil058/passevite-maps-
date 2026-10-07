import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ThumbsUp, MessageSquare } from 'lucide-react';

interface Feedback {
  id: string;
  name: string | null;
  phone: string | null;
  message: string;
  created_at: string;
}

export const FeedbackStats = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [satisfiedCount, setSatisfiedCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    if (!isOpen) return;
    setLoading(true);

    try {
      // Fetch satisfied clients count (sum of all daily counts)
      const { data: satisfiedData, error: satisfiedError } = await supabase
        .from('satisfied_stats')
        .select('count');

      if (satisfiedError) throw satisfiedError;

      const totalSatisfied = satisfiedData?.reduce((acc, curr) => acc + (curr.count || 0), 0) || 0;
      setSatisfiedCount(totalSatisfied);

      // Fetch feedbacks and their count
      const { data: feedbacksData, error: feedbacksError, count } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (feedbacksError) throw feedbacksError;

      if (feedbacksData) {
        setFeedbacks(feedbacksData);
        setFeedbackCount(count || feedbacksData.length);
      }
    } catch (error) {
      console.error('Error fetching satisfaction stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 text-[#1F1F3D] hover:bg-[#5C5CD6]/10">
          <div className="relative">
            <MessageSquare className="h-4 w-4" />
            {(feedbackCount > 0) && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-[#5C5CD6]" />
            )}
          </div>
          <span className="text-xs font-semibold hidden sm:inline">Satisfaction</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl rounded-[2.5rem] border-none bg-[#F7F7FD] shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="font-serif text-2xl font-light text-[#1F1F3D]">
            Flux <span className="italic text-[#5C5CD6]">Satisfaction</span>
          </DialogTitle>
        </DialogHeader>
        <div className="px-8 pb-8">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white shadow-xl shadow-[#5C5CD6]/5 border border-[#5C5CD6]/10">
              <div className="p-3 rounded-2xl bg-[#5C5CD6]/10">
                <ThumbsUp className="h-6 w-6 text-[#5C5CD6]" />
              </div>
              <div className="text-center">
                <p className="text-3xl font-serif font-bold text-[#1F1F3D]">{satisfiedCount}</p>
                <p className="text-[10px] font-bold text-[#5C5CD6] uppercase tracking-widest">Satisfaits</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white shadow-xl shadow-[#5C5CD6]/5 border border-[#5C5CD6]/10">
              <div className="p-3 rounded-2xl bg-[#5C5CD6]/10">
                <MessageSquare className="h-6 w-6 text-[#5C5CD6]" />
              </div>
              <div className="text-center">
                <p className="text-3xl font-serif font-bold text-[#1F1F3D]">{feedbackCount}</p>
                <p className="text-[10px] font-bold text-[#5C5CD6] uppercase tracking-widest">Avis Clients</p>
              </div>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-2">Derniers avis</h3>
          {loading ? (
            <p className="text-center text-muted-foreground">Chargement...</p>
          ) : feedbacks.length === 0 ? (
            <p className="text-center text-muted-foreground">Aucun avis pour le moment.</p>
          ) : (
            <div className="space-y-4 max-h-[40vh] overflow-y-auto">
              {feedbacks.map(fb => (
                <div key={fb.id} className="p-3 rounded-md border text-sm">
                  <p className="font-medium">{fb.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fb.name || 'Anonyme'} {fb.phone && `(${fb.phone})`} - {new Date(fb.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

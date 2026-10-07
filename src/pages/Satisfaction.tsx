import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smile, Frown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const Satisfaction = () => {
  const navigate = useNavigate();

  const handleSatisfaction = async () => {
    try {
      const { error } = await supabase.rpc('increment_satisfied_count');
      if (error) {
        console.error('Error incrementing satisfaction count:', error);
      }
    } catch (error) {
      console.error('An unexpected error occurred:', error);
    } finally {
      window.location.href = 'https://search.google.com/local/writereview?placeid=ChIJMdVNhCCxjxIRR4IfBYih-aE';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements matching Index */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in" style={{ animationDelay: '0.3s' }} />

      <div className="text-center mb-16 relative z-10 w-full max-w-4xl mx-auto animate-fade-in">
        {/* Logo */}
        <div className="inline-block mb-8 p-4 rounded-2xl bg-white shadow-2xl shadow-primary/10 animate-float border border-primary/10 mx-auto">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-16 w-16 object-contain" />
        </div>

        {/* Headline */}
        <Card className="backdrop-blur-sm bg-white/70 dark:bg-black/20 border-primary/20 shadow-2xl max-w-3xl mx-auto">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground italic bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent">
              Votre expérience chez notre clinique vous a-t-elle satisfait ?
            </CardTitle>
            <CardDescription className="text-xl md:text-2xl text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
              Votre avis est précieux et nous aide à améliorer la qualité de nos soins.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 max-w-3xl mx-auto w-full">
          {/* Oui Button */}
          <Button
            size="lg"
            className="h-auto min-h-[5rem] py-4 w-full text-[15px] sm:text-lg md:text-xl lg:text-2xl font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 rounded-2xl bg-primary text-primary-foreground border-2 border-primary/20 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] px-4"
            onClick={handleSatisfaction}
          >
            <Smile className="w-6 h-6 md:w-8 md:h-8 mr-2 flex-shrink-0 group-hover:bounce" />
            <span className="leading-tight text-center">Oui, je suis satisfait(e)</span>
          </Button>

          {/* Non Button */}
          <Link to="/feedback" className="group block w-full">
            <Button
              variant="outline"
              size="lg"
              className="h-auto min-h-[5rem] py-4 w-full text-[15px] sm:text-lg md:text-xl lg:text-2xl font-bold shadow-xl shadow-gray-200/50 hover:shadow-gray-300/50 transition-all duration-300 rounded-2xl border-2 hover:border-gray-300 backdrop-blur-sm hover:scale-[1.02] active:scale-[0.98] px-4"
            >
              <Frown className="w-6 h-6 md:w-8 md:h-8 mr-2 flex-shrink-0 group-hover:rotate-12 transition-transform duration-300" />
              <span className="leading-tight text-center">Non, je ne suis pas satisfait(e)</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="hidden" dangerouslySetInnerHTML={{
        __html: `
          @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 1s ease-out; }
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
          .animate-float { animation: float 3s ease-in-out infinite; }
        `
      }} />
    </div>
  );
};

export default Satisfaction;

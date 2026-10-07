import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, Search, AlertCircle } from 'lucide-react';


interface QueueData {
  client_id: string;
  patient_name?: string;
  state: string;
  position: number;
  peopleBefore: number;
  doctor_name: string;
  found: boolean;
}

const Client = () => {
  const [phone, setPhone] = useState('');
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string; initial: string }[]>([]);

  useEffect(() => {
    supabase.from('doctors').select('*').then(({ data }) => {
      if (data) setDoctors(data);
    });
  }, []);

  const lookupByPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    await findClient(phone.trim());
    setLoading(false);
  };

  const findClient = async (phoneValue: string) => {
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (!session) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    // Optimization: Let the database handle the complex priority sorting
    // Priority: U (0), N (1), R (2). We can use a CASE statement in order if supported, 
    // but the safest and fastest way is multiple orders or a calculated field.
    // For now, we'll fetch only what's needed for the current session.
    const { data: allEntries } = await supabase
      .from('queue_entries')
      .select('*, doctor:doctors(*)')
      .eq('session_id', session.id)
      .eq('status', 'waiting');

    if (!allEntries) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const PRIORITY: Record<string, number> = { U: 0, N: 1, R: 2 };
    const sorted = [...allEntries].sort((a, b) => {
      const pa = PRIORITY[a.state] ?? 99;
      const pb = PRIORITY[b.state] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.state_number - b.state_number;
    });

    const entry = sorted.find(e => e.phone === phoneValue);

    if (!entry) {
      setQueueData({ client_id: '', state: '', position: 0, peopleBefore: 0, doctor_name: '', found: false });
      return;
    }

    const idx = sorted.findIndex(e => e.id === entry!.id);

    // Count people before this client waiting for the SAME doctor
    const peopleBeforeSameDoctor = sorted.slice(0, idx).filter(
      e => e.doctor_id === entry!.doctor_id
    ).length;

    setQueueData({
      client_id: entry.client_id,
      patient_name: entry.patient_name,
      state: entry.state,
      position: idx + 1,
      peopleBefore: peopleBeforeSameDoctor,
      doctor_name: (entry as any).doctor?.name || '',
      found: true,
    });
  };

  // Real-time updates - optimized subscription
  useEffect(() => {
    if (!queueData?.found) return;

    const channel = supabase
      .channel('client-position-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'queue_entries'
        },
        (payload) => {
          if (phone.trim()) findClient(phone.trim());
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queueData?.found, phone]);

  const stateLabels: Record<string, string> = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in gpu" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in gpu"
        style={{ animationDelay: '0.3s' }}
      />

      <div className="text-center mb-10 relative z-10 animate-fade-in gpu text-center flex flex-col items-center">
        <div className="inline-block mb-4 p-2 rounded-2xl bg-white shadow-xl shadow-primary/10 animate-float gpu border border-primary/5">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-10 w-10 object-contain" />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tighter italic">
          PasseVite
        </h1>
        <p className="text-[10px] md:text-sm tracking-[0.5em] text-muted-foreground mt-2 font-medium uppercase text-center">
          Le soin qui passe vite
        </p>
        <div className="h-1 w-12 bg-primary/20 mx-auto mt-6 rounded-full" />
      </div>

      {!queueData?.found && !loading && (
        <div className="w-full max-w-md relative z-10 animate-slide-up gpu">
          <Card className="border border-white/40 shadow-xl shadow-primary/5 bg-white/50 backdrop-blur-sm overflow-hidden rounded-3xl">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-lg font-bold tracking-tight text-foreground">Trouver votre position</CardTitle>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Informations de file d'attente</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors">
                    <Search className="h-full w-full" />
                  </div>
                  <Input
                    placeholder="Votre numéro de téléphone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    className="h-14 pl-12 rounded-2xl border-primary/10 bg-white/50 focus:ring-primary/20 transition-all font-medium text-lg"
                  />
                </div>
                <Button
                  onClick={lookupByPhone}
                  className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    "Rechercher ma position"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <div className="relative z-10 animate-fade-in py-12 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Recherche en cours...</p>
        </div>
      )}

      {queueData && !queueData.found && !loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in">
          <Card className="w-full max-w-sm border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
            <div className="h-2 w-full bg-rose-500" />
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center animate-bounce-subtle">
                  <AlertCircle className="h-10 w-10 text-rose-500" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-foreground tracking-tight italic">Patient introuvable</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Aucune entrée active n'a été trouvée pour ce numéro dans la séance actuelle.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setQueueData(null)}
                className="w-full h-12 rounded-xl border-2 font-bold uppercase tracking-widest text-xs hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all active:scale-95"
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {queueData?.found && (
        <div className="w-full max-w-md relative z-10 animate-slide-up gpu">
          <Card className="border border-white/40 shadow-2xl shadow-primary/10 bg-white/60 backdrop-blur-lg rounded-[2.5rem] overflow-hidden">
            <CardContent className="p-8 sm:p-10 text-center space-y-8 relative">
              <div className="absolute top-0 left-0 w-full h-2 bg-primary/10" />
              <div className="absolute top-0 left-0 h-2 bg-primary animate-[shimmer_2s_infinite] w-full" style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)' }} />

              <div className="space-y-3">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tighter italic animate-fade-in">
                  {queueData.patient_name || queueData.client_id}
                </h2>
                {queueData.patient_name && (
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-black text-muted-foreground/60 uppercase tracking-[0.4em]">Téléphone</p>
                    <p className="text-xl font-bold text-primary tracking-tight">{queueData.client_id}</p>
                  </div>
                )}
              </div>

              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-primary/10 bg-primary/5">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-black text-primary uppercase tracking-widest italic">{stateLabels[queueData.state] || queueData.state}</span>
              </div>

              <div className="bg-white/40 rounded-[2.5rem] p-8 sm:p-10 border border-white shadow-2xl shadow-primary/5 relative group">
                <div className="flex items-center justify-center gap-4 mb-3 animate-float gpu">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-primary/5">
                    <Users className="h-8 w-8 sm:h-10 sm:w-10 text-primary group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-6xl sm:text-7xl font-black text-foreground tracking-tighter tabular-nums">{queueData.peopleBefore}</span>
                </div>
                <p className="text-xs sm:text-sm font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                  {queueData.peopleBefore === 0
                    ? "C'est votre tour !"
                    : `personne${queueData.peopleBefore > 1 ? 's' : ''} avant vous`}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 text-muted-foreground p-4 bg-muted/20 rounded-2xl border border-muted/10">
                <div className="p-2 rounded-lg bg-white/50 shadow-sm">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs sm:text-sm font-bold tracking-wide uppercase">{queueData.doctor_name}</span>
              </div>

              <Button
                variant="ghost"
                onClick={() => setQueueData(null)}
                className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 hover:text-primary hover:bg-primary/5 rounded-full px-8 h-10 transition-all active:scale-95"
              >
                Nouvelle recherche
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-12 text-[8px] sm:text-[10px] text-muted-foreground/50 uppercase tracking-[0.3em] relative z-10 animate-fade-in text-center flex items-center gap-2">
        <span className="h-px w-8 bg-muted-foreground/20" />
        {new Date().getFullYear()} PasseVite Excellence &bull; Patient Portal
        <span className="h-px w-8 bg-muted-foreground/20" />
      </p>
    </div>
  );
};

export default Client;

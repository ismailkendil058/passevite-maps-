import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const LoginMedecin = () => {
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const { data: doctors, isLoading: doctorsLoading } = useQuery({
        queryKey: ['doctors'],
        queryFn: async () => {
            const { data } = await supabase.from('doctors').select('*').order('name');
            return data || [];
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDoctorId || !password.trim()) {
            toast.error('Veuillez sélectionner votre nom et entrer le mot de passe');
            return;
        }

        setLoading(true);

        const { data: matchedDoctor, error } = await supabase
            .from('doctors')
            .select('*')
            .eq('id', selectedDoctorId)
            .eq('password', password.trim())
            .maybeSingle();

        setLoading(false);

        if (error || !matchedDoctor) {
            toast.error('Mot de passe ou identifiants incorrects');
            return;
        }

        localStorage.setItem('doctor_auth', JSON.stringify({
            id: matchedDoctor.id,
            name: matchedDoctor.name,
            role: 'doctor'
        }));

        toast.success(`Bienvenue ${matchedDoctor.name}`);
        navigate('/doctor');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7F7FD] p-4 font-sans selection:bg-[#5C5CD6]/30">
            <Card className="w-full max-w-md shadow-2xl border-none rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="text-center space-y-6 pt-10 pb-2 relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="absolute left-6 top-6 rounded-full hover:bg-muted"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="mx-auto block">
                        <img src="/VitalWeb.png" alt="Logo" className="h-10 w-auto brightness-0 opacity-80 mx-auto" />
                        <h1 className="text-3xl font-serif font-bold tracking-tight text-[#1F1F3D] mt-4 uppercase">PasseVite</h1>
                        <p className="text-[10px] tracking-[0.4em] text-[#5C5CD6] mt-1 font-bold">PORTAIL DOCTEUR</p>
                    </div>
                    <div className="w-16 h-16 rounded-3xl bg-[#5C5CD6]/10 flex items-center justify-center mx-auto shadow-sm">
                        <Users className="h-8 w-8 text-[#5C5CD6]" />
                    </div>
                    <CardTitle className="font-serif text-xl font-bold text-[#1F1F3D]">Espace Soins</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Select
                                value={selectedDoctorId}
                                onValueChange={setSelectedDoctorId}
                                disabled={doctorsLoading}
                            >
                                <SelectTrigger className="h-14 rounded-2xl border-none bg-[#F7F7FD]/50 focus:ring-[#5C5CD6]/30 text-base">
                                    <SelectValue placeholder={doctorsLoading ? "Chargement..." : "Sélectionner votre nom..."} />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none bg-white shadow-2xl">
                                    {doctors?.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="rounded-xl">{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="password"
                                placeholder="Mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-14 rounded-2xl border-none bg-[#F7F7FD]/50 focus-visible:ring-[#5C5CD6]/30 text-base"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-14 bg-[#1F1F3D] hover:bg-[#5C5CD6] text-white rounded-full font-bold shadow-xl shadow-black/10 transition-all active:scale-95 text-base"
                            disabled={loading || !selectedDoctorId}
                        >
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </Button>

                        <div className="mt-8 p-6 rounded-[1.8rem] bg-[#5C5CD6]/5 border border-[#5C5CD6]/10 text-center">
                            <p className="text-[10px] font-black text-[#5C5CD6] uppercase tracking-widest mb-1">Accès Personnel</p>
                            <p className="text-xs text-[#4A4A4A] italic font-light font-serif">Veuillez sélectionner votre nom et entrer votre mot de passe pour accéder au carnet de soins.</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginMedecin;

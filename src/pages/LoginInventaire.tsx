import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, ArrowLeft } from 'lucide-react';

const LoginInventaire = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) return;
        setLoading(true);

        const { error, data } = await signIn(username.trim(), password.trim());
        setLoading(false);

        if (error) {
            toast.error('Identifiants incorrects');
            return;
        }

        if (data?.user?.role === 'receptionist' || data?.user?.role === 'manager' || data?.user?.role === 'admin') {
            navigate('/inventaire');
        } else {
            toast.error('Accès refusé. Ce portail est réservé au personnel autorisé.');
        }
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
                        <h1 className="text-3xl font-black tracking-tighter text-[#1F1F3D] mt-4 uppercase italic">PasseVite</h1>
                        <p className="text-[10px] tracking-[0.4em] text-[#5C5CD6] mt-1 font-bold italic uppercase">PORTAIL INVENTAIRE</p>
                    </div>
                    <div className="w-16 h-16 rounded-3xl bg-[#5C5CD6]/10 flex items-center justify-center mx-auto shadow-sm">
                        <Package className="h-8 w-8 text-[#5C5CD6]" />
                    </div>
                    <CardTitle className="text-xl font-bold text-[#1F1F3D]">Gestion du Stock</CardTitle>
                </CardHeader>
                <CardContent className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <Input
                                type="text"
                                placeholder="Nom d'utilisateur"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="h-14 rounded-2xl border-none bg-[#F7F7FD]/50 focus-visible:ring-[#5C5CD6]/30 text-base"
                                required
                            />
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
                            disabled={loading}
                        >
                            {loading ? 'Connexion...' : 'Accéder au Stock'}
                        </Button>

                        <div className="mt-8 p-6 rounded-[1.8rem] bg-[#5C5CD6]/5 border border-[#5C5CD6]/10 text-center">
                            <p className="text-[10px] font-black text-[#5C5CD6] uppercase tracking-widest mb-1">Accès Restreint</p>
                            <p className="text-xs text-[#4A4A4A] italic font-medium">Veuillez entrer vos identifiants pour gérer les produits et consommables.</p>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginInventaire;

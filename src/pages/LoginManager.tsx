import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserCog, ArrowLeft } from 'lucide-react';

const LoginManager = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);

    // Login using our new custom roles table logic
    const { error, data } = await signIn(username.trim(), password.trim());
    setLoading(false);

    if (error) {
      toast.error('Identifiants incorrects');
      return;
    }

    if (data?.user?.role === 'manager' || data?.user?.role === 'admin') {
      navigate('/manager');
    } else {
      toast.error('Accès refusé. Ce portail est réservé au manager.');
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
            <h1 className="text-3xl font-serif font-bold tracking-tight text-[#1F1F3D] mt-4 uppercase">PasseVite</h1>
            <p className="text-[10px] tracking-[0.4em] text-[#5C5CD6] mt-1 font-bold">DIRECTION & ANALYTICS</p>
          </div>
          <div className="w-16 h-16 rounded-3xl bg-[#5C5CD6]/10 flex items-center justify-center mx-auto shadow-sm">
            <UserCog className="h-8 w-8 text-[#5C5CD6]" />
          </div>
          <CardTitle className="font-serif text-xl font-bold text-[#1F1F3D]">Espace Manager</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Nom d'utilisateur (ex: admin)"
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
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>

            <div className="mt-8 p-6 rounded-[1.8rem] bg-[#1F1F3D] text-white/90 text-center">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Portail de Gestion</p>
              <p className="text-xs italic font-light font-serif">Veuillez entrer vos identifiants administrateur pour accéder aux rapports.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginManager;

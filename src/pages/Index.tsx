import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, UserCog, Sparkles, Tv, UserCheck, FlaskConical, Globe, Star, CreditCard, Package } from 'lucide-react';



const Index = () => {
  const sections = [
    { title: 'Accueil', description: 'Gestion de la reception et de la file', icon: Monitor, href: '/accueil/login', variant: 'outline' as const },
    { title: 'Manager', description: 'Tableau de bord analytique', icon: UserCog, href: '/manager/login', variant: 'outline' as const },
    { title: 'Docteur', description: 'Tableau de bord de soins', icon: UserCheck, href: '/doctor/login', variant: 'outline' as const },
    { title: 'Laboratoire', description: 'Suivi des envois & prothèses', icon: FlaskConical, href: '/labo', variant: 'outline' as const },
    { title: 'Site Web', description: 'Présentation de la clinique', icon: Globe, href: '/website', variant: 'outline' as const },
    { title: 'Rendez-vous', description: 'Réservations du site web', icon: Sparkles, href: '/appointment/login', variant: 'outline' as const },
    { title: 'Télévision', description: 'Affichage de la file d\'attente', icon: Tv, href: '/tv', variant: 'outline' as const },
    { title: 'Avis Patient', description: 'Formulaire de satisfaction', icon: Star, href: '/review', variant: 'outline' as const },
    { title: 'E-Carte Patient', description: 'Suivi de soins & paiements', icon: CreditCard, href: '/patient', variant: 'outline' as const },
    { title: 'Inventaire', description: 'Gestion du stock & consommables', icon: Package, href: '/inventaire/login', variant: 'outline' as const },


  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] animate-fade-in gpu" />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] animate-fade-in gpu"
        style={{ animationDelay: '0.3s' }}
      />

      <div className="text-center mb-10 relative z-10 animate-fade-in gpu">
        <div className="inline-block mb-4 p-2 rounded-2xl bg-white shadow-xl shadow-primary/10 animate-float gpu border border-primary/5">
          <img src="/VitalWeb.png" alt="PasseVite Logo" className="h-12 w-12 object-contain" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-primary tracking-tighter italic">
          PasseVite
        </h1>
        <p className="text-[10px] md:text-sm tracking-[0.5em] text-muted-foreground mt-2 font-medium uppercase">
          Le soin qui passe vite
        </p>
        <div className="h-1 w-12 bg-primary/20 mx-auto mt-6 rounded-full" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-7xl relative z-10 justify-center">
        {sections.map(({ title, description, icon: Icon, href }, index) => (
          <Link
            key={href}
            to={href}
            className="animate-slide-up gpu"
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          >
            <Card className="border border-white/40 dark:border-white/5 shadow-xl shadow-primary/5 hover:shadow-primary/10 transition-all duration-300 cursor-pointer group h-full bg-white/50 dark:bg-black/20 backdrop-blur-sm active:scale-95">
              <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center space-y-3 sm:space-y-4 h-full justify-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-bold text-foreground text-sm sm:text-lg group-hover:text-primary transition-colors">{title}</h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed px-1 sm:px-2">{description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p
        className="mt-12 text-[8px] sm:text-[10px] text-muted-foreground/50 uppercase tracking-widest sm:tracking-[0.2em] relative z-10 animate-fade-in text-center px-4"
        style={{ animationDelay: '1s' }}
      >
        &copy; {new Date().getFullYear()} Le soin qui passe vite &bull; Excellence en Soins
      </p>

    </div>
  );
};

export default Index;
